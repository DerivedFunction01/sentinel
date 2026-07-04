import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callOpenRouter, FALLBACK_DEFAULT_MODEL } from "@/lib/model-utils";
import { getCachedDbModels, findDefaultModelFromCache } from "@/lib/models-cache";
import { db } from "@/lib/db";
import { TrialVerdict } from "@/lib/enums";
import { type ToolDef, type HardeningTrace } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import { generateHardenedPrompt } from "@/lib/hardening";
import { getDeterministicHardenedPrompt } from "@/lib/scan-prompts";
import { summarizeBreachedAttacks } from "@/lib/scan-pipeline";

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
    const dbModels = await getCachedDbModels(db);
    const defaultModel = findDefaultModelFromCache(FALLBACK_DEFAULT_MODEL);

    const modelId =
      body.modelId ||
      scanRow.judgeModel ||
      scanRow.attackerModel ||
      defaultModel;
    const granularity = body.granularity || Granularity.Compact;
    const extractorModel = body.extractorModel || defaultModel;
    const includeToolRecommendation = body.includeToolRecommendation !== false;

    // ── Token gating ─────────────────────────────────────────────────────────
    // Fast path (hardening only)  → costs 1 hardening token
    // Slow path (+ tool extract)  → costs 3 hardening tokens upfront;
    //                                refund 1 if the LLM extraction loop was skipped
    const tokenCost = includeToolRecommendation ? 3 : 1;

    const userBefore = await db.user.findUnique({
      where: { id: session.user.id },
      select: { hardeningTokens: true },
    });

    if (!userBefore || userBefore.hardeningTokens < tokenCost) {
      return NextResponse.json(
        {
          error: "insufficient_hardening_tokens",
          message: `This operation requires ${tokenCost} hardening token${tokenCost > 1 ? "s" : ""}. You have ${userBefore?.hardeningTokens ?? 0}. Convert scan tokens to hardening tokens first.`,
          required: tokenCost,
          available: userBefore?.hardeningTokens ?? 0,
        },
        { status: 402 },
      );
    }

    // Deduct upfront
    await db.user.update({
      where: { id: session.user.id },
      data: { hardeningTokens: { decrement: tokenCost } },
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
          ]);
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
      },
      async (promptText) => {
        const response = await callOpenRouter(modelId, [
          { role: "user", content: promptText },
        ]);
        return response.content || "";
      },
    );

    const promptTextToExtract = hardeningResult.hardenedPrompt;
    const toolRecommendation = hardeningResult.toolRecommendation;
    const compatibilityScore = hardeningResult.compatibilityScore;

    // ── Conditional refund ───────────────────────────────────────────────────
    // If the slow path was requested but the LLM extraction loop was NOT
    // executed (directMatch fast path inside generateToolRecommendation),
    // refund 1 hardening token back to the user.
    let tokensRefunded = 0;
    if (includeToolRecommendation && !hardeningResult.slowPathHit) {
      tokensRefunded = 1;
      await db.user.update({
        where: { id: session.user.id },
        data: { hardeningTokens: { increment: 1 } },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

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

    // Fetch updated balance to return in response
    const userAfter = await db.user.findUnique({
      where: { id: session.user.id },
      select: { hardeningTokens: true },
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
      tokenCost: tokenCost - tokensRefunded,
      tokensRefunded,
      hardeningTokensRemaining: userAfter?.hardeningTokens ?? 0,
    });
  } catch (error: any) {
    console.error("Error generating/updating hardened prompt:", error);
    return new Response("Error generating/updating hardened prompt", {
      status: 500,
    });
  }
}
