import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { RiskLevel, ScanStatus, TrialVerdict } from "@/lib/enums";
import {
  DEFAULT_MODEL,
  findDefaultModel,
  UsageTracker,
} from "@/lib/model-utils";
import { type ToolDef } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import {
  generateAttackSet,
  executeTargetJudgePipeline,
  generateReportId,
  generateBatchId,
  summarizeBreachedAttacks,
} from "@/lib/scan-pipeline";
import { callOpenRouter } from "@/lib/model-utils";

/** Shape of a prompt config received from the frontend. */
interface PromptPayload {
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: string;
  mockResponses: string;
}

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

  // Accept multiple prompts
  const promptsRaw: PromptPayload[] = Array.isArray(body.prompts)
    ? body.prompts
    : [
        {
          systemPrompt: (body.systemPrompt as string) || "",
          forbiddenTask: (body.forbiddenTask as string) || "",
          judgeInstructions: (body.judgeInstructions as string) || "",
          tools: (body.tools as string) || "",
          mockResponses: (body.mockResponses as string) || "",
        },
      ];

  if (promptsRaw.length === 0) {
    return NextResponse.json(
      { error: "At least one prompt is required." },
      { status: 400 },
    );
  }

  // Calculate total scans for token deduction
  const totalScans = targetModels.length * promptsRaw.length;

  // Check token balance.
  if (user.scanTokens < totalScans) {
    return NextResponse.json(
      {
        error: `Not enough tokens. You need ${totalScans} but have ${user.scanTokens}.`,
      },
      { status: 403 },
    );
  }

  // Fetch dbModels once to get pricing rates and defaults
  const dbModels = await db.model.findMany({
    orderBy: [{ isRecommended: "desc" }, { popularityRank: "asc" }],
  });
  const defaultModel = findDefaultModel(dbModels);

  // Custom pipeline model overrides
  const seedExtractorModel =
    (body.seedExtractorModel as string) || defaultModel;
  const attackGeneratorModel =
    (body.attackerModel as string) ||
    (body.attackGeneratorModel as string) ||
    defaultModel;
  const judgeModel = (body.judgeModel as string) || defaultModel;
  const hardenerModel = (body.hardenerModel as string) || defaultModel;
  const extractorModel = (body.extractorModel as string) || DEFAULT_MODEL;

  // Parse each prompt's tools and mock responses
  const parsedPrompts = promptsRaw.map((p) => {
    let tools: ToolDef[] = [];
    let mockToolResponses: Record<string, unknown> = {};
    try {
      tools = p.tools ? (JSON.parse(p.tools) as ToolDef[]) : [];
    } catch {
      /* keep empty */
    }
    try {
      mockToolResponses = p.mockResponses
        ? (JSON.parse(p.mockResponses) as Record<string, unknown>)
        : {};
    } catch {
      /* keep empty */
    }
    return {
      systemPrompt: p.systemPrompt,
      forbiddenTask: p.forbiddenTask,
      judgeInstructions: p.judgeInstructions,
      tools,
      mockToolResponses,
    };
  });

  // Decrement tokens atomically
  await db.user.update({
    where: { id: user.id },
    data: { scanTokens: { decrement: totalScans } },
  });

  // Initialize a shared tracker for cost aggregation (rough estimate)
  const tracker: UsageTracker = {
    totalCost: 0,
    dbModels,
  };

  // Generate a single batch ID for all scans in this launch
  const batchId = generateBatchId();

  // Phase 1: Pre-generate attack sets for each unique prompt
  // Attack generation uses the same attacker model + seedExtractor for all
  const attackSets: Record<
    number,
    Awaited<ReturnType<typeof generateAttackSet>>
  > = {};
  const attackSetPromises = parsedPrompts.map(async (prompt, idx) => {
    const attackSet = await generateAttackSet(
      {
        systemPrompt: prompt.systemPrompt,
        forbiddenTask: prompt.forbiddenTask,
        judgeInstructions: prompt.judgeInstructions,
        tools: prompt.tools,
        mockToolResponses: prompt.mockToolResponses,
        attackerModel: attackGeneratorModel,
        seedExtractorModel,
        extractorModel,
      },
      tracker,
    );
    attackSets[idx] = attackSet;
  });
  await Promise.all(attackSetPromises);

  // Phase 2: Create scan records and launch background pipelines
  const scanInfos: Array<{
    reportId: string;
    targetModel: string;
    promptIndex: number;
  }> = [];

  for (const targetModel of targetModels) {
    for (let promptIdx = 0; promptIdx < parsedPrompts.length; promptIdx++) {
      const prompt = parsedPrompts[promptIdx];
      const reportId = generateReportId();
      scanInfos.push({ reportId, targetModel, promptIndex: promptIdx });

      const toolsJson = JSON.stringify(prompt.tools);
      const mockJson = JSON.stringify(prompt.mockToolResponses);

      // Create Scan record with RUNNING status
      await db.scan.create({
        data: {
          reportId,
          userId: user.id,
          batchId,
          promptIndex: promptIdx,
          targetModel,
          attackerModel: attackGeneratorModel,
          judgeModel,
          hardenerModel,
          systemPrompt: prompt.systemPrompt,
          forbiddenTask: prompt.forbiddenTask,
          judgeInstructions: prompt.judgeInstructions,
          tools: toolsJson,
          mockToolResponses: mockJson,
          trials: "[]",
          score: 0,
          riskLevel: RiskLevel.Unknown,
          totalTrials: 0,
          breaches: 0,
          breachRate: 0,
          summary: "",
          summaryDetail: "",
          apiCost: 0,
          status: ScanStatus.Running,
          currentStep: 0,
          totalSteps: 0,
        },
      });

      // Start pipeline asynchronously with shared attack set
      runModelPromptPipeline(
        {
          systemPrompt: prompt.systemPrompt,
          forbiddenTask: prompt.forbiddenTask,
          judgeInstructions: prompt.judgeInstructions,
          targetModel,
          attackerModel: attackGeneratorModel,
          judgeModel,
          hardenerModel,
          seedExtractorModel,
          extractorModel,
          tools: prompt.tools,
          mockToolResponses: prompt.mockToolResponses,
          userId: user.id,
          granularity: Granularity.Compact,
          includeToolRecommendation: true,
          enableHardening: body.enableHardening !== false,
        },
        reportId,
        attackSets[promptIdx],
        dbModels,
      ).catch((err) =>
        console.error(`Background pipeline failed for ${reportId}:`, err),
      );
    }
  }

  return NextResponse.json({
    batchId,
    scans: scanInfos,
    tokensRemaining: user.scanTokens - totalScans,
    totalScans,
  });
}

/**
 * Run target+judge pipeline for one (model × prompt) combo using a pre-generated attack set.
 */
async function runModelPromptPipeline(
  options: {
    systemPrompt: string;
    forbiddenTask: string;
    judgeInstructions: string;
    targetModel: string;
    attackerModel: string;
    judgeModel: string;
    hardenerModel: string;
    seedExtractorModel: string;
    extractorModel: string;
    tools: ToolDef[];
    mockToolResponses: Record<string, unknown>;
    userId: string;
    granularity: Granularity;
    includeToolRecommendation: boolean;
    enableHardening: boolean;
  },
  reportId: string,
  attackSet: Awaited<ReturnType<typeof generateAttackSet>>,
  dbModels: any[],
) {
  const tracker: UsageTracker = { totalCost: 0, dbModels };

  try {
    const modelShort =
      options.targetModel.split("/").pop() || options.targetModel;

    // Calculate total steps: target+judge × number of attacks
    const totalSteps = attackSet.attacks.length * 2;
    let currentStep = 0;

    const updateProgress = async (step: number, total: number) => {
      await db.scan.update({
        where: { reportId },
        data: { currentStep: step, totalSteps: total },
      });
    };

    // Call initial progress
    await updateProgress(0, totalSteps);

    // Execute target+judge pipeline with shared attacks
    const result = await executeTargetJudgePipeline(
      {
        systemPrompt: options.systemPrompt,
        forbiddenTask: options.forbiddenTask,
        judgeInstructions: options.judgeInstructions,
        targetModel: options.targetModel,
        judgeModel: options.judgeModel,
        tools: options.tools,
        mockToolResponses: options.mockToolResponses,
      },
      attackSet,
      tracker,
      async (step, total) => {
        currentStep = step;
        await updateProgress(step, total);
      },
    );

    // Generate attack summary
    const breachedAttacksWithVerdicts = result.trials
      .filter((t) => t.verdict === TrialVerdict.Breached)
      .map((t) => ({
        attack: t.attack,
        judgeReasoning: t.judgeVerdict,
        verdict: t.verdict,
      }));

    let attackSummaryText = "";
    try {
      attackSummaryText = await summarizeBreachedAttacks(async (promptText) => {
        const response = await callOpenRouter(
          options.hardenerModel,
          [{ role: "user", content: promptText }],
          undefined,
          tracker,
        );
        return response.content || "";
      }, breachedAttacksWithVerdicts);
    } catch (err) {
      console.error("Attack summarization failed:", err);
    }

    const finalSummary = `Adversarial pressure on ${modelShort}.`;
    const finalSummaryDetail = `${result.totalTrials} adversarial trials probed a ${modelShort} deployment. ${result.breaches} landed (${result.breachRate}% breach rate).`;

    // Build metadata from attack set and results
    const metadata = {
      seedExtraction: {
        thingName: attackSet.seedInfo.thingName,
        thingDescription: attackSet.seedInfo.thingDescription,
        thingNameVariants: attackSet.seedInfo.thingNameVariants,
        thingDescriptionVariants: attackSet.seedInfo.thingDescriptionVariants,
        personaDescription: attackSet.seedInfo.personaDescription,
        businessFeatures: attackSet.seedInfo.businessFeatures,
        businessScenarios: attackSet.seedInfo.businessScenarios,
        businessCategories: attackSet.seedInfo.businessCategories,
        extractorModel: options.seedExtractorModel,
        extractedAt: new Date().toISOString(),
      },
      attackSummary: {
        summarizedPatterns: attackSummaryText,
        breachedAttacks: breachedAttacksWithVerdicts,
        summarizedAt: new Date().toISOString(),
      },
    };

    // Update scan record with final results
    await db.scan.update({
      where: { reportId },
      data: {
        trials: JSON.stringify(result.trials),
        score: result.score,
        riskLevel: result.riskLevel,
        totalTrials: result.totalTrials,
        breaches: result.breaches,
        breachRate: result.breachRate,
        summary: finalSummary,
        summaryDetail: finalSummaryDetail,
        apiCost: result.apiCost,
        metadata: JSON.stringify(metadata),
        status: ScanStatus.Completed,
        currentStep: totalSteps,
        totalSteps,
      },
    });
  } catch (error) {
    console.error(`Pipeline failed for ${reportId}:`, error);
    await db.scan.update({
      where: { reportId },
      data: {
        status: ScanStatus.Failed,
        summary: "Scan pipeline execution failed.",
        summaryDetail: `An unexpected error occurred: ${(error as Error).message || "Unknown error"}`,
      },
    });
  }
}
