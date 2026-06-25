import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ProgressStepStatus, ScanStatus } from "@/lib/enums";

/**
 * GET /api/scan/progress/batch/[batchId]
 * Returns aggregated progress for all scans sharing a batchId.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;

  if (!batchId) {
    return NextResponse.json(
      { error: "Batch ID is required" },
      { status: 400 },
    );
  }

  try {
    const scans = await db.scan.findMany({
      where: { batchId },
      select: {
        reportId: true,
        targetModel: true,
        promptIndex: true,
        status: true,
        currentStep: true,
        totalSteps: true,
        score: true,
        breaches: true,
        totalTrials: true,
        breachRate: true,
        summary: true,
        summaryDetail: true,
        createdAt: true,
        progressMeta: true,
      },
      orderBy: [{ promptIndex: "asc" }, { createdAt: "asc" }],
    });

    if (scans.length === 0) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Compute aggregate statistics
    const totalScans = scans.length;
    const completedScans = scans.filter(
      (s) => s.status === ScanStatus.Completed,
    ).length;
    const failedScans = scans.filter(
      (s) => s.status === ScanStatus.Failed,
    ).length;
    const runningScans = scans.filter(
      (s) => s.status === ScanStatus.Running,
    ).length;

    // Aggregate progress across all scans
    let totalCurrent = 0;
    let totalTotal = 0;
    for (const s of scans) {
      totalCurrent += s.currentStep || 0;
      totalTotal += s.totalSteps || 1; // avoid division by zero
    }
    const overallProgress =
      totalTotal > 0
        ? Math.min(Math.round((totalCurrent / totalTotal) * 100), 100)
        : 0;

    // Aggregate score and breaches across completed scans
    const completedList = scans.filter(
      (s) => s.status === ScanStatus.Completed,
    );

    // Determine overall batch status
    let batchStatus = ScanStatus.Running;
    if (completedScans === totalScans) {
      batchStatus = ScanStatus.Completed;
    } else if (failedScans > 0 && completedScans + failedScans === totalScans) {
      batchStatus = ScanStatus.CompletedWithFailures;
    } else if (failedScans > 0) {
      batchStatus = ScanStatus.PartialFailure;
    }

    // Parse granular progress detail per scan
    const parseDetail = (meta: string | null) => {
      if (!meta) return null;
      try {
        const parsed = JSON.parse(meta);
        const attacks = (parsed.attacks || []).map((a: any, i: number) => ({
          idx: i,
          status: a.status || ProgressStepStatus.Pending,
          retries: a.retries || 0,
        }));
        const trials = (parsed.trials || []).map((t: any, i: number) => ({
          idx: i,
          target: {
            status: t.target?.status || ProgressStepStatus.Pending,
            retries: t.target?.retries || 0,
          },
          judge: {
            status: t.judge?.status || ProgressStepStatus.Pending,
            retries: t.judge?.retries || 0,
          },
        }));
        return {
          seed: parsed.seed?.status || ProgressStepStatus.Pending,
          attacks,
          trials,
          hardening: parsed.hardening?.status || ProgressStepStatus.Pending,
          summary: {
            attackCount: attacks.length,
            completedAttacks: attacks.filter(
              (a: any) => a.status === ProgressStepStatus.Completed,
            ).length,
            completedTargets: trials.filter(
              (t: any) => t.target.status === ProgressStepStatus.Completed,
            ).length,
            completedJudges: trials.filter(
              (t: any) => t.judge.status === ProgressStepStatus.Completed,
            ).length,
          },
        };
      } catch {
        return null;
      }
    };

    // Map scans to a serializable format
    const scanList = scans.map((s) => ({
      reportId: s.reportId,
      targetModel: s.targetModel,
      promptIndex: s.promptIndex,
      status: s.status,
      currentStep: s.currentStep,
      totalSteps: s.totalSteps,
      score: s.score,
      breaches: s.breaches,
      totalTrials: s.totalTrials,
      breachRate: s.breachRate,
      summary: s.summary,
      summaryDetail: s.summaryDetail,
      detail: parseDetail(s.progressMeta),
    }));

    return NextResponse.json({
      batchId,
      status: batchStatus,
      totalScans,
      completedScans,
      failedScans,
      runningScans,
      overallProgress,
      scans: scanList,
    });
  } catch (error) {
    console.error("Error fetching batch progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch progress" },
      { status: 500 },
    );
  }
}
