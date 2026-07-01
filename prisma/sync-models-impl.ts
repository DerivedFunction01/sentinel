/**
 * ToolRegistry — Model sync implementation.
 *
 * Fetches the full model catalog from OpenRouter's public
 * /api/v1/models endpoint and upserts each into the Model table.
 * A curated subset is marked isRecommended=true so they appear under the
 * "RECOMMENDED" header in the ModelSelector dropdown.
 */
import type { PrismaClient } from "../generated/prisma/client.js";

/** Known providers whose top models we want to highlight. */
const KNOWN_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "meta-llama",
  "xai",
  "qwen",
  "deepseek",
  "cohere",
  "mistralai",
];

const MAX_RECOMMENDED_PER_PROVIDER = 3;

/** Models that get an "AI Suggest" sub-label. */
const AI_SUGGEST_IDS: string[] = [];

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string | null;
  context_length?: number | null;
  architecture?: { modality?: string | null } | null;
  pricing?: { prompt?: string | null; completion?: string | null } | null;
  supported_parameters?: string[] | null;
}

/** Fetch all models from OpenRouter and upsert them into the DB. */
export async function syncModels(db: PrismaClient): Promise<void> {
  console.log("Fetching models from OpenRouter sorted by popularity…");
  const res = await fetch(
    "https://openrouter.ai/api/v1/models?sort=most-popular",
  );
  if (!res.ok) {
    throw new Error(`OpenRouter API returned ${res.status}`);
  }
  const json = (await res.json()) as { data: OpenRouterModel[] };
  const models = json.data;
  console.log(`Fetched ${models.length} models.`);

  let upserted = 0;
  let recommended = 0;
  const providerCounts: Record<string, number> = {};

  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    if (!m.id || !m.name) continue;

    const parts = m.id.split("/");
    const provider = parts[0] || "";

    let isRecommended = false;
    if (KNOWN_PROVIDERS.includes(provider)) {
      const currentCount = providerCounts[provider] || 0;
      if (currentCount < MAX_RECOMMENDED_PER_PROVIDER) {
        isRecommended = true;
        providerCounts[provider] = currentCount + 1;
      }
    }

    const aiSuggest = AI_SUGGEST_IDS.includes(m.id);
    const popularityRank = i + 1;
    const supportsTools = m.supported_parameters?.includes("tools") ?? false;

    await db.model.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        name: m.name,
        description: m.description ?? null,
        contextLength: m.context_length ?? null,
        modality: m.architecture?.modality ?? null,
        promptPrice: m.pricing?.prompt ?? null,
        completionPrice: m.pricing?.completion ?? null,
        isRecommended,
        aiSuggest,
        popularityRank,
        supportsTools,
      },
      update: {
        name: m.name,
        description: m.description ?? null,
        contextLength: m.context_length ?? null,
        modality: m.architecture?.modality ?? null,
        promptPrice: m.pricing?.prompt ?? null,
        completionPrice: m.pricing?.completion ?? null,
        isRecommended,
        aiSuggest,
        popularityRank,
        supportsTools,
      },
    });
    upserted++;
    if (isRecommended) recommended++;
  }

  console.log(`✓ Synced ${upserted} models (${recommended} recommended).`);
}

// CLI entry point — run with: bun run prisma/sync-models-impl.ts
// Using dynamic import to avoid require() which is forbidden by ESLint.
if (import.meta.url === `file://${process.argv[1]}`) {
  import("../src/lib/db")
    .then(({ db }) => syncModels(db).finally(() => db.$disconnect()))
    .catch((e) => {
      console.error("Model sync failed:", e);
      process.exit(1);
    });
}
