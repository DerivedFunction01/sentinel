import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { gzipSync } from "zlib";

/**
 * GET /api/scans/export
 *
 * Exports all of the current user's scans as a gzipped JSONL file.
 * Each line is a JSON object with the full scan record (including trials,
 * tools, mock responses as parsed JSON — not stringified).
 *
 * The response is a .jsonl.gz download.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scans = await db.scan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  // Build JSONL — one JSON object per line, with parsed JSON fields.
  const lines = scans.map((scan) =>
    JSON.stringify({
      reportId: scan.reportId,
      targetModel: scan.targetModel,
      systemPrompt: scan.systemPrompt,
      forbiddenTask: scan.forbiddenTask,
      judgeInstructions: scan.judgeInstructions,
      tools: JSON.parse(scan.tools),
      mockToolResponses: JSON.parse(scan.mockToolResponses),
      trials: JSON.parse(scan.trials),
      score: scan.score,
      riskLevel: scan.riskLevel,
      totalTrials: scan.totalTrials,
      breaches: scan.breaches,
      breachRate: scan.breachRate,
      summary: scan.summary,
      summaryDetail: scan.summaryDetail,
      status: scan.status,
      createdAt: scan.createdAt.toISOString(),
    }),
  );
  const jsonl = lines.join("\n");
  const gzipped = gzipSync(jsonl);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `ToolRegistry-scans-${date}.jsonl.gz`;

  return new NextResponse(gzipped, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
