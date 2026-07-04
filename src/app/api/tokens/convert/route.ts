import { NextResponse } from "next/server";

export async function POST(req: Request) {
  return NextResponse.json(
    {
      error: "deprecated",
      message: "Token conversion is no longer supported because all token pools are unified into a single scanTokens pool.",
    },
    { status: 410 },
  );
}
