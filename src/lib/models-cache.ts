/**
 * Server-side in-memory cache for model data.
 *
 * API routes call `getDefaultModelFallback(db)` instead of hitting the database
 * on every request. The cache is invalidated after `sync-models-impl.ts` runs
 * (weekly cron) by calling `invalidateModelsCache()`.
 *
 * TTL: 1 hour — stale data is tolerable because models change infrequently.
 */

import type { Model } from "../../generated/prisma/client";

let cachedModels: Model[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Return cached dbModels (or fetch + cache on first call / after TTL expiry).
 */
export async function getCachedDbModels(db: any): Promise<Model[]> {
  const now = Date.now();
  if (!cachedModels || now - cacheTimestamp > CACHE_TTL_MS) {
    cachedModels = await db.model.findMany({
      orderBy: [{ isRecommended: "desc" }, { popularityRank: "asc" }],
    });
    cacheTimestamp = now;
  }
  return cachedModels!;
}

/**
 * Return the fallback model ID computed from the cached model list.
 * Uses the server-rated `defaultRank` from sync-models-impl.ts.
 */
export function findDefaultModelFromCache(fallback: string): string {
  if (!cachedModels || cachedModels.length === 0) return fallback;
  const ranked = cachedModels
    .filter((m) => m.defaultRank != null && m.defaultRank > 0)
    .sort((a, b) => a.defaultRank! - b.defaultRank!);
  return ranked[0]?.id ?? fallback;
}

/**
 * Clear the cache so the next call to getCachedDbModels re-fetches.
 */
export function invalidateModelsCache(): void {
  cachedModels = null;
  cacheTimestamp = 0;
}
