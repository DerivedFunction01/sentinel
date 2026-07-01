import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { getUserScans } from "@/lib/scan-db";

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
