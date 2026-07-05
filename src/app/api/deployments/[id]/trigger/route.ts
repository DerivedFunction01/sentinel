import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { ScanStatus } from "@/lib/enums";
import { findDefaultModel } from "@/lib/model-utils";
import { getCachedDbModels } from "@/lib/models-cache";
import { type ToolDef } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import {
  generateAttackSet,
  generateReportId,
  runSingleScanPipeline,
  RunSingleScanPipelineConfig,
} from "@/lib/scan-pipeline";
import fs from "fs";
import path from "path";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate via Bearer API Key
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      );
    }

    const plainKey = authHeader.substring(7).trim();
    if (!plainKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401 },
      );
    }

    const keyPrefix = plainKey.slice(0, 12);
    const apiKeys = await db.apiKey.findMany({ where: { keyPrefix } });

    let matchingKey: any = null;
    for (const apiKey of apiKeys) {
      const isMatch = await bcrypt.compare(plainKey, apiKey.hashedKey);
      if (isMatch) {
        matchingKey = apiKey;
        break;
      }
    }

    if (!matchingKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // 2. Fetch the deployment profile
    const deployment = await db.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 },
      );
    }

    // 3. Verify ownership
    if (deployment.userId !== matchingKey.userId) {
      return NextResponse.json(
        { error: "Unauthorized access to this deployment" },
        { status: 403 },
      );
    }

    // 4. Fetch dbModels (cached) and build config
    const dbModels = await getCachedDbModels();
    const defaultModel = findDefaultModel(dbModels);

    const systemPrompt = deployment.systemPrompt;
    const forbiddenTask = deployment.forbiddenTask;
    const judgeInstructions = deployment.judgeInstructions;

    const attackerModel = deployment.attackerModel || defaultModel;
    const judgeModel = deployment.judgeModel || defaultModel;
    const hardenerModel = deployment.hardenerModel || defaultModel;
    const seedExtractorModel = deployment.seedExtractorModel || defaultModel;
    const extractorModel = deployment.extractorModel || defaultModel;

    let tools: ToolDef[] = [];
    let mockToolResponses: Record<string, unknown> = {};
    try {
      tools = deployment.tools
        ? (JSON.parse(deployment.tools) as ToolDef[])
        : [];
    } catch {}
    try {
      mockToolResponses = deployment.mockToolResponses
        ? (JSON.parse(deployment.mockToolResponses) as Record<string, unknown>)
        : {};
    } catch {}

    // Import hold calculation utility and estimateTokens
    const { calculateUpfrontScanHold, estimateTokens } = await import("@/lib/token-utils");

    // Compute ontology token sizes (same as scan/launch route)
    const ONTOLOGY_DIR = path.join(process.cwd(), "uploads", "ontology");
    const ontologyFiles = fs.readdirSync(ONTOLOGY_DIR).filter((f) => f.endsWith(".md"));
    const ontologySizes: Record<string, number> = {};
    for (const file of ontologyFiles) {
      try {
        const content = fs.readFileSync(path.join(ONTOLOGY_DIR, file), "utf-8");
        const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/m);
        const body = match ? match[1].trim() : content.trim();
        ontologySizes[file] = estimateTokens(body);
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
      [{ systemPrompt, forbiddenTask, judgeInstructions }],
      [deployment.targetModel],
      seedExtractorModel,
      attackerModel,
      judgeModel,
      dbModels,
      true, // enableHardening is true for SDK/deployment runs
      hardenerModel,
      extractorModel,
      templateTokens,
    );

    // Verify scan tokens
    const user = await db.user.findUnique({
      where: { id: matchingKey.userId },
      select: { id: true, scanTokens: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.scanTokens < upfrontHold) {
      return NextResponse.json(
        {
          error: `Not enough scan tokens. This scan requires an upfront hold of ${upfrontHold} tokens, but you only have ${user.scanTokens}.`,
        },
        { status: 403 },
      );
    }

    // Deduct user tokens & update API key lastUsedAt
    await db.user.update({
      where: { id: user.id },
      data: { scanTokens: { decrement: upfrontHold } },
    });

    await db.apiKey.update({
      where: { id: matchingKey.id },
      data: { lastUsedAt: new Date() },
    });

    // 5. Generate the attack set
    // If seed extraction fails (returns zero things after retry), refund the token hold and abort.
    let attackSet;
    try {
      attackSet = await generateAttackSet({
        systemPrompt,
        forbiddenTask,
        judgeInstructions,
        tools,
        mockToolResponses,
        attackerModel,
        seedExtractorModel,
        extractorModel,
      });
    } catch (err: any) {
      if (
        err.message?.startsWith("SeedExtractionFailed") ||
        err.message?.includes("failed")
      ) {
        // Refund the upfront hold
        await db.user.update({
          where: { id: user.id },
          data: { scanTokens: { increment: upfrontHold } },
        });
        console.warn(
          `[deploy-trigger] Seed extraction failed for deployment ${id} — refunded ${upfrontHold} tokens.`,
        );
        return NextResponse.json(
          {
            error:
              "Seed extraction failed: unable to extract restrictions from the system prompt. Token hold has been fully refunded.",
          },
          { status: 422 },
        );
      } else {
        throw err;
      }
    }

    const reportId = generateReportId();

    // 8. Create the Scan record with RUNNING status (shared pipeline expects it to exist)
    await db.scan.create({
      data: {
        reportId,
        userId: user.id,
        targetModel: deployment.targetModel,
        attackerModel,
        judgeModel,
        hardenerModel,
        systemPrompt,
        forbiddenTask,
        judgeInstructions,
        tools: JSON.stringify(tools),
        mockToolResponses: JSON.stringify(mockToolResponses),
        allowNoToolsFallback: deployment.allowNoToolsFallback,
        trials: "[]",
        score: 0,
        riskLevel: "UNKNOWN" as any,
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

    // 9. Execute the shared pipeline (synchronous — caller waits for result)
    const pipelineConfig: RunSingleScanPipelineConfig & {
      upfrontHold?: number;
    } = {
      systemPrompt,
      forbiddenTask,
      judgeInstructions,
      targetModel: deployment.targetModel,
      attackerModel,
      judgeModel,
      hardenerModel,
      seedExtractorModel,
      extractorModel,
      tools,
      mockToolResponses,
      userId: user.id,
      granularity: Granularity.Compact,
      includeToolRecommendation: false,
      enableHardening: true,
      allowNoToolsFallback: deployment.allowNoToolsFallback,
      upfrontHold,
    };

    await runSingleScanPipeline(pipelineConfig, reportId, attackSet, dbModels);

    // 10. Fetch the completed Scan record to return results
    const completedScan = await db.scan.findUnique({
      where: { reportId },
    });

    if (!completedScan) {
      return NextResponse.json(
        { error: "Scan record not found after pipeline execution" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      reportId: completedScan.reportId,
      score: completedScan.score,
      riskLevel: completedScan.riskLevel,
      breaches: completedScan.breaches,
      totalTrials: completedScan.totalTrials,
    });
  } catch (error: any) {
    console.error("Error triggering deployment scan:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
