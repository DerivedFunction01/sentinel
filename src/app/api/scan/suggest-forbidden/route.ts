import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { FALLBACK_DEFAULT_MODEL, type UsageTracker } from "@/lib/model-utils";
import {
  getCachedDbModels,
  findDefaultModelFromCache,
} from "@/lib/models-cache";
import { db } from "@/lib/db";
import { extractSeedInfo } from "@/lib/seed-extractor";
import { processRefund } from "@/lib/token-utils";

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure cache is populated before synchronous fallback lookup
    const dbModels = (await getCachedDbModels(db)) as any[];
    const body = await req.json().catch(() => ({}));
    const {
      systemPrompt = "",
      tools = "[]",
      mockResponses = "{}",
      extractorModel = findDefaultModelFromCache(FALLBACK_DEFAULT_MODEL),
      forbiddenTask = "",
    } = body;

    const { estimateTokens } = await import("@/lib/token-utils");

    const extractor = dbModels.find((m) => m.id === extractorModel);
    const extractorPrice = {
      prompt: parseFloat(extractor?.promptPrice || "0.0000001"),
      completion: parseFloat(extractor?.completionPrice || "0.0000004"),
    };

    const sysPromptTokens = estimateTokens(systemPrompt || "");
    const basePromptTokens =
      sysPromptTokens +
      estimateTokens(forbiddenTask || "") +
      estimateTokens(tools || "");
    const upfrontHold = Math.ceil(
      (basePromptTokens * extractorPrice.prompt +
        1000 * extractorPrice.completion) *
        1000000 *
        1.15,
    );

    // Check user balance
    const userBefore = await db.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, scanTokens: true },
    });

    if (!userBefore || userBefore.scanTokens < upfrontHold) {
      return NextResponse.json(
        {
          error: "insufficient_scan_tokens",
          message: `This operation requires an upfront hold of ${upfrontHold} tokens. You have ${userBefore?.scanTokens ?? 0}.`,
        },
        { status: 402 },
      );
    }

    // Deduct hold
    await db.user.update({
      where: { id: authUser.userId },
      data: { scanTokens: { decrement: upfrontHold } },
    });

    const tracker: UsageTracker = { totalCost: 0, dbModels };

    const seedInfo = await extractSeedInfo(
      extractorModel,
      systemPrompt,
      tools,
      mockResponses,
      forbiddenTask,
      tracker,
    );

    const { finalTokenCost, refund } = await processRefund(
      authUser.userId,
      upfrontHold,
      tracker,
      db,
      "suggest-forbidden",
    );

    return NextResponse.json({
      success: true,
      seedInfo,
      things: seedInfo.things,
      categories: seedInfo.businessCategories,
      scanTokensRemaining: userBefore.scanTokens - finalTokenCost,
    });
  } catch (error: any) {
    console.error("Error in suggest-forbidden API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to suggest forbidden tasks" },
      { status: 500 },
    );
  }
}
