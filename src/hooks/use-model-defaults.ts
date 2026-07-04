import { FALLBACK_DEFAULT_MODEL, findDefaultModel } from "@/lib/model-utils";
import { useModelsCache } from "./use-models-cache";

export function useModelDefaults() {
  const { models, loading, error } = useModelsCache();

  function getDefaults(
    models: Array<{ id: string; name: string; defaultRank?: number | null }>,
  ) {
    if (models.length === 0) {
      return {
        targetModel: FALLBACK_DEFAULT_MODEL,
        attackerModel: FALLBACK_DEFAULT_MODEL,
        judgeModel: FALLBACK_DEFAULT_MODEL,
        hardenerModel: FALLBACK_DEFAULT_MODEL,
      };
    }
    const defaultModelId = findDefaultModel(models);
    return {
      targetModel: defaultModelId,
      attackerModel: defaultModelId,
      judgeModel: defaultModelId,
      hardenerModel: defaultModelId,
    };
  }

  return { loaded: !loading, error, getDefaults };
}
