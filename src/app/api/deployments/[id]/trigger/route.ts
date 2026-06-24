import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { TrialVerdict, JudgeLabel, RiskLevel, ScanStatus } from "@/lib/enums";
import { DEFAULT_MODEL, findDefaultModel } from "@/lib/model-utils";
import { Granularity, type ToolDef, type Trial } from "@/lib/types";
import { executeScanPipeline } from "@/lib/scan-pipeline";

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

    // 6. Run the parallelized scanning pipeline
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

    // Execute the scan pipeline
    const result = await executeScanPipeline({
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
      includeToolRecommendation: false, // Deployment trigger doesn't include tool recommendations
    });

    const modelShort =
      deployment.targetModel.split("/").pop() || deployment.targetModel;

    const hardeningModelId = result.hardeningModelId;
    const hardeningDbModel = dbModels.find((m) => m.id === hardeningModelId);
    const hardeningModelName =
      hardeningDbModel?.name ||
      hardeningModelId.split("/").pop() ||
      hardeningModelId;

    await db.scan.create({
      data: {
        reportId: result.reportId,
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
            modelId: hardeningModelId,
            modelName: hardeningModelName,
            prompt: result.hardenedPrompt,
          },
        },
        apiCost: result.apiCost,
        status: ScanStatus.Completed,
      },
    });

    return NextResponse.json({
      success: true,
      reportId: result.reportId,
      score: result.score,
      riskLevel: result.riskLevel,
      breaches: result.breaches,
      totalTrials: result.totalTrials,
    });
  } catch (error: any) {
    console.error("Error triggering deployment scan:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
