/**
 * SentinelPrompt — Model sync implementation.
 *
 * Fetches the full model catalog from OpenRouter's public
 * /api/v1/models endpoint and upserts each into the Model table.
 * A curated subset is marked isRecommended=true so they appear under the
 * "RECOMMENDED" header in the ModelSelector dropdown.
 */
import type { PrismaClient } from "@prisma/client";

/** OpenRouter model ids we want flagged as recommended in the dropdown. */
const RECOMMENDED_IDS = [
  "anthropic/claude-3.5-haiku",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-4.6",
  "cohere/command-a",
  "cohere/command-r-plus-08-2024",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1",
];

/** Models that get an "AI Suggest" sub-label. */
const AI_SUGGEST_IDS = ["deepseek/deepseek-r1"];

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string | null;
  context_length?: number | null;
  architecture?: { modality?: string | null } | null;
  pricing?: { prompt?: string | null; completion?: string | null } | null;
}

/** Fetch all models from OpenRouter and upsert them into the DB. */
export async function syncModels(db: PrismaClient): Promise<void> {
  console.log("Fetching models from OpenRouter…");
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) {
    throw new Error(`OpenRouter API returned ${res.status}`);
  }
  const json = (await res.json()) as { data: OpenRouterModel[] };
  const models = json.data;
  console.log(`Fetched ${models.length} models.`);

  let upserted = 0;
  let recommended = 0;
  for (const m of models) {
    if (!m.id || !m.name) continue;
    const isRecommended = RECOMMENDED_IDS.includes(m.id);
    const aiSuggest = AI_SUGGEST_IDS.includes(m.id);
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
  import("@prisma/client").then(({ PrismaClient }) => {
    const db = new PrismaClient();
    return syncModels(db).finally(() => db.$disconnect());
  }).catch((e) => {
    console.error("Model sync failed:", e);
    process.exit(1);
  });
}
