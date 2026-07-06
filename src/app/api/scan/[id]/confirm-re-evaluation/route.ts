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
  const { trialNumber, verdict, reasoning } = await req.json();

  if (typeof trialNumber !== "number" || !verdict || !reasoning) {
    return NextResponse.json(
      { error: "Missing trialNumber, verdict, or reasoning" },
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

  let trials: Trial[] = [];
  try {
    trials = JSON.parse(scan.trials) as Trial[];
  } catch {
    return NextResponse.json({ error: "Failed to parse scan trials" }, { status: 500 });
  }

  const targetTrialIndex = trials.findIndex((t) => t.number === trialNumber);
  if (targetTrialIndex === -1) {
    return NextResponse.json({ error: "Trial not found" }, { status: 404 });
  }

  // Update trial details
  const targetTrial = trials[targetTrialIndex];
  targetTrial.verdict = verdict as TrialVerdict;
  targetTrial.judgeLabel = verdict as TrialVerdict;
  targetTrial.judgeVerdict = reasoning;

  // Recalculate scan totals
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
    score,
    riskLevel,
    breaches,
    breachRate,
  });
}
