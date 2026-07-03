import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncModels } from "../../../../../prisma/sync-models-impl";

/**
 * GET /api/cron/models
 *
 * Cron job endpoint to fetch and sync the latest OpenRouter models.
 * Protected by CRON_SECRET authentication.
 *
 * Vercel will call this endpoint automatically on the configured schedule.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Authentication check
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    console.log("[Cron] Starting weekly OpenRouter model sync...");
    await syncModels(db);
    console.log("[Cron] Model sync completed successfully.");
    return NextResponse.json({
      ok: true,
      message: "Model sync completed successfully",
    });
  } catch (error) {
    console.error("[Cron] Model sync failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
