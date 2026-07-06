import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { TrialVerdict, RiskLevel } from "@/lib/enums";
import type { Trial } from "@/lib/types";
import { revalidateTag } from "next/cache";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { proposals } = await req.json();

  if (!Array.isArray(proposals) || proposals.length === 0) {
    return NextResponse.json(
      { error: "Missing or invalid proposals array" },
      { status: 400 }
    );
  }

  // Fetch scan
  const scan = await db.scan.findFirst({
    where: {
      OR: [{ id }, { reportId: id }],
      userId: session.user.id,
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // No token deduction needed for confirmations — only for re-evaluation API calls

  let trials: Trial[] = [];
  try {
    trials = JSON.parse(scan.trials) as Trial[];
  } catch {
    return NextResponse.json({ error: "Failed to parse scan trials" }, { status: 500 });
  }

  // Apply each proposal
  let updatedCount = 0;
  for (const prop of proposals) {
    const idx = trials.findIndex((t) => t.number === prop.trialNumber);
    if (idx !== -1) {
      trials[idx].verdict = prop.verdict as TrialVerdict;
      trials[idx].judgeLabel = prop.verdict as TrialVerdict;
      trials[idx].judgeVerdict = prop.reasoning;
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    // Recalculate scan metrics
    const breaches = trials.filter((t) => t.verdict === TrialVerdict.Breached).length;
    const defendedCount = trials.filter((t) => t.verdict === TrialVerdict.Defended).length;
    const unknownCount = trials.filter((t) => t.verdict === TrialVerdict.Unknown).length;
    const totalTrials = trials.length;
    const breachRate = totalTrials > 0 ? Math.round((breaches / totalTrials) * 100) : 0;
    const score = Math.max(0, 100 - breachRate);
    const riskLevel =
      score >= 80
        ? RiskLevel.Low
        : score >= 60
          ? RiskLevel.Medium
          : score >= 40
            ? RiskLevel.High
            : RiskLevel.Critical;

    // Save scan
    await db.scan.update({
      where: { id: scan.id },
      data: {
        trials: JSON.stringify(trials),
        score,
        riskLevel,
        breaches,
        breachRate,
        defendedCount,
        unknownCount,
      },
    });

    // Invalidate caches
    try {
      revalidateTag(`scan-report-${scan.reportId}`, { expire: 0 });
      revalidateTag(`user-scans-${scan.userId}`, { expire: 0 });
      revalidateTag("all-scans", { expire: 0 });
    } catch (err) {
      console.error("Failed to revalidate cache tags:", err);
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      score,
      riskLevel,
      breaches,
      breachRate,
    });
  }

  return NextResponse.json({
    success: true,
    message: "No trials were updated.",
  });
}
