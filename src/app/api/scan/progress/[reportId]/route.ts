import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { ProgressStepStatus } from "@/lib/enums";
import { getScanProgress } from "@/lib/scan-progress-cache";

/**
 * GET /api/scan/progress/[reportId]
 * Returns the current progress of a scan identified by reportId.
 * Reads from in-memory cache first (for live progress during active scans),
 * falls back to DB values on cache miss.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await params;

  if (!reportId) {
    return NextResponse.json(
      { error: "Report ID is required" },
      { status: 400 },
    );
  }

  try {
    const scan = await db.scan.findUnique({
      where: { reportId },
      select: {
        id: true,
        reportId: true,
        status: true,
        currentStep: true,
        totalSteps: true,
        totalTrials: true,
        breaches: true,
        score: true,
        createdAt: true,
        progressMeta: true,
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    // Check in-memory cache for live progress (overrides DB values during active scans)
    const cached = getScanProgress(reportId);
    const effectiveCurrentStep = cached?.currentStep ?? scan.currentStep;
    const effectiveProgressMeta = cached?.progressMeta ?? scan.progressMeta;

    // Calculate progress percentage
    const progress =
      scan.totalSteps > 0
        ? Math.round((effectiveCurrentStep / scan.totalSteps) * 100)
        : 0;

    // Parse granular progress meta
    let detail = {};
    if (effectiveProgressMeta) {
      try {
        const meta = JSON.parse(effectiveProgressMeta);
        const attackCount = meta.attacks?.length || 0;
        const completedAttacks =
          meta.attacks?.filter(
            (a: any) => a.status === ProgressStepStatus.Completed,
          ).length || 0;
        const completedTargets =
          meta.trials?.filter(
            (t: any) => t.target?.status === ProgressStepStatus.Completed,
          ).length || 0;
        const completedJudges =
          meta.trials?.filter(
            (t: any) => t.judge?.status === ProgressStepStatus.Completed,
          ).length || 0;
        detail = {
          seed: meta.seed?.status || ProgressStepStatus.Pending,
          attacks:
            meta.attacks?.map((a: any, i: number) => ({
              idx: i,
              status: a.status,
              retries: a.retries || 0,
            })) || [],
          trials:
            meta.trials?.map((t: any, i: number) => ({
              idx: i,
              target: {
                status: t.target?.status || ProgressStepStatus.Pending,
                retries: t.target?.retries || 0,
              },
              judge: {
                status: t.judge?.status || ProgressStepStatus.Pending,
                retries: t.judge?.retries || 0,
              },
            })) || [],
          hardening: meta.hardening?.status || ProgressStepStatus.Pending,
          summary: {
            attackCount,
            completedAttacks,
            completedTargets,
            completedJudges,
          },
        };
      } catch {
        // ignore parse errors
      }
    }

    return NextResponse.json({
      reportId: scan.reportId,
      status: scan.status,
      currentStep: effectiveCurrentStep,
      totalSteps: scan.totalSteps,
      progress,
      totalTrials: scan.totalTrials,
      breaches: scan.breaches,
      score: scan.score,
      createdAt: scan.createdAt,
      detail,
    });
  } catch (error) {
    console.error("Error fetching scan progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch scan progress" },
      { status: 500 },
    );
  }
}
