import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { suggestForbiddenTasks } from "@/lib/seed-extractor";
import { FALLBACK_DEFAULT_MODEL } from "@/lib/model-utils";
import { getCachedDbModels, findDefaultModelFromCache } from "@/lib/models-cache";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  // Authenticate user
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure cache is populated before synchronous fallback lookup
    await getCachedDbModels(db);
    const { systemPrompt, extractorModel = findDefaultModelFromCache(FALLBACK_DEFAULT_MODEL) } = await req.json();

    if (!systemPrompt || !systemPrompt.trim()) {
      return NextResponse.json(
        { error: "System prompt is required" },
        { status: 400 },
      );
    }

    const forbiddenTasks = await suggestForbiddenTasks(
      extractorModel,
      systemPrompt,
    );

    return NextResponse.json({
      success: true,
      forbiddenTasks,
    });
  } catch (error: any) {
    console.error("Error in fast-suggest-forbidden:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse prompt" },
      { status: 500 },
    );
  }
}
