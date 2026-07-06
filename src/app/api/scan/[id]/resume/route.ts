import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProgressStepStatus, ScanStatus } from "@/lib/enums";
import { getCachedDbModels } from "@/lib/models-cache";
import { resumeFromCheckpoint } from "@/lib/scan-pipeline";
import { getScanProgress } from "@/lib/scan-progress-cache";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const scan = await db.scan.findFirst({
    where: { OR: [{ id }, { reportId: id }], userId: session.user.id },
    select: {
      id: true,
      reportId: true,
      status: true,
      progressMeta: true,
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (scan.status !== ScanStatus.Running) {
    return NextResponse.json({ resumed: false, reason: "not_running" });
  }

  const cached = getScanProgress(scan.reportId);
  if (cached && Date.now() - cached.updatedAt < 10 * 60 * 1000) {
    return NextResponse.json({ resumed: false, reason: "still_running" });
  }

  if (!scan.progressMeta) {
    return NextResponse.json({ resumed: false, reason: "no_checkpoint" });
  }

  let meta: any = null;
  try {
    meta = JSON.parse(scan.progressMeta);
  } catch {
    return NextResponse.json({ resumed: false, reason: "invalid_checkpoint" });
  }

  const hasIncompletePhases =
    (meta.attacks || []).some(
      (attack: any) => attack.status !== ProgressStepStatus.Completed,
    ) ||
    (meta.trials || []).some(
      (trial: any) =>
        trial.target?.status !== ProgressStepStatus.Completed ||
        trial.judge?.status !== ProgressStepStatus.Completed,
    );

  if (!hasIncompletePhases) {
    return NextResponse.json({ resumed: false, reason: "already_completed" });
  }

  const dbModels = (await getCachedDbModels(db)) as any[];
  void resumeFromCheckpoint(scan.reportId, dbModels).catch((err) => {
    console.error(`[resume] failed for ${scan.reportId}:`, err);
  });

  return NextResponse.json({ resumed: true });
}
