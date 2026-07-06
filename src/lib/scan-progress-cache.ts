/**
 * Server-side in-memory cache for scan progress data.
 *
 * Pipeline steps write progress to this cache instead of the database,
 * reducing DB write load by roughly 3x per scan. API routes read from
 * the cache first and fall back to DB values on cache miss.
 *
 * TTL: 10 minutes — if a scan takes longer than 10 minutes between
 * progress updates, the cache entry expires and the API falls back to
 * the DB (which shows stale but safe coarse progress).
 *
 * Pattern matches src/lib/models-cache.ts.
 */

export interface CachedProgress {
  currentStep: number;
  progressMeta: string | null;
  updatedAt: number;
}

const cache = new Map<string, CachedProgress>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Store scan progress in memory. Overwrites any existing entry.
 */
export function setScanProgress(
  reportId: string,
  data: { currentStep?: number; progressMeta?: string | null },
): void {
  const existing = cache.get(reportId);
  cache.set(reportId, {
    currentStep: data.currentStep ?? existing?.currentStep ?? 0,
    progressMeta:
      data.progressMeta !== undefined
        ? data.progressMeta
        : (existing?.progressMeta ?? null),
    updatedAt: Date.now(),
  });
}

/**
 * Retrieve cached progress for a scan reportId.
 * Returns null if no entry exists or the entry has expired (TTL).
 */
export function getScanProgress(
  reportId: string,
): CachedProgress | null {
  const entry = cache.get(reportId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > CACHE_TTL_MS) {
    cache.delete(reportId);
    return null;
  }
  return entry;
}

/**
 * Remove a scan's cached progress (e.g. after final DB write completes).
 */
export function invalidateScanProgress(reportId: string): void {
  cache.delete(reportId);
}

/**
 * Clear all cached progress entries (for testing or server restart cleanup).
 */
export function clearAllProgress(): void {
  cache.clear();
}