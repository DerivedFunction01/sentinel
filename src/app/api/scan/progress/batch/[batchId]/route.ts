import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { ProgressStepStatus, ScanStatus } from "@/lib/enums";
import { getScanProgress } from "@/lib/scan-progress-cache";

interface AttackSummary {
  attackCount: number;
  completedAttacks: number;
  completedTargets: number;
  completedJudges: number;
}

interface ProgressDetail {
  seed: string;
  attacks: Array<{
    idx: number;
    status: ProgressStepStatus;
    retries: number;
  }>;
  trials: Array<{
    idx: number;
    target: {
      status: ProgressStepStatus;
      retries: number;
    };
    judge: {
      status: ProgressStepStatus;
      retries: number;
    };
  }>;
  hardening: string;
  summary: AttackSummary;
}

interface ScanProgressEstimates {
  estimatedCurrentStep: number;
  estimatedTotalSteps: number;
}

function parseDetail(meta: string | null): ProgressDetail | null {
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
}

function estimateCurrentStep(
  detail: ProgressDetail | null,
  rawTotalSteps: number,
): number {
  if (!detail) return 0;
  const attackCount = detail.summary.attackCount;
  if (attackCount === 0) return 0;

  const hasGenerationPhase = rawTotalSteps === attackCount * 3;
  if (hasGenerationPhase) {
    const generationCompleted =
      detail.summary.completedAttacks === attackCount &&
      detail.seed === ProgressStepStatus.Completed;
    return (
      (generationCompleted ? attackCount : 0) +
      detail.summary.completedTargets +
      detail.summary.completedJudges
    );
  }

  return detail.summary.completedTargets + detail.summary.completedJudges;
}

function estimateTotalSteps(
  detail: ProgressDetail | null,
  rawTotalSteps: number,
): number {
  if (!detail) return rawTotalSteps || 1;
  const attackCount = detail.summary.attackCount;
  if (attackCount === 0) return rawTotalSteps || 1;
  if (rawTotalSteps === attackCount * 3) return rawTotalSteps;
  return detail.summary.attackCount * 2 || rawTotalSteps || 1;
}

/**
 * GET /api/scan/progress/batch/[batchId]
 * Returns aggregated progress for all scans sharing a batchId.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const totalScans = scans.length;
    const completedScans = scans.filter(
      (s) =>
        s.status === ScanStatus.Completed ||
        s.status === ScanStatus.CompletedWithFailures,
    ).length;
    const failedScans = scans.filter(
      (s) => s.status === ScanStatus.Failed,
    ).length;
    const runningScans = scans.filter(
      (s) => s.status === ScanStatus.Running,
    ).length;

    let totalCurrent = 0;
    let totalTotal = 0;
    for (const s of scans) {
      // Override DB values with in-memory cache (live progress during active scans)
      const cached = getScanProgress(s.reportId);
      const effectiveProgressMeta = cached?.progressMeta ?? s.progressMeta;
      const detail = parseDetail(effectiveProgressMeta);
      totalCurrent += estimateCurrentStep(detail, s.totalSteps || 0);
      totalTotal += estimateTotalSteps(detail, s.totalSteps || 0);
    }
    const overallProgress =
      totalTotal > 0
        ? Math.min(Math.round((totalCurrent / totalTotal) * 100), 100)
        : 0;

    const completedList = scans.filter(
      (s) =>
        s.status === ScanStatus.Completed ||
        s.status === ScanStatus.CompletedWithFailures,
    );

    let batchStatus = ScanStatus.Running;
    if (completedScans === totalScans) {
      batchStatus = ScanStatus.Completed;
    } else if (failedScans > 0 && completedScans + failedScans === totalScans) {
      batchStatus = ScanStatus.CompletedWithFailures;
    } else if (failedScans > 0) {
      batchStatus = ScanStatus.PartialFailure;
    }

    const scanList: Array<{
      reportId: string;
      targetModel: string;
      promptIndex: number;
      status: ScanStatus;
      currentStep: number;
      estimatedCurrentStep: number;
      totalSteps: number;
      estimatedTotalSteps: number;
      score: number;
      breaches: number;
      totalTrials: number;
      breachRate: number;
      summary: string;
      summaryDetail: string;
      detail: ProgressDetail | null;
    }> = [];
    for (const s of scans) {
      // Override DB values with in-memory cache (live progress during active scans)
      const cached = getScanProgress(s.reportId);
      const effectiveProgressMeta = cached?.progressMeta ?? s.progressMeta;
      const effectiveCurrentStep = cached?.currentStep ?? s.currentStep;
      const detail = parseDetail(effectiveProgressMeta);
      const estimates: ScanProgressEstimates = {
        estimatedCurrentStep: estimateCurrentStep(detail, s.totalSteps || 0),
        estimatedTotalSteps: estimateTotalSteps(detail, s.totalSteps || 0),
      };
      scanList.push({
        reportId: s.reportId,
        targetModel: s.targetModel,
        promptIndex: s.promptIndex,
        status: s.status as ScanStatus,
        currentStep: effectiveCurrentStep,
        estimatedCurrentStep: estimates.estimatedCurrentStep,
        totalSteps: s.totalSteps,
        estimatedTotalSteps: estimates.estimatedTotalSteps,
        score: s.score,
        breaches: s.breaches,
        totalTrials: s.totalTrials,
        breachRate: s.breachRate,
        summary: s.summary,
        summaryDetail: s.summaryDetail,
        detail,
      });
    }

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
