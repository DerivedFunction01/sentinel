import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { resolveExternalToolCall } from "@/lib/scan-pipeline";

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, arguments: args, mockResult } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
    }

    const resolved = await resolveExternalToolCall(name, args || {}, mockResult);

    return NextResponse.json({ resolved });
  } catch (error: any) {
    console.error("Error resolving tool response:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve tool" }, { status: 500 });
  }
}
