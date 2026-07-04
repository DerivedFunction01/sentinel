/**
 * Production-Grade Dynamic Context-Tiered Fallback Engine Sync Script.
 * Synchronizes OpenRouter models to the database while dynamically calculating
 * optimal fallback sequences, pricing multipliers, and robust recommendation sets.
 *
 * Run with: bun run prisma/sync-models-impl.ts
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import { invalidateModelsCache } from "../src/lib/models-cache";

const KNOWN_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "meta-llama",
  "x-ai",
  "qwen",
  "deepseek",
  "cohere",
  "mistralai",
];

const MAX_RECOMMENDED_PER_PROVIDER = 3;

/** Target threshold for scanning dynamic default rank suggestions */
const MAX_DYNAMIC_SUGGEST_LIMIT = 15;

/** Global structural exclusion list for invalid or system helper layers */
const GLOBAL_BANNED = [
  /openrouter\/(fusion|pareto|bodybuilder|auto)/i,
  /free/i,
  /micro/i,
  /code/i,
  /image/i,
  /video/i,
  /audio/i,
  /distill/i,
  /embedding/i,
  /moderation/i,
];

/** Target exclusions to drop community-hosted endpoints or unstable weights */
const PROVIDER_BANNED: Record<string, RegExp[]> = {
  google: [/gemma/i, /banana/i],
  openai: [/gpt-oss/i],
  "meta-llama": [],
  anthropic: [],
};

const TRUSTED_PROVIDERS = ["anthropic", "openai", "google", "meta-llama"];
const CHEAP_FLAGSHIP_MULTIPLIER_OF_FLASH = 2.0;
const BASELINE_LENIENCY_MULTIPLIER = 1.5;
const PATTERN_PARAMETER_TAG = /[-_]\d+b/i;
const PROVIDER_POPULARITY_MAX_DELTA = 40;
const PREMIUM_GLOBAL_HORIZON = 25;
const TRAILING_BUCKET_SIZE = 15;
const BASELINE_COHORT_SIZE = 10;
const MAX_COST_MULTIPLIER = 5;

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string | null;
  context_length?: number | null;
  architecture?: { modality?: string | null } | null;
  pricing?: { prompt?: string | null; completion?: string | null } | null;
  supported_parameters?: string[] | null;
}

interface AnnotatedModel {
  id: string;
  name: string;
  cost: number;
  globalPopularityRank: number;
  withinProviderRank: number;
  contextWindow: number;
  supportsTools: boolean;
  hasParameterTag: boolean;
  isPopularityOutlier: boolean;
  modelClass: "flash-utility" | "standard-flagship" | "pro-reasoning";
  isExtremelyCheapTrustedFlagship: boolean;
  contextTier: number; // 0: 1M+, 1: 256k-1M, 2: 128k-256k
  raw: OpenRouterModel;
}

/** Computes composite price: Input Price + (Output Price * 2) */
function getCompositeCost(model: OpenRouterModel): number {
  const promptPrice = parseFloat(model.pricing?.prompt || "0");
  const completionPrice = parseFloat(model.pricing?.completion || "0");
  return promptPrice + completionPrice * 2;
}

/** Categorizes models into functional optimization clusters */
function inferModelCapabilityClass(
  modelId: string,
): "flash-utility" | "standard-flagship" | "pro-reasoning" {
  const normalizedId = modelId.toLowerCase();
  if (
    normalizedId.includes("flash") ||
    normalizedId.includes("lite") ||
    normalizedId.includes("nano") ||
    normalizedId.includes("mini")
  ) {
    return "flash-utility";
  }
  if (
    normalizedId.includes("pro") ||
    normalizedId.includes("max") ||
    normalizedId.includes("plus") ||
    normalizedId.includes("opus") ||
    normalizedId.includes("r1") ||
    normalizedId.includes("reasoning")
  ) {
    return "pro-reasoning";
  }
  return "standard-flagship";
}

function getContextTier(contextLength: number): number {
  if (contextLength >= 1000000) return 0; // Mega-Context Tier
  if (contextLength >= 256000) return 1; // Core High-Context Tier
  return 2; // Utility Standard Tier
}

function calculateGlobalPopularityBucket(rank: number): number {
  if (rank <= PREMIUM_GLOBAL_HORIZON) {
    return 0; // Top High-Availability Horizon Pool
  }
  return (
    Math.floor((rank - PREMIUM_GLOBAL_HORIZON - 1) / TRAILING_BUCKET_SIZE) + 1
  );
}

/** Performs basic sanity validation before routing calculations */
function passesOperationalFilters(model: OpenRouterModel): boolean {
  const modelId = model.id || "";
  const provider = modelId.split("/")[0] || "unknown";

  if (GLOBAL_BANNED.some((re) => re.test(modelId))) return false;

  const specializedBans = PROVIDER_BANNED[provider];
  if (specializedBans && specializedBans.some((re) => re.test(modelId))) {
    return false;
  }

  const promptPrice = parseFloat(model.pricing?.prompt || "0");
  const completionPrice = parseFloat(model.pricing?.completion || "0");
  if (promptPrice <= 0 || completionPrice <= 0) return false;

  const contextWindow = model.context_length || 0;
  if (contextWindow < 128000) return false;

  const supportsTools = model.supported_parameters?.includes("tools") ?? false;
  if (!supportsTools) return false;

  return true;
}

function computeBaselinePrice(cohort: AnnotatedModel[]): number {
  if (cohort.length === 0) return 0.0000015;
  const sortedCosts = [...cohort].map((m) => m.cost).sort((a, b) => a - b);
  const midIdx = Math.floor(sortedCosts.length / 2);
  return sortedCosts.length % 2 !== 0
    ? sortedCosts[midIdx]
    : (sortedCosts[midIdx - 1] + sortedCosts[midIdx]) / 2;
}

function buildAnnotatedPool(
  rawModels: OpenRouterModel[],
  filteredPool: OpenRouterModel[],
  flashMedianCost: number,
): AnnotatedModel[] {
  return filteredPool.map((m) => {
    const baseCost = getCompositeCost(m);
    const provider = m.id.split("/")[0] || "unknown";
    const contextSize = m.context_length || 0;
    const modelClass = inferModelCapabilityClass(m.id);

    // Identify extremely cheap flagships from primary known providers
    const isTrusted = TRUSTED_PROVIDERS.includes(provider);
    const isFlagship = modelClass !== "flash-utility";
    const isExtremelyCheapTrustedFlagship =
      isTrusted &&
      isFlagship &&
      baseCost <= flashMedianCost * CHEAP_FLAGSHIP_MULTIPLIER_OF_FLASH;

    return {
      id: m.id,
      name: m.name,
      cost: baseCost,
      globalPopularityRank: rawModels.indexOf(m) + 1,
      withinProviderRank: 999,
      contextWindow: contextSize,
      supportsTools: true,
      hasParameterTag: PATTERN_PARAMETER_TAG.test(m.id),
      isPopularityOutlier: false,
      modelClass,
      isExtremelyCheapTrustedFlagship,
      contextTier: getContextTier(contextSize),
      raw: m,
    };
  });
}

function discoverActiveProviders(pool: AnnotatedModel[]): string[] {
  const providerBestRanks: Record<string, number> = {};
  pool.forEach((m) => {
    const provider = m.id.split("/")[0] || "unknown";
    if (
      !providerBestRanks[provider] ||
      m.globalPopularityRank < providerBestRanks[provider]
    ) {
      providerBestRanks[provider] = m.globalPopularityRank;
    }
  });
  return Object.keys(providerBestRanks).sort(
    (a, b) => providerBestRanks[a] - providerBestRanks[b],
  );
}

function resolveProviderLadders(
  pool: AnnotatedModel[],
  activeProviders: string[],
): Record<string, AnnotatedModel[]> {
  const ladders: Record<string, AnnotatedModel[]> = {};
  activeProviders.forEach((p) => {
    ladders[p] = [];
  });

  pool.forEach((model) => {
    const providerPrefix = model.id.split("/")[0];
    if (activeProviders.includes(providerPrefix)) {
      ladders[providerPrefix].push(model);
    }
  });

  activeProviders.forEach((provider) => {
    const cohort = ladders[provider];
    if (cohort.length === 0) return;

    const absoluteHighestPopularity = Math.min(
      ...cohort.map((m) => m.globalPopularityRank),
    );

    cohort.forEach((m) => {
      if (
        m.globalPopularityRank >
        absoluteHighestPopularity + PROVIDER_POPULARITY_MAX_DELTA
      ) {
        m.isPopularityOutlier = true;
      }
    });

    cohort.sort((a, b) => {
      if (a.hasParameterTag !== b.hasParameterTag)
        return a.hasParameterTag ? 1 : -1;
      if (a.isPopularityOutlier !== b.isPopularityOutlier)
        return a.isPopularityOutlier ? 1 : -1;
      return a.cost - b.cost;
    });

    cohort.forEach((m, index) => {
      m.withinProviderRank = index + 1;
    });
  });

  return ladders;
}

function sortGlobalFallbackPool(
  ladders: Record<string, AnnotatedModel[]>,
  activeProviders: string[],
): AnnotatedModel[] {
  const flatPool: AnnotatedModel[] = [];
  activeProviders.forEach((provider) => {
    flatPool.push(...ladders[provider]);
  });

  flatPool.sort((a, b) => {
    if (a.contextTier !== b.contextTier) {
      return a.contextTier - b.contextTier;
    }

    const bucketA = calculateGlobalPopularityBucket(a.globalPopularityRank);
    const bucketB = calculateGlobalPopularityBucket(b.globalPopularityRank);
    if (bucketA !== bucketB) return bucketA - bucketB;

    // Group rescued cheap trusted flagships and flash-utility models into a single efficiency cohort
    const getPriorityScore = (m: AnnotatedModel) => {
      if (
        m.isExtremelyCheapTrustedFlagship ||
        m.modelClass === "flash-utility"
      ) {
        return 0; // High-Efficiency Cohort (Bargain Flagships or Flash Models)
      }
      return 1; // Standard Premium/Pro Cohort
    };

    const scoreA = getPriorityScore(a);
    const scoreB = getPriorityScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;

    return a.cost - b.cost;
  });

  return flatPool;
}

export async function syncModels(db: PrismaClient): Promise<void> {
  console.log("Fetching models from OpenRouter sorted by popularity...");
  const res = await fetch(
    "https://openrouter.ai/api/v1/models?sort=most-popular",
  );
  if (!res.ok) {
    throw new Error(`OpenRouter API returned ${res.status}`);
  }
  const json = (await res.json()) as { data: OpenRouterModel[] };
  const rawModels = json.data;
  console.log(`Fetched ${rawModels.length} models.`);

  // Pass 1: Filter operational layers
  const filteredTextPool = rawModels.filter(passesOperationalFilters);

  // Compute dynamic benchmarks
  const flashModels = filteredTextPool.filter(
    (m) => inferModelCapabilityClass(m.id) === "flash-utility",
  );
  const flashCosts = flashModels.map(getCompositeCost).sort((a, b) => a - b);
  const flashMedianCost =
    flashCosts.length > 0
      ? flashCosts.length % 2 !== 0
        ? flashCosts[Math.floor(flashCosts.length / 2)]
        : (flashCosts[Math.floor(flashCosts.length / 2) - 1] +
            flashCosts[Math.floor(flashCosts.length / 2)]) /
          2
      : 0.0000015;

  const sortedCosts = filteredTextPool
    .map(getCompositeCost)
    .sort((a, b) => a - b);
  const percentileIndex = Math.floor(sortedCosts.length * 0.7);
  const DYNAMIC_COST_CAP = sortedCosts[percentileIndex] || 0.0000099;

  // Pass 2: Filter with exemption for bargain flagships
  const eligibleRaw = filteredTextPool.filter((m) => {
    const rawCost = getCompositeCost(m);
    const provider = m.id.split("/")[0] || "unknown";
    const modelClass = inferModelCapabilityClass(m.id);
    const isTrusted = TRUSTED_PROVIDERS.includes(provider);
    const isFlagship = modelClass !== "flash-utility";
    const isExtremelyCheapTrustedFlagship =
      isTrusted &&
      isFlagship &&
      rawCost <= flashMedianCost * CHEAP_FLAGSHIP_MULTIPLIER_OF_FLASH;

    return isExtremelyCheapTrustedFlagship || rawCost <= DYNAMIC_COST_CAP;
  });

  const annotatedPool = buildAnnotatedPool(
    rawModels,
    eligibleRaw,
    flashMedianCost,
  );
  const activeProviders = discoverActiveProviders(annotatedPool);
  const providerLadders = resolveProviderLadders(
    annotatedPool,
    activeProviders,
  );
  let finalSequence = sortGlobalFallbackPool(providerLadders, activeProviders);

  // Post-override cost sanity baseline
  const sanityCohort = finalSequence.slice(0, BASELINE_COHORT_SIZE);
  const rawBaselinePrice = computeBaselinePrice(sanityCohort);
  const baselinePrice = rawBaselinePrice * BASELINE_LENIENCY_MULTIPLIER;

  // Apply maximum cost sanity filter
  finalSequence = finalSequence.filter((m) => {
    const mult = baselinePrice <= 0 ? 1 : Math.ceil(m.cost / baselinePrice);
    return m.isExtremelyCheapTrustedFlagship || mult <= MAX_COST_MULTIPLIER;
  });

  // Create a fast lookup map for our sequence rankings
  const defaultRankMap = new Map<string, number>();
  finalSequence.forEach((m, index) => {
    defaultRankMap.set(m.id, index + 1);
  });

  // Initialize resolving AI Suggest Set based entirely on runtime performance ranks
  const resolvedAiSuggestIds = new Set<string>();

  // 1. Dynamically suggest the absolute top 3 overall best-performing models (Ramp Steps 1-3)
  finalSequence.slice(0, 3).forEach((m) => resolvedAiSuggestIds.add(m.id));

  // 2. Diversify: Suggest the top-ranking model from each capability class (utility, flagship, reasoning) within the top 15
  const classWinners = new Set<string>();
  for (const m of finalSequence.slice(0, MAX_DYNAMIC_SUGGEST_LIMIT)) {
    if (!classWinners.has(m.modelClass)) {
      classWinners.add(m.modelClass);
      resolvedAiSuggestIds.add(m.id);
    }
  }

  // 3. Diversify: Suggest the top-ranking model for each distinct Context Tier (0, 1, 2) within the top 15
  const tierWinners = new Set<number>();
  for (const m of finalSequence.slice(0, MAX_DYNAMIC_SUGGEST_LIMIT)) {
    if (!tierWinners.has(m.contextTier)) {
      tierWinners.add(m.contextTier);
      resolvedAiSuggestIds.add(m.id);
    }
  }

  // 4. Boost: Automatically promote exceptionally cheap premium bargain flagships that claim a top 15 rank
  for (const m of finalSequence.slice(0, MAX_DYNAMIC_SUGGEST_LIMIT)) {
    if (m.isExtremelyCheapTrustedFlagship) {
      resolvedAiSuggestIds.add(m.id);
    }
  }

  const modelsByProvider: Record<string, OpenRouterModel[]> = {};
  finalSequence.forEach((m) => {
    const provider = m.id.split("/")[0] || "";
    if (!modelsByProvider[provider]) {
      modelsByProvider[provider] = [];
    }
    modelsByProvider[provider].push(m.raw);
  });

  const recommendedIds = new Set<string>();
  const lowCostIds = new Set<string>();
  const freeIds = new Set<string>();

  // Determine standard recommended selections from validated sequence
  for (const provider of KNOWN_PROVIDERS) {
    const providerModels = modelsByProvider[provider] || [];
    const popularModels = providerModels.slice(0, MAX_RECOMMENDED_PER_PROVIDER);
    popularModels.forEach((m) => recommendedIds.add(m.id));

    const remainingModels = providerModels.slice(MAX_RECOMMENDED_PER_PROVIDER);

    // Identify validated Free recommendations
    const remainingFree = remainingModels.filter((m) => m.id.endsWith(":free"));
    const freeToRecommend = remainingFree.slice(0, 2);
    freeToRecommend.forEach((m) => {
      recommendedIds.add(m.id);
      freeIds.add(m.id);
    });

    // Identify low-cost recommendations from survivors
    const remainingNonFree = remainingModels.filter(
      (m) => !m.id.endsWith(":free"),
    );
    const sortedByPrice = [...remainingNonFree].sort((a, b) => {
      const priceA = parseFloat(a.pricing?.prompt || "0");
      const priceB = parseFloat(b.pricing?.prompt || "0");
      return priceA - priceB;
    });

    const cheapestModels = sortedByPrice.slice(0, 2);
    cheapestModels.forEach((m) => {
      recommendedIds.add(m.id);
      lowCostIds.add(m.id);
    });
  }

  let upserted = 0;
  let activeInSequence = 0;

  for (let i = 0; i < rawModels.length; i++) {
    const m = rawModels[i];
    if (!m.id || !m.name) continue;

    const rawCost = getCompositeCost(m);
    const hasRank = defaultRankMap.has(m.id);
    const defaultRank = hasRank ? defaultRankMap.get(m.id)! : null;

    // Calculate relative cost multiplier based on dynamic baseline price
    const parsedMultiplier =
      baselinePrice <= 0 ? 1 : Math.max(1, Math.ceil(rawCost / baselinePrice));
    const isRecommended = recommendedIds.has(m.id);
    const isFree = m.id.endsWith(":free") || freeIds.has(m.id) || rawCost <= 0;
    const isLowCost =
      lowCostIds.has(m.id) || (!isFree && parsedMultiplier === 1);
    const aiSuggest = resolvedAiSuggestIds.has(m.id);
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
        isLowCost,
        isFree,
        aiSuggest,
        popularityRank,
        supportsTools,
        defaultRank,
        multiplier: parsedMultiplier,
      },
      update: {
        name: m.name,
        description: m.description ?? null,
        contextLength: m.context_length ?? null,
        modality: m.architecture?.modality ?? null,
        promptPrice: m.pricing?.prompt ?? null,
        completionPrice: m.pricing?.completion ?? null,
        isRecommended,
        isLowCost,
        isFree,
        aiSuggest,
        popularityRank,
        supportsTools,
        defaultRank,
        multiplier: parsedMultiplier,
      },
    });

    upserted++;
    if (defaultRank !== null) {
      activeInSequence++;
    }
  }

  console.log(`✓ Sync Complete. Upserted ${upserted} models to the database.`);
  console.log(
    `  → Fallback Sequence Active: ${activeInSequence} models mapped to [defaultRank 1-${activeInSequence}].`,
  );
  console.log(
    `  → Dynamic Lenient Baseline cost established at: ${baselinePrice.toFixed(8)} per token.`,
  );

  // Invalidate server-side in-memory cache so API routes pick up new rankings
  invalidateModelsCache();
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  import("../src/lib/db")
    .then(({ db }) => syncModels(db).finally(() => db.$disconnect()))
    .catch((e) => {
      console.error("Database sync pipeline execution loop failure:", e);
      process.exit(1);
    });
}
