import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/scan/progress/[reportId]
 * Returns the current progress of a scan identified by reportId.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
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
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    // Calculate progress percentage
    const progress =
      scan.totalSteps > 0
        ? Math.round((scan.currentStep / scan.totalSteps) * 100)
        : 0;

    return NextResponse.json({
      reportId: scan.reportId,
      status: scan.status,
      currentStep: scan.currentStep,
      totalSteps: scan.totalSteps,
      progress,
      totalTrials: scan.totalTrials,
      breaches: scan.breaches,
      score: scan.score,
      createdAt: scan.createdAt,
    });
  } catch (error) {
    console.error("Error fetching scan progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch scan progress" },
      { status: 500 },
    );
  }
}
