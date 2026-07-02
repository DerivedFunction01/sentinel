import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { getUserScans, deleteScans, deleteAllScans } from "@/lib/scan-db";

export async function GET(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scans = await getUserScans(user.userId);
    return NextResponse.json({ scans });
  } catch (error: any) {
    console.error("Error fetching scans list:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { ids, all } = body;

    if (all) {
      await deleteAllScans(user.userId);
    } else if (Array.isArray(ids)) {
      await deleteScans(ids, user.userId);
    } else {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting scans:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

