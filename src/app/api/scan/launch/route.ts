import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { RiskLevel, ScanStatus } from "@/lib/enums";
import {
  FALLBACK_DEFAULT_MODEL,
  findDefaultModel,
  UsageTracker,
} from "@/lib/model-utils";
import { getCachedDbModels } from "@/lib/models-cache";
import { type ToolDef, type SeedInfo } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import {
  generateAttackSet,
  generateReportId,
  generateBatchId,
  runSingleScanPipeline,
  RunSingleScanPipelineConfig,
} from "@/lib/scan-pipeline";
import { patterns } from "@/lib/attack-templates";

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
  const dbModels = await getCachedDbModels(db);
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
  // If seed extraction fails (returns zero things after retry), we refund
  // tokens for that prompt and skip it.
  const attackSets: Record<
    number,
    Awaited<ReturnType<typeof generateAttackSet>>
  > = {};
  const failedPromptIndices: number[] = [];
  const attackSetPromises = parsedPrompts.map(async (prompt, idx) => {
    try {
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
          cachedSeedInfo: prompt.cachedSeedInfo,
        },
        tracker,
      );
      attackSets[idx] = attackSet;

      // Charge additional tokens if trials count exceeds patterns.length * 3
      const trialsCount = attackSet.attacks.length;
      const tokensPerModel = Math.ceil(trialsCount / (patterns.length * 3));
      const additionalDeduction = (tokensPerModel - 1) * targetModels.length;

      if (additionalDeduction > 0) {
        const freshUser = await db.user.findUnique({
          where: { id: user.id },
          select: { scanTokens: true },
        });
        if (!freshUser || freshUser.scanTokens < additionalDeduction) {
          console.warn(
            `[launch] Insufficient tokens for prompt ${idx} (needs ${additionalDeduction} more) — canceling and refunding initial tokens.`,
          );
          failedPromptIndices.push(idx);
          // Refund the 1 token per model we already deducted
          await db.user.update({
            where: { id: user.id },
            data: { scanTokens: { increment: targetModels.length } },
          });
          return;
        }

        // Deduct extra tokens
        await db.user.update({
          where: { id: user.id },
          data: { scanTokens: { decrement: additionalDeduction } },
        });
        console.log(
          `[launch] Deducted additional ${additionalDeduction} token(s) for large scan on prompt ${idx} (${trialsCount} trials).`,
        );
      }
    } catch (err: any) {
      if (err.message?.startsWith("SeedExtractionFailed")) {
        console.warn(
          `[launch] Seed extraction failed for prompt ${idx} — refunding ${targetModels.length} token(s) and skipping.`,
        );
        failedPromptIndices.push(idx);
        // Refund tokens for this prompt (one per target model)
        await db.user.update({
          where: { id: user.id },
          data: { scanTokens: { increment: targetModels.length } },
        });
      } else {
        throw err; // rethrow unexpected errors
      }
    }
  });
  await Promise.all(attackSetPromises);

  // Phase 2: Create scan records and launch background pipelines
  // Skip prompts whose seed extraction failed
  const scanInfos: Array<{
    reportId: string;
    targetModel: string;
    promptIndex: number;
  }> = [];

  for (const targetModel of targetModels) {
    for (let promptIdx = 0; promptIdx < parsedPrompts.length; promptIdx++) {
      // Skip prompts that failed seed extraction
      if (failedPromptIndices.includes(promptIdx)) {
        continue;
      }

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

      // Start pipeline asynchronously with shared attack set
      const pipelineConfig: RunSingleScanPipelineConfig = {
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
      };

      runSingleScanPipeline(
        pipelineConfig,
        reportId,
        attackSets[promptIdx],
        dbModels,
      ).catch((err) =>
        console.error(`Background pipeline failed for ${reportId}:`, err),
      );
    }
  }

  const netTokensDeducted = (parsedPrompts.length - failedPromptIndices.length) * targetModels.length;

  if (scanInfos.length === 0) {
    return NextResponse.json(
      {
        error: "All prompts failed seed extraction. Your tokens have been fully refunded.",
        failedPrompts: failedPromptIndices,
        tokensRemaining: user.scanTokens,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    batchId,
    scans: scanInfos,
    tokensRemaining: user.scanTokens - netTokensDeducted,
    totalScans,
    failedPrompts: failedPromptIndices.length > 0 ? failedPromptIndices : undefined,
  });
}
