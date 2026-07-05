import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { RiskLevel, ScanStatus } from "@/lib/enums";
import { findDefaultModel } from "@/lib/model-utils";
import { getCachedDbModels } from "@/lib/models-cache";
import { type ToolDef, type SeedInfo } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import {
  generateReportId,
  generateBatchId,
  RunScanWithGenerationConfig,
  launchScanWorker,
} from "@/lib/scan-pipeline";
import fs from "fs";
import path from "path";

/** Shape of a prompt config received from the frontend. */
interface PromptPayload {
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: string;
  mockResponses: string;
  allowNoToolsFallback?: boolean;
  cachedSeedInfo?: SeedInfo;
}

export async function POST(req: Request) {
  // Authenticate via session OR Bearer API key
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: authUser.userId },
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
          allowNoToolsFallback: !!body.allowNoToolsFallback,
          cachedSeedInfo: body.cachedSeedInfo as any,
        },
      ];

  if (promptsRaw.length === 0) {
    return NextResponse.json(
      { error: "At least one prompt is required." },
      { status: 400 },
    );
  }

  // Fetch dbModels once to get pricing rates and defaults
  const dbModels = await getCachedDbModels();
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
  const extractorModel = (body.extractorModel as string) || defaultModel;

  const enableHardening = body.enableHardening !== false;

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
      allowNoToolsFallback: !!p.allowNoToolsFallback,
      cachedSeedInfo: p.cachedSeedInfo,
    };
  });

  // Import hold calculation utility and estimateTokens
  const { calculateUpfrontScanHold, estimateTokens } = await import("@/lib/token-utils");

  // Compute ontology token sizes directly (same as template-tokens endpoint)
  const ONTOLOGY_DIR = path.join(process.cwd(), "uploads", "ontology");
  const ontologyFiles = fs.readdirSync(ONTOLOGY_DIR).filter((f) => f.endsWith(".md"));
  const ontologySizes: Record<string, number> = {};
  for (const file of ontologyFiles) {
    try {
      const content = fs.readFileSync(path.join(ONTOLOGY_DIR, file), "utf-8");
      const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/m);
      const fileBody = match ? match[1].trim() : content.trim();
      ontologySizes[file] = estimateTokens(fileBody);
    } catch {
      ontologySizes[file] = 0;
    }
  }
  const domainFiles = Object.keys(ontologySizes).filter(
    (f) => f !== "main_agent.md" && f !== "general_business.md" && ontologySizes[f] > 0,
  );
  const avgDomainTokens =
    domainFiles.length > 0
      ? Math.round(
          domainFiles.reduce((sum, f) => sum + ontologySizes[f], 0) / domainFiles.length,
        )
      : 1000;
  const templateTokens = {
    mainAgentTokens: ontologySizes["main_agent.md"] || 100,
    generalBusinessTokens: ontologySizes["general_business.md"] || 2000,
    avgDomainTokens,
  };

  // Calculate upfront hold tokens
  const upfrontHold = calculateUpfrontScanHold(
    parsedPrompts,
    targetModels,
    seedExtractorModel,
    attackGeneratorModel,
    judgeModel,
    dbModels,
    enableHardening,
    hardenerModel,
    extractorModel,
    templateTokens,
  );

  // Check token balance
  if (user.scanTokens < upfrontHold) {
    return NextResponse.json(
      {
        error: `Not enough tokens. You need ${upfrontHold} tokens for this hold but have ${user.scanTokens}.`,
      },
      { status: 403 },
    );
  }

  // Deduct upfront hold tokens atomically
  await db.user.update({
    where: { id: user.id },
    data: { scanTokens: { decrement: upfrontHold } },
  });

  // Generate a single batch ID for all scans in this launch
  const batchId = generateBatchId();

  // Create all scan records FIRST, then fire background workers.
  // This allows the frontend to immediately switch to the progress UI after
  // receiving the batchId, while seed extraction + attack generation happen
  // in the background with live progressMeta updates.
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

      const promptTargetHold = calculateUpfrontScanHold(
        [prompt],
        [targetModel],
        seedExtractorModel,
        attackGeneratorModel,
        judgeModel,
        dbModels,
        enableHardening,
        hardenerModel,
        extractorModel,
        templateTokens,
      );

      const toolsJson = JSON.stringify(prompt.tools);
      const mockJson = JSON.stringify(prompt.mockToolResponses);

      // Create Scan record immediately with Running status and no steps yet.
      // totalSteps = 0 signals to the UI that we are still in the generation phase.
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
          allowNoToolsFallback: prompt.allowNoToolsFallback,
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

      // Build pipeline config and fire the background worker (no await).
      // The worker handles seed extraction, attack generation, target + judge phases.
      const pipelineConfig: RunScanWithGenerationConfig = {
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
        allowNoToolsFallback: prompt.allowNoToolsFallback,
        upfrontHold: promptTargetHold,
        cachedSeedInfo: prompt.cachedSeedInfo,
      };

      launchScanWorker(pipelineConfig, reportId, dbModels);
    }
  }

  // Get current user token balance to return
  const finalUser = await db.user.findUnique({
    where: { id: user.id },
    select: { scanTokens: true },
  });

  return NextResponse.json({
    batchId,
    scans: scanInfos,
    tokensRemaining: finalUser?.scanTokens ?? user.scanTokens,
    totalScans: targetModels.length * parsedPrompts.length,
  });
}
