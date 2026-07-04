import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { callOpenRouter, FALLBACK_DEFAULT_MODEL, type UsageTracker } from "@/lib/model-utils";
import { getCachedDbModels, findDefaultModelFromCache } from "@/lib/models-cache";
import { TrialVerdict } from "@/lib/enums";
import { summarizeBreachedAttacks } from "@/lib/scan-pipeline";

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
    });
    if (!scanRow) {
      return new Response("Scan not found", { status: 404 });
    }

    const trials = scanRow.trials ? JSON.parse(scanRow.trials) : [];
    const breachedAttacks = trials
      .filter((t: any) => t.verdict === TrialVerdict.Breached)
      .map((t: any) => ({
        attack: t.attack,
        judgeReasoning: t.judgeVerdict,
        verdict: t.verdict,
      }));

    if (breachedAttacks.length === 0) {
      return NextResponse.json({
        summary: "",
        message: "No breached attacks found for this scan.",
      });
    }

    const dbModels = await getCachedDbModels(db) as any[];
    const hardenerModel = scanRow.hardenerModel || findDefaultModelFromCache(FALLBACK_DEFAULT_MODEL);

    // Calculate dynamic upfront hold
    const { estimateTokens } = await import("@/lib/token-utils");

    const hardener = dbModels.find(m => m.id === hardenerModel);
    const hardenerPrice = {
      prompt: parseFloat(hardener?.promptPrice || "0.0000001"),
      completion: parseFloat(hardener?.completionPrice || "0.0000004"),
    };

    const breachedText = breachedAttacks.map(a => `${a.attack}\nReasoning: ${a.judgeReasoning}`).join("\n\n");
    const inputTokens = estimateTokens(breachedText) + 500;
    const upfrontHold = Math.ceil((inputTokens * hardenerPrice.prompt + 500 * hardenerPrice.completion) * 1000000 * 1.15);

    // Check user balance
    const userBefore = await db.user.findUnique({
      where: { id: session.user.id },
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
      where: { id: session.user.id },
      data: { scanTokens: { decrement: upfrontHold } },
    });

    const tracker: UsageTracker = { totalCost: 0, dbModels };

    const summaryText = await summarizeBreachedAttacks(async (promptText) => {
      const response = await callOpenRouter(hardenerModel, [
        { role: "user", content: promptText },
      ], undefined, tracker);
      return response.content || "";
    }, breachedAttacks);

    const metadata = scanRow.metadata ? JSON.parse(scanRow.metadata) : {};
    metadata.attackSummary = {
      summarizedPatterns: summaryText,
      breachedAttacks,
      summarizedAt: new Date().toISOString(),
    };

    await db.scan.update({
      where: { id: scanRow.id },
      data: {
        metadata: JSON.stringify(metadata),
      },
    });

    // Refund unused portion of hold
    const finalTokenCost = Math.ceil(tracker.totalCost * 1000000);
    const refund = upfrontHold - finalTokenCost;

    await db.user.update({
      where: { id: session.user.id },
      data: { scanTokens: { increment: refund } },
    });

    return NextResponse.json({ summary: summaryText });
  } catch (error: any) {
    console.error("Error summarizing breached attacks:", error);
    return new Response("Error summarizing breached attacks", { status: 500 });
  }
}
