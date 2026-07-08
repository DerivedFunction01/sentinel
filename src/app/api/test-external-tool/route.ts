import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid API Key" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      status: "ok",
      message: "External tool execution simulated successfully!",
      tool: body.tool,
      arguments: body.arguments || {},
      authenticatedUser: authUser.userId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process test request" },
      { status: 500 },
    );
  }
}
