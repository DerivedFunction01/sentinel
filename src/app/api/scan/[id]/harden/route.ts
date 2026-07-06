import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callOpenRouter, FALLBACK_DEFAULT_MODEL, UsageTracker } from "@/lib/model-utils";
import { getCachedDbModels, findDefaultModelFromCache } from "@/lib/models-cache";
import { db } from "@/lib/db";
import { TrialVerdict } from "@/lib/enums";
import { type ToolDef, type HardeningTrace } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import { generateHardenedPrompt } from "@/lib/hardening";
import { getDeterministicHardenedPrompt } from "@/lib/scan-prompts";
import { summarizeBreachedAttacks } from "@/lib/scan-pipeline";
import { processRefund } from "@/lib/token-utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reportId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const scanRow = await db.scan.findFirst({
      where: { reportId, userId: session.user.id },
      include: { hardenedPrompts: true },
    });
    if (!scanRow) {
      return new Response("Scan not found", { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");

    if (modelId) {
      // Find the most recent hardened prompt for this model
      const existing = await db.hardenedPrompt.findFirst({
        where: {
          scanId: scanRow.id,
          modelId,
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        let recObj: any = null;
        if (existing.toolRecommendation) {
          try {
            recObj = JSON.parse(existing.toolRecommendation);
          } catch {}
        }
        return NextResponse.json({
          id: existing.id,
          originalPrompt: scanRow.systemPrompt,
          hardenedPrompt: existing.prompt,
          modelId: existing.modelId,
          modelName: existing.modelName,
          toolRecommendation: recObj,
          compatibilityScore: existing.compatibilityScore,
          granularity: existing.granularity,
          extractorModel: existing.extractorModel,
        });
      }
    }

    // Fallback to the first available hardened prompt, or create a deterministic one
    const firstPrompt = scanRow.hardenedPrompts[0];
    const hardenedPromptText =
      firstPrompt?.prompt ||
      getDeterministicHardenedPrompt(scanRow.systemPrompt);

    let recObj: any = null;
    if (firstPrompt?.toolRecommendation) {
      try {
        recObj = JSON.parse(firstPrompt.toolRecommendation);
      } catch {}
    }

    return NextResponse.json({
      originalPrompt: scanRow.systemPrompt,
      hardenedPrompt: hardenedPromptText,
      modelId: firstPrompt?.modelId || "fallback",
      modelName: firstPrompt?.modelName || "Fallback",
      toolRecommendation: recObj,
      compatibilityScore: firstPrompt?.compatibilityScore,
      granularity: firstPrompt?.granularity,
      extractorModel: firstPrompt?.extractorModel,
    });
  } catch (error: any) {
    console.error("Error retrieving hardened prompt:", error);
    return new Response("Error retrieving hardened prompt", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reportId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const scanRow = await db.scan.findFirst({
      where: { reportId, userId: session.user.id },
      include: { hardenedPrompts: true },
    });
    if (!scanRow) {
      return new Response("Scan not found", { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const dbModels = await getCachedDbModels(db) as any[];
    const defaultModel = findDefaultModelFromCache(FALLBACK_DEFAULT_MODEL);

    const modelId =
      body.modelId ||
      scanRow.judgeModel ||
      scanRow.attackerModel ||
      defaultModel;
    const granularity = body.granularity || Granularity.Compact;
    const extractorModel = body.extractorModel || defaultModel;
    const includeToolRecommendation = body.includeToolRecommendation !== false;

    // ── Token hold calculation ────────────────────────────────────────────────
    const { estimateTokens } = await import("@/lib/token-utils");
    const sysPromptTokens = estimateTokens(scanRow.systemPrompt || "");
    const basePromptTokens = sysPromptTokens + estimateTokens(scanRow.forbiddenTask || "") + estimateTokens(scanRow.judgeInstructions || "");

    const hardener = dbModels.find(m => m.id === modelId);
    const extractor = dbModels.find(m => m.id === extractorModel);

    const hardenerPrice = {
      prompt: parseFloat(hardener?.promptPrice || "0.0000001"),
      completion: parseFloat(hardener?.completionPrice || "0.0000004"),
    };
    const extractorPrice = {
      prompt: parseFloat(extractor?.promptPrice || "0.0000001"),
      completion: parseFloat(extractor?.completionPrice || "0.0000004"),
    };

    let upfrontHoldUsd = (basePromptTokens + 2000) * hardenerPrice.prompt + 1500 * hardenerPrice.completion;
    if (includeToolRecommendation) {
      upfrontHoldUsd += (basePromptTokens + 2000) * extractorPrice.prompt + 1500 * extractorPrice.completion;
    }
    const upfrontHold = Math.ceil(upfrontHoldUsd * 1000000 * 1.15); // 15% safety buffer

    const userBefore = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, scanTokens: true },
    });

    if (!userBefore || userBefore.scanTokens < upfrontHold) {
      return NextResponse.json(
        {
          error: "insufficient_scan_tokens",
          message: `This operation requires an upfront hold of ${upfrontHold} tokens. You have ${userBefore?.scanTokens ?? 0}.`,
          required: upfrontHold,
          available: userBefore?.scanTokens ?? 0,
        },
        { status: 402 },
      );
    }

    // Deduct upfront hold tokens
    await db.user.update({
      where: { id: session.user.id },
      data: { scanTokens: { decrement: upfrontHold } },
    });
    // ─────────────────────────────────────────────────────────────────────────

    const dbModel = await db.model.findUnique({ where: { id: modelId } });
    const modelName = dbModel?.name || modelId.split("/").pop() || modelId;

    const trace: HardeningTrace = {};

    const trials = scanRow.trials ? JSON.parse(scanRow.trials) : [];
    const breachedAttacks = trials
      .filter((t: any) => t.verdict === TrialVerdict.Breached)
      .map((t: any) => ({
        attack: t.attack,
        judgeReasoning: t.judgeVerdict,
        verdict: t.verdict,
      }));
    const mockToolResponses = scanRow.mockToolResponses
      ? JSON.parse(scanRow.mockToolResponses)
      : {};

    const tracker: UsageTracker = {
      totalCost: 0,
      dbModels,
    };

    // Use the shared hardening workflow
    const existingTools = scanRow.tools
      ? (JSON.parse(scanRow.tools) as ToolDef[])
      : [];

    let metadata = scanRow.metadata ? JSON.parse(scanRow.metadata) : {};

    // Generate attack pattern summary if missing and breaches exist
    if (!metadata.attackSummary?.summarizedPatterns && breachedAttacks.length > 0) {
      try {
        const summaryText = await summarizeBreachedAttacks(async (promptText) => {
          const response = await callOpenRouter(modelId, [
            { role: "user", content: promptText },
          ], undefined, tracker);
          return response.content || "";
        }, breachedAttacks);

        metadata.attackSummary = {
          summarizedPatterns: summaryText,
          breachedAttacks,
          summarizedAt: new Date().toISOString(),
        };

        // Cache it in the database scan record
        await db.scan.update({
          where: { id: scanRow.id },
          data: { metadata: JSON.stringify(metadata) },
        });
      } catch (err) {
        console.error("Failed to generate dynamic attack summary during hardening:", err);
      }
    }

    const hardeningResult = await generateHardenedPrompt(
      {
        systemPrompt: scanRow.systemPrompt,
        forbiddenTask: scanRow.forbiddenTask,
        breachedAttacks,
        tools: existingTools,
        mockToolResponses,
        granularity,
        extractorModel,
        hardenerModel: modelId,
        metadata,
        trials,
        trace,
        includeToolRecommendation,
        tracker,
      },
      async (promptText) => {
        const response = await callOpenRouter(modelId, [
          { role: "user", content: promptText },
        ], undefined, tracker);
        return response.content || "";
      },
    );

    const promptTextToExtract = hardeningResult.hardenedPrompt;
    const toolRecommendation = hardeningResult.toolRecommendation;
    const compatibilityScore = hardeningResult.compatibilityScore;

    // Always create a new record (no unique constraint on scanId+modelId anymore)
    const saved = await db.hardenedPrompt.create({
      data: {
        scanId: scanRow.id,
        modelId,
        modelName,
        prompt: promptTextToExtract,
        toolRecommendation,
        compatibilityScore,
        granularity,
        extractorModel,
      },
    });

    let recObj: any = null;
    if (saved.toolRecommendation) {
      try {
        recObj = JSON.parse(saved.toolRecommendation);
      } catch {}
    }

    const { finalTokenCost, refund } = await processRefund(
      session.user.id,
      upfrontHold,
      tracker,
      db,
      "harden",
    );

    // Fetch updated balance to return in response
    const userAfter = await db.user.findUnique({
      where: { id: session.user.id },
      select: { scanTokens: true },
    });

    return NextResponse.json({
      id: saved.id,
      originalPrompt: scanRow.systemPrompt,
      hardenedPrompt: saved.prompt,
      modelId: saved.modelId,
      modelName: saved.modelName,
      toolRecommendation: recObj,
      compatibilityScore: saved.compatibilityScore,
      granularity: saved.granularity,
      extractorModel: saved.extractorModel,
      trace,
      tokenCost: finalTokenCost,
      tokensRefunded: refund,
      scanTokensRemaining: userAfter?.scanTokens ?? 0,
    });
  } catch (error: any) {
    console.error("Error generating/updating hardened prompt:", error);
    return new Response("Error generating/updating hardened prompt", {
      status: 500,
    });
  }
}
