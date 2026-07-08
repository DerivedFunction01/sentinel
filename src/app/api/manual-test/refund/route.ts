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

  const { messages, targetModel, systemPrompt, tools, mockResponses, holdAmount, responseText } = await req.json().catch(() => ({}));

  if (!targetModel || typeof holdAmount !== "number") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const dbModels = await getCachedDbModels();
  const pricing = getModelPricing(targetModel, dbModels);

  // Calculate message prompt tokens
  let promptTokens = estimateMessagesTokens(messages || []);
  if (systemPrompt) {
    promptTokens += estimateTokens(systemPrompt);
  }
  if (tools) {
    promptTokens += estimateTokens(typeof tools === "string" ? tools : JSON.stringify(tools));
  }
  if (mockResponses) {
    promptTokens += estimateTokens(typeof mockResponses === "string" ? mockResponses : JSON.stringify(mockResponses));
  }

  // Calculate actual completion tokens
  const completionTokens = estimateTokens(responseText || "");

  // Calculate actual cost
  const rawCost = (promptTokens * pricing.prompt + completionTokens * pricing.completion) * 1000000;
  const cost = Math.ceil(rawCost);

  // Compute refund
  const refund = Math.max(0, holdAmount - cost);

  // Credit user's balance with the refund
  const updatedUser = await db.user.update({
    where: { id: authUser.userId },
    data: { scanTokens: { increment: refund } },
    select: { scanTokens: true },
  });

  return NextResponse.json({
    success: true,
    actualCost: cost,
    refundedAmount: refund,
    scanTokensRemaining: updatedUser.scanTokens,
  });
}
