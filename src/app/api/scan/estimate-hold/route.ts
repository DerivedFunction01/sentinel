import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { getCachedDbModels } from "@/lib/models-cache";
import { estimateTokens } from "@/lib/token-utils";

/**
 * A single pricing item used to calculate an upfront token hold.
 * The total cost is: sum of (tokens * modelRate * multiplier) for each item.
 */
export interface CostEstimationItem {
  /** Model ID to look up pricing for */
  modelId: string;
  /** Whether to use the prompt or completion price for this item */
  type: "prompt" | "completion";
  /** Text to tokenize server-side using tiktoken (takes priority over tokensCount) */
  text?: string;
  /** Pre-computed or static token count (used when text is not provided) */
  tokensCount?: number;
  /**
   * Additional pre-computed token count added on top of the tokenized `text`.
   * Useful for encoding stable template overhead (system prompts, few-shot examples, etc.)
   * so the client only needs to tokenize the dynamic user content server-side.
   */
  additionalTokens?: number;
  /** Quantity multiplier — e.g. number of trials (default: 1) */
  multiplier?: number;
}

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const items: CostEstimationItem[] = Array.isArray(body.items)
    ? body.items
    : [];

  if (items.length === 0) {
    return NextResponse.json({ success: true, upfrontHold: 0 });
  }

  const dbModels = await getCachedDbModels();

  let totalCostUsd = 0;

  for (const item of items) {
    const model = dbModels.find((m) => m.id === item.modelId);
    const rate =
      item.type === "prompt"
        ? parseFloat(model?.promptPrice || "0.0000001")
        : parseFloat(model?.completionPrice || "0.0000004");

    const baseTokens =
      item.text !== undefined && item.text !== null
        ? estimateTokens(item.text)
        : item.tokensCount ?? 0;
    const tokens = baseTokens + (item.additionalTokens ?? 0);

    const multiplier = item.multiplier ?? 1;
    totalCostUsd += tokens * rate * multiplier;
  }

  // Scale to internal token units (1 token = $0.000001 USD) + 15% buffer
  const upfrontHold = Math.ceil(totalCostUsd * 1_000_000 * 1.15);

  return NextResponse.json({ success: true, upfrontHold });
}
