import { useEffect, useState } from "react";
import { DEFAULT_MODEL, findDefaultModel } from "@/lib/model-utils";

export function useModelDefaults() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
        }
        setLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function getDefaults(models: Array<{ id: string; name: string }>) {
    if (models.length === 0) {
      return {
        targetModel: DEFAULT_MODEL,
        attackerModel: DEFAULT_MODEL,
        judgeModel: DEFAULT_MODEL,
        hardenerModel: DEFAULT_MODEL,
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

  return { loaded, error, getDefaults };
}
