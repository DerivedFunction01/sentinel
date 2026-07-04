import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCachedDbModels } from "@/lib/models-cache";

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

  let models;
  if (q.length >= 2) {
    models = await db.model.findMany({
      where: {
        OR: [
          { id: { contains: q } },
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      orderBy: [{ isRecommended: "desc" }, { popularityRank: "asc" }],
      take: 200, // cap to keep the dropdown snappy
    });
  } else {
    const cached = await getCachedDbModels(db);
    models = cached.slice(0, 200);
  }

  const response = NextResponse.json({
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
      defaultRank: m.defaultRank,
      supportsTools: m.supportsTools,
      isLowCost: m.isLowCost,
      isFree: m.isFree,
      multiplier: m.multiplier,
    })),
  });

  response.headers.set(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate",
  );

  return response;
}
