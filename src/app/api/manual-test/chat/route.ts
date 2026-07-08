import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { callOpenRouterStream } from "@/lib/model-utils";

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { model, messages, tools, reasoning } = await req.json().catch(() => ({}));

  if (!model || !messages) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const streamResponse = await callOpenRouterStream(model, messages, tools, reasoning);

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      return NextResponse.json(
        { error: `OpenRouter API error: ${errorText}` },
        { status: streamResponse.status }
      );
    }

    // Return the stream back to the client directly
    return new Response(streamResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Manual test chat stream error:", error);
    return NextResponse.json({ error: error.message || "Failed to call model" }, { status: 500 });
  }
}
