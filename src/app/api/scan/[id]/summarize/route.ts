import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { callOpenRouter, DEFAULT_MODEL } from "@/lib/model-utils";
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

    const hardenerModel = scanRow.hardenerModel || DEFAULT_MODEL;

    const summaryText = await summarizeBreachedAttacks(async (promptText) => {
      const response = await callOpenRouter(hardenerModel, [
        { role: "user", content: promptText },
      ]);
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

    return NextResponse.json({ summary: summaryText });
  } catch (error: any) {
    console.error("Error summarizing breached attacks:", error);
    return new Response("Error summarizing breached attacks", { status: 500 });
  }
}
