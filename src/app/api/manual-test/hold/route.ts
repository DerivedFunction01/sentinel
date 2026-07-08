import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getCachedDbModels } from "@/lib/models-cache";
import { estimateMessagesTokens, getModelPricing, estimateTokens } from "@/lib/token-utils";

export async function POST(req: Request) {
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

  const { messages, targetModel, systemPrompt, tools } = await req.json().catch(() => ({}));

  if (!targetModel) {
    return NextResponse.json({ error: "Target model is required" }, { status: 400 });
  }

  const dbModels = await getCachedDbModels();
  const pricing = getModelPricing(targetModel, dbModels);

  // Calculate message tokens
  let promptTokens = estimateMessagesTokens(messages || []);
  if (systemPrompt) {
    promptTokens += estimateTokens(systemPrompt);
  }
  if (tools) {
    promptTokens += estimateTokens(typeof tools === "string" ? tools : JSON.stringify(tools));
  }

  // Calculate upfront hold: prompt tokens + buffer for response completions
  const completionBuffer = 512;
  const rawHold = (promptTokens * pricing.prompt + completionBuffer * pricing.completion) * 1000000;
  const hold = Math.ceil(rawHold * 1.15); // 15% safety buffer

  if (user.scanTokens < hold) {
    return NextResponse.json(
      { error: `Insufficient tokens. You need ${hold} tokens for this action, but have ${user.scanTokens}.` },
      { status: 403 }
    );
  }

  // Deduct hold tokens
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: { scanTokens: { decrement: hold } },
    select: { scanTokens: true },
  });

  return NextResponse.json({
    success: true,
    holdAmount: hold,
    scanTokensRemaining: updatedUser.scanTokens,
  });
}
