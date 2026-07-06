import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { getScanByReportId, deleteScan } from "@/lib/scan-db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scan = await getScanByReportId(id, user.userId);
    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json({ scan });
  } catch (error: any) {
    console.error("Error fetching scan details:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deleted = await deleteScan(id, user.userId);
    if (!deleted) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting scan:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

