import { NextResponse } from "next/server";
import {
  getCachedDbModels,
  findDefaultModelFromCache,
} from "@/lib/models-cache";
import { FALLBACK_DEFAULT_MODEL } from "@/lib/model-utils";

export async function GET() {
  try {
    await getCachedDbModels();
    const modelId = findDefaultModelFromCache(FALLBACK_DEFAULT_MODEL);
    return NextResponse.json({
      modelId,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching default model:", error);
    return NextResponse.json(
      { modelId: FALLBACK_DEFAULT_MODEL, fetchedAt: new Date().toISOString() },
      { status: 200 },
    );
  }
}
