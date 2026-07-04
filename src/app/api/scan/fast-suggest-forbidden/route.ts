import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { suggestForbiddenTasks } from "@/lib/seed-extractor";
import { FALLBACK_DEFAULT_MODEL, type UsageTracker } from "@/lib/model-utils";
import { getCachedDbModels, findDefaultModelFromCache } from "@/lib/models-cache";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  // Authenticate user
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure cache is populated before synchronous fallback lookup
    const dbModels = await getCachedDbModels(db) as any[];
    const { systemPrompt, extractorModel = findDefaultModelFromCache(FALLBACK_DEFAULT_MODEL) } = await req.json();

    if (!systemPrompt || !systemPrompt.trim()) {
      return NextResponse.json(
        { error: "System prompt is required" },
        { status: 400 },
      );
    }

    const { estimateTokens } = await import("@/lib/token-utils");

    const extractor = dbModels.find(m => m.id === extractorModel);
    const extractorPrice = {
      prompt: parseFloat(extractor?.promptPrice || "0.0000001"),
      completion: parseFloat(extractor?.completionPrice || "0.0000004"),
    };

    const inputTokens = estimateTokens(systemPrompt) + 500; // include template estimate
    const upfrontHold = Math.ceil((inputTokens * extractorPrice.prompt + 300 * extractorPrice.completion) * 1000000 * 1.15);

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

    const forbiddenTasks = await suggestForbiddenTasks(
      extractorModel,
      systemPrompt,
      tracker,
    );

    // Refund unused hold
    const finalTokenCost = Math.ceil(tracker.totalCost * 1000000);
    const refund = upfrontHold - finalTokenCost;

    await db.user.update({
      where: { id: authUser.userId },
      data: { scanTokens: { increment: refund } },
    });

    return NextResponse.json({
      success: true,
      forbiddenTasks,
    });
  } catch (error: any) {
    console.error("Error in fast-suggest-forbidden:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse prompt" },
      { status: 500 },
    );
  }
}
