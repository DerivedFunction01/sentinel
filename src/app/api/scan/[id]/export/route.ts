import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScanByReportId } from "@/lib/scan-db";
import { generateScanReport } from "@/lib/docx-generator";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reportId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const scan = await getScanByReportId(reportId, session.user.id);
    if (!scan) {
      return new Response("Scan not found", { status: 404 });
    }

    const urlObj = new URL(req.url);
    const promptsParam = urlObj.searchParams.get("prompts");
    const selectedPromptIds = promptsParam
      ? promptsParam.split(",")
      : undefined;

    const buffer = await generateScanReport(scan, undefined, selectedPromptIds);

    const cleanModelName = scan.targetModel
      .replace(/\//g, "-")
      .replace(/[^a-zA-Z0-9\-\.]/g, "");
    const breachRateStr = `${scan.breachRate}pct`;
    const filename = `scan-report-${cleanModelName}-${breachRateStr}-${reportId}.docx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating report export:", error);
    return new Response("Error generating export", { status: 500 });
  }
}
