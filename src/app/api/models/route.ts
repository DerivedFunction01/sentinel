import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/models?q=<search>
 *
 * Returns all models from the DB. If a search query is provided (2+ chars),
 * filters by name/id/description (case-insensitive). Recommended models are
 * always returned first.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() || "";

  const where = q.length >= 2
    ? {
        OR: [
          { id: { contains: q } },
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      }
    : {};

  const models = await db.model.findMany({
    where,
    orderBy: [{ isRecommended: "desc" }, { popularityRank: "asc" }],
    take: 200, // cap to keep the dropdown snappy
  });

  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      contextLength: m.contextLength,
      modality: m.modality,
      promptPrice: m.promptPrice,
      completionPrice: m.completionPrice,
      isRecommended: m.isRecommended,
      aiSuggest: m.aiSuggest,
      popularityRank: m.popularityRank,
      supportsTools: m.supportsTools,
      isLowCost: m.isLowCost,
      isFree: m.isFree,
    })),
  });
}
