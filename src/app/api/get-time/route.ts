import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
  });
}

// Support GET for session-based testing from browser directly
export async function GET(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
  });
}
