import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScanStatus } from "@/lib/enums";
import { findDefaultModel } from "@/lib/model-utils";
import { Granularity, type ToolDef } from "@/lib/types";
import { executeScanPipeline, UsageTracker } from "@/lib/scan-pipeline";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, scanTokens: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Parse the submitted scan configuration.
  const body = await req.json().catch(() => ({}));

  // Accept both targetModels (array) and targetModel (single).
  const targetModels: string[] = Array.isArray(body.targetModels)
    ? body.targetModels
    : body.targetModel
      ? [body.targetModel]
      : [];

  if (targetModels.length === 0) {
    return NextResponse.json(
      { error: "Select at least one target model." },
      { status: 400 },
    );
  }

  // Check token balance.
  if (user.scanTokens < targetModels.length) {
    return NextResponse.json(
      {
        error: `Not enough tokens. You need ${targetModels.length} but have ${user.scanTokens}.`,
      },
      { status: 403 },
    );
  }

  // Fetch dbModels once to get pricing rates and defaults
  const dbModels = await db.model.findMany({
    orderBy: [{ isRecommended: "desc" }, { popularityRank: "asc" }],
  });
  const defaultModel = findDefaultModel(dbModels);

  const systemPrompt = (body.systemPrompt as string) || "";
  const forbiddenTask = (body.forbiddenTask as string) || "";
  const judgeInstructions = (body.judgeInstructions as string) || "";

  // Custom pipeline model overrides — accept either explicit field name, falling back to dynamically queried default
  const seedExtractorModel =
    (body.seedExtractorModel as string) || defaultModel;
  const attackGeneratorModel =
    (body.attackerModel as string) ||
    (body.attackGeneratorModel as string) ||
    defaultModel;
  const judgeModel = (body.judgeModel as string) || defaultModel;
  const hardenerModel = (body.hardenerModel as string) || defaultModel;
  const extractorModel =
    (body.extractorModel as string) || "google/gemini-2.5-flash";

  let tools: ToolDef[] = [];
  let mockToolResponses: Record<string, unknown> = {};
  try {
    tools = body.tools ? (JSON.parse(body.tools) as ToolDef[]) : [];
  } catch {
    /* keep empty */
  }
  try {
    mockToolResponses = body.mockResponses
      ? (JSON.parse(body.mockResponses) as Record<string, unknown>)
      : {};
  } catch {
    /* keep empty */
  }

  const toolsJson = JSON.stringify(tools);
  const mockJson = JSON.stringify(mockToolResponses);

  // Decrement tokens atomically.
  await db.user.update({
    where: { id: user.id },
    data: { scanTokens: { decrement: targetModels.length } },
  });

  // Initialize a tracker to aggregate the total cost
  const tracker: UsageTracker = {
    totalCost: 0,
    dbModels,
  };

  // Execute scans for each target model
  const reportIds: string[] = [];
  for (const targetModel of targetModels) {
    // Create initial Scan record with RUNNING status before executing pipeline
    const reportId = generateReportId();

    await db.scan.create({
      data: {
        reportId,
        userId: user.id,
        targetModel,
        attackerModel: attackGeneratorModel,
        judgeModel,
        hardenerModel,
        systemPrompt,
        forbiddenTask,
        judgeInstructions,
        tools: toolsJson,
        mockToolResponses: mockJson,
        trials: "[]",
        score: 0,
        riskLevel: "LOW",
        totalTrials: 0,
        breaches: 0,
        breachRate: 0,
        summary: "",
        summaryDetail: "",
        apiCost: 0,
        status: ScanStatus.Running,
        currentStep: 0,
        totalSteps: 0, // Will be updated during execution
      },
    });

    reportIds.push(reportId);

    // Execute pipeline with progress callback to update database
    const result = await executeScanPipeline(
      {
        systemPrompt,
        forbiddenTask,
        judgeInstructions,
        targetModel,
        attackerModel: attackGeneratorModel,
        judgeModel,
        hardenerModel,
        seedExtractorModel,
        extractorModel,
        tools,
        mockToolResponses,
        userId: user.id,
        granularity: Granularity.Compact,
        includeToolRecommendation: true,
        enableHardening: false, // Deployment trigger doesn't generate hardened prompts by default
      },
      // Progress callback - updates database with current progress
      async (currentStep, totalSteps) => {
        await db.scan.update({
          where: { reportId },
          data: {
            currentStep,
            totalSteps,
          },
        });
      },
    );

    const modelShort = targetModel.split("/").pop() || targetModel;

    await db.scan.update({
      where: { reportId },
      data: {
        trials: JSON.stringify(result.trials),
        score: result.score,
        riskLevel: result.riskLevel,
        totalTrials: result.totalTrials,
        breaches: result.breaches,
        breachRate: result.breachRate,
        summary: `Adversarial pressure on ${modelShort}.`,
        summaryDetail: `${result.totalTrials} adversarial trials probed a ${modelShort} deployment. ${result.breaches} landed (${result.breachRate}% breach rate).`,
        hardenedPrompts: {
          create: {
            modelId: result.hardeningModelId,
            modelName: result.hardeningModelName,
            prompt: result.hardenedPrompt,
            toolRecommendation: result.toolRecommendation,
            compatibilityScore: result.compatibilityScore,
            granularity: Granularity.Compact,
            extractorModel,
          },
        },
        apiCost: result.apiCost,
        status: ScanStatus.Completed,
      },
    });
  }

  return NextResponse.json({
    scanIds: reportIds,
    reportId: reportIds[0], // navigate to the first scan
    tokensRemaining: user.scanTokens - targetModels.length,
    scansCreated: reportIds.length,
  });
}

// Helper function for generating report ID (imported from scan-pipeline)
function generateReportId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SP-${yy}-${mm}${dd}-${rand}`;
}
