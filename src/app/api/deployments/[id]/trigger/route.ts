import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { ScanStatus } from "@/lib/enums";
import { DEFAULT_MODEL, findDefaultModel } from "@/lib/model-utils";
import { type ToolDef } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import {
  generateAttackSet,
  generateReportId,
  runSingleScanPipeline,
  RunSingleScanPipelineConfig,
} from "@/lib/scan-pipeline";

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

    // 4. Verify scan tokens
    const user = await db.user.findUnique({
      where: { id: matchingKey.userId },
      select: { id: true, scanTokens: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.scanTokens < 1) {
      return NextResponse.json(
        { error: "Not enough scan tokens" },
        { status: 403 },
      );
    }

    // 5. Decrement user tokens & update API key lastUsedAt
    await db.user.update({
      where: { id: user.id },
      data: { scanTokens: { decrement: 1 } },
    });

    await db.apiKey.update({
      where: { id: matchingKey.id },
      data: { lastUsedAt: new Date() },
    });

    // 6. Fetch dbModels and build config
    const dbModels = await db.model.findMany({
      orderBy: [{ isRecommended: "desc" }, { popularityRank: "asc" }],
    });
    const defaultModel = findDefaultModel(dbModels);

    const systemPrompt = deployment.systemPrompt;
    const forbiddenTask = deployment.forbiddenTask;
    const judgeInstructions = deployment.judgeInstructions;

    const attackerModel = deployment.attackerModel || defaultModel;
    const judgeModel = deployment.judgeModel || defaultModel;
    const hardenerModel = deployment.hardenerModel || defaultModel;
    const seedExtractorModel = defaultModel;
    const extractorModel = deployment.extractorModel || DEFAULT_MODEL;

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

    // 7. Generate the attack set
    const attackSet = await generateAttackSet({
      systemPrompt,
      forbiddenTask,
      judgeInstructions,
      tools,
      mockToolResponses,
      attackerModel,
      seedExtractorModel,
      extractorModel,
    });

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
    const pipelineConfig: RunSingleScanPipelineConfig = {
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
