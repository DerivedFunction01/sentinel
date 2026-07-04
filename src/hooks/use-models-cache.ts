import { useEffect, useState, useCallback } from "react";
import {
  getCachedModels,
  setCachedModels,
  type CachedModelsEntry,
} from "@/lib/indexed-db";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ModelOption {
  id: string;
  name: string;
  description?: string | null;
  contextLength?: number | null;
  modality?: string | null;
  promptPrice?: string | null;
  completionPrice?: string | null;
  isRecommended: boolean;
  aiSuggest: boolean;
  popularityRank: number;
  supportsTools: boolean;
  isLowCost: boolean;
  isFree: boolean;
  multiplier: number;
}

interface UseModelsCacheResult {
  models: ModelOption[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useModelsCache(): UseModelsCacheResult {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      const fetched: ModelOption[] = data.models || [];
      // Write to IndexedDB for future loads
      const entry: CachedModelsEntry = {
        lastUpdated: Date.now(),
        data: fetched,
      };
      await setCachedModels(entry).catch(() => {});
      return fetched;
    } catch (e) {
      throw e;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try IndexedDB first
      const cached = await getCachedModels();
      if (cached && Date.now() - cached.lastUpdated < CACHE_TTL_MS) {
        setModels(cached.data);
        setLoading(false);
        return;
      }

      // Stale or missing — fetch from API
      const fetched = await fetchFromApi();
      setModels(fetched);
    } catch (e) {
      console.error("useModelsCache: failed to load models", e);
      setError(e instanceof Error ? e.message : "Failed to load models");
      // If we have stale cached data, still show it as fallback
      const cached = await getCachedModels().catch(() => null);
      if (cached && cached.data.length > 0) {
        setModels(cached.data);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFromApi]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  return { models, loading, error, refresh };
}