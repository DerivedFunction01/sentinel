/**
 * Dynamic Production-Grade Context-Tiered Fallback Engine.
 * Automatically discovers emerging popular providers and segments by strict Context Tiers.
 * Promotes high-quality flagship models from trusted providers if they become extremely cheap.
 * Supports runtime CLI cost overrides to test dynamic market elasticity.
 *
 * Run with: bun run scripts/test-new-strat.ts [modelId costMultiplier] [...]
 * Example: bun run scripts/test-new-strat.ts deepseek/deepseek-v4-flash 10.0 google/gemini-2.5-flash-lite 0.5
 */

const CACHE_FILE = "scratch/openrouter-models-cache.json";

/**
 * 1. GLOBAL STRUCTURAL FILTER LOGIC
 * Completely excludes completely invalid non-text or system infrastructure helper layers.
 */
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

/**
 * 2. PROVIDER-SPECIFIC BLACKLISTS
 * Target exclusions to drop open-weights, community-hosted endpoints, or specialized
 * image generation artifacts that jeopardize agent trace stability.
 */
const PROVIDER_BANNED: Record<string, RegExp[]> = {
  google: [/gemma/i, /banana/i],
  openai: [/gpt-oss/i],
  "meta-llama": [],
  anthropic: [],
};

/**
 * 3. TRUSTED FLAGSHIP PROMOTION PARAMS
 * High-tier providers whose flagship models we want to rescue and prioritize if their costs plunge.
 */
const TRUSTED_PROVIDERS = ["anthropic", "openai", "google", "meta-llama"];

/**
 * If a flagship model's cost is less than or equal to this multiplier times the median flash price,
 * it is treated as "extremely cheap" and promoted.
 */
const CHEAP_FLAGSHIP_MULTIPLIER_OF_FLASH = 2.0;

const PATTERN_PARAMETER_TAG = /[-_]\d+b/i;
const PROVIDER_POPULARITY_MAX_DELTA = 40;

/** Any model tracking within this top boundary is treated as a premium tier-1 high-availability choice */
const PREMIUM_GLOBAL_HORIZON = 25;
const TRAILING_BUCKET_SIZE = 15;

/** Baseline cohort size for median price calculation. */
const BASELINE_COHORT_SIZE = 10;

/**
 * Maximum cost multiplier relative to the baseline.
 * Models whose cost exceeds baseline × MAX_COST_MULTIPLIER are excluded from the final sequence.
 * This prevents price-spiked models from dominating the ranking.
 */
const MAX_COST_MULTIPLIER = 5;

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
  raw: any;
}

/** Computes composite cost: Input Cost + (Output Cost * 2) */
function getCompositeCost(model: any): number {
  const promptPrice = parseFloat(model.pricing?.prompt || "0");
  const completionPrice = parseFloat(model.pricing?.completion || "0");
  return promptPrice + completionPrice * 2;
}

/** Classifies models into actionable tool-calling groups. */
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

/** Determines context tiering segments natively. */
function getContextTier(contextLength: number): number {
  if (contextLength >= 1000000) return 0; // 1M+ Tier
  if (contextLength >= 256000) return 1; // 256k - 1M Tier
  return 2; // 128k - 256k Tier
}

/** Assigns a model to its high-availability bucket, protecting top-tier models from fragmentation. */
function calculateGlobalPopularityBucket(rank: number): number {
  if (rank <= PREMIUM_GLOBAL_HORIZON) {
    return 0; // Unified Premium Horizon Pool
  }
  return (
    Math.floor((rank - PREMIUM_GLOBAL_HORIZON - 1) / TRAILING_BUCKET_SIZE) + 1
  );
}

/** Validates basic operational readiness. */
function passesOperationalFilters(model: any): boolean {
  const modelId = model.id || "";
  const provider = modelId.split("/")[0] || "unknown";

  if (GLOBAL_BANNED.some((re) => re.test(modelId))) return false;

  const specializedBans = PROVIDER_BANNED[provider];
  if (specializedBans && specializedBans.some((re) => re.test(modelId)))
    return false;

  const promptPrice = parseFloat(model.pricing?.prompt || "0");
  const completionPrice = parseFloat(model.pricing?.completion || "0");
  if (promptPrice <= 0 || completionPrice <= 0) return false;

  const contextWindow = model.context_length || 0;
  if (contextWindow < 128000) return false;

  const supportsTools = model.supported_parameters?.includes("tools") ?? false;
  if (!supportsTools) return false;

  return true;
}

async function fetchModels(): Promise<any[]> {
  const res = await fetch(
    "https://openrouter.ai/api/v1/models?sort=most-popular",
  );
  if (!res.ok) throw new Error(`OpenRouter API returned ${res.status}`);
  const json = (await res.json()) as { data: any[] };
  return json.data;
}

function loadCache(): any[] | null {
  try {
    const fs = require("fs");
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function saveCache(models: any[]) {
  try {
    const fs = require("fs");
    fs.mkdirSync("scratch", { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(models, null, 2));
    console.log(
      `✓ Synchronized metadata payload tracking cache to ${CACHE_FILE}`,
    );
  } catch {}
}

/** Evaluates CLI trailing values to inject manual market price multipliers dynamically */
function parseCommandLinePriceOverrides(): Map<string, number> {
  const overrideMap = new Map<string, number>();
  const args = process.argv.slice(2);
  for (let i = 0; i + 1 < args.length; i += 2) {
    const modelId = args[i];
    const multiplier = parseFloat(args[i + 1]);
    if (!isNaN(multiplier) && multiplier > 0) {
      overrideMap.set(modelId, multiplier);
    }
  }
  return overrideMap;
}

/** Compute the median composite cost from a cohort of models. */
function computeBaselinePrice(cohort: AnnotatedModel[]): number {
  const sortedCosts = [...cohort].map((m) => m.cost).sort((a, b) => a - b);
  const midIdx = Math.floor(sortedCosts.length / 2);
  return sortedCosts.length % 2 !== 0
    ? sortedCosts[midIdx]
    : (sortedCosts[midIdx - 1] + sortedCosts[midIdx]) / 2;
}

// ==================================================================================
// ARCHITECTURAL STEP SEPARATION EXECUTORS
// ==================================================================================

/** STEP A: Injects standard pricing, scales overrides, and identifies rescued flagships */
function buildAnnotatedPool(
  rawModels: any[],
  filteredPool: any[],
  overrides: Map<string, number>,
  flashMedianCost: number,
): AnnotatedModel[] {
  return filteredPool.map((m) => {
    let baseCost = getCompositeCost(m);

    if (overrides.has(m.id)) {
      const multiplier = overrides.get(m.id)!;
      baseCost = baseCost * multiplier;
    }

    const provider = m.id.split("/")[0] || "unknown";
    const contextSize = m.context_length || 0;
    const modelClass = inferModelCapabilityClass(m.id);

    // Evaluate if this model meets the "extremely cheap trusted flagship" conditions
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

/** STEP B: Autodiscovers operational providers actively running on OpenRouter */
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

/** STEP C: Resolves provider silo ladders to mark dead snapshots or outdated previews */
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

/** STEP D: Executes the context-tiered global pool sort with premium horizon overrides and cheap flagship promotions */
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

    // Group rescued cheap trusted flagships and flash-utility models together.
    // This allows them to compete strictly on cost within the high-availability bucket,
    // ensuring cheaper flash utility models correctly rank above slightly more expensive rescued flagships.
    const getPriorityScore = (m: AnnotatedModel) => {
      if (
        m.isExtremelyCheapTrustedFlagship ||
        m.modelClass === "flash-utility"
      ) {
        return 0; // High-Efficiency Pool (Flash or Bargain Flagships)
      }
      return 1; // Standard Premium/Pro Pool
    };

    const scoreA = getPriorityScore(a);
    const scoreB = getPriorityScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;

    return a.cost - b.cost;
  });

  return flatPool;
}

// ==================================================================================
// MAIN INITIALIZATION INTERFACE
// ==================================================================================

async function main() {
  const priceOverrides = parseCommandLinePriceOverrides();
  if (priceOverrides.size > 0) {
    console.log(
      `Loaded ${priceOverrides.size} test pricing override condition(s) from CLI args.`,
    );
    for (const [id, mult] of priceOverrides) {
      console.log(
        `  → Simulated Market Shift: ${id} scaling by ${mult}x cost multiplier`,
      );
    }
  }

  let rawModels = loadCache();
  if (!rawModels || rawModels.length === 0) {
    rawModels = await fetchModels();
    saveCache(rawModels);
  }

  // Pass 1: Clean out structural syntax noise
  const filteredTextPool = rawModels.filter(passesOperationalFilters);

  // Compute the median cost of the flash-utility tier dynamically
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
      : 0.0000015; // fallback baseline placeholder

  // Compute our 70th percentile threshold cost cap dynamically
  const sortedCosts = filteredTextPool
    .map(getCompositeCost)
    .sort((a, b) => a - b);
  const percentileIndex = Math.floor(sortedCosts.length * 0.7);
  const DYNAMIC_COST_CAP = sortedCosts[percentileIndex];

  console.log(
    `Loaded ${rawModels.length} models from metadata cache pipeline.`,
  );
  console.log(
    `Statistical Utility Threshold Cost Cap (70th Percentile): ${DYNAMIC_COST_CAP.toFixed(8)}`,
  );
  console.log(
    `Dynamic Flash Utility Median Price Benchmark: ${flashMedianCost.toFixed(8)}`,
  );

  // Pass 2: Cost buffer limit filter (exempting rescued cheap flagships)
  const eligibleRaw = filteredTextPool.filter((m) => {
    const rawCost = getCompositeCost(m);
    let finalCost = rawCost;
    if (priceOverrides.has(m.id)) {
      finalCost = rawCost * priceOverrides.get(m.id)!;
    }

    const provider = m.id.split("/")[0] || "unknown";
    const modelClass = inferModelCapabilityClass(m.id);
    const isTrusted = TRUSTED_PROVIDERS.includes(provider);
    const isFlagship = modelClass !== "flash-utility";
    const isExtremelyCheapTrustedFlagship =
      isTrusted &&
      isFlagship &&
      finalCost <= flashMedianCost * CHEAP_FLAGSHIP_MULTIPLIER_OF_FLASH;

    if (isExtremelyCheapTrustedFlagship) {
      return true; // Bypass dynamic cost cap
    }

    return finalCost <= DYNAMIC_COST_CAP;
  });

  // EXECUTE FUNCTION STEP PIPELINE RAMP
  const annotatedPool = buildAnnotatedPool(
    rawModels,
    eligibleRaw,
    priceOverrides,
    flashMedianCost,
  );
  const activeProviders = discoverActiveProviders(annotatedPool);
  const providerLadders = resolveProviderLadders(
    annotatedPool,
    activeProviders,
  );
  let finalSequence = sortGlobalFallbackPool(providerLadders, activeProviders);

  // Post-override cost sanity filter: compute baseline from the sorted sequence,
  // then drop any model whose cost exceeds baseline × MAX_COST_MULTIPLIER.
  const sanityCohort = finalSequence.slice(0, BASELINE_COHORT_SIZE);
  const sanityBaseline = computeBaselinePrice(sanityCohort);
  const beforeFilter = finalSequence.length;
  finalSequence = finalSequence.filter((m) => {
    const mult = sanityBaseline <= 0 ? 1 : Math.ceil(m.cost / sanityBaseline);
    return m.isExtremelyCheapTrustedFlagship || mult <= MAX_COST_MULTIPLIER;
  });
  const removed = beforeFilter - finalSequence.length;
  if (removed > 0) {
    console.log(
      `\nCost sanity filter: removed ${removed} models exceeding ${MAX_COST_MULTIPLIER}x baseline (${sanityBaseline.toFixed(8)})`,
    );
  }

  // Log information about rescued flagships
  const rescuedFlagships = finalSequence.filter(
    (m) => m.isExtremelyCheapTrustedFlagship,
  );
  if (rescuedFlagships.length > 0) {
    console.log(
      `\n✓ Rescued and Promoted ${rescuedFlagships.length} Cheap Trusted Flagship(s):`,
    );
    rescuedFlagships.forEach((m) => {
      console.log(
        `  → [PROMOTED] ${m.id} | Cost: ${m.cost.toFixed(8)} (${(m.cost / (flashMedianCost || 1)).toFixed(2)}x of Flash median)`,
      );
    });
  }

  console.log(
    `\nActive Provider Mesh Discovered: [${activeProviders.join(", ")}]`,
  );

  console.log(
    "\n==================================================================================",
  );
  console.log(
    "=== FINALIZED CONTEXT-TIERED & PRICE-OPTIMIZED MODEL SEQUENCE ===================",
  );
  console.log(
    "==================================================================================",
  );

  finalSequence.slice(0, 15).forEach((m, idx) => {
    const bucket = calculateGlobalPopularityBucket(m.globalPopularityRank);
    const promotionTag = m.isExtremelyCheapTrustedFlagship
      ? "⭐ [BARGAIN-FLAGSHIP]"
      : `Class: ${m.modelClass.toUpperCase()}`;
    console.log(
      `  [Ramp Step ${idx + 1}] → ${m.id.padEnd(45)} | Cost: ${m.cost.toFixed(8)} | Global Pop: #${m.globalPopularityRank} (Bucket ${bucket}) | ${promotionTag} | Context: ${(m.contextWindow / 1000).toFixed(0)}k`,
    );
  });

  // ==================================================================================
  // BASELINE PRICE CALCULATION
  // ==================================================================================
  const baselineCohort = finalSequence.slice(0, BASELINE_COHORT_SIZE);
  const baselinePrice = computeBaselinePrice(baselineCohort);

  console.log("\n=== Baseline Price Calculation ===");
  console.log(
    `Cohort size: ${BASELINE_COHORT_SIZE} (top models from final sequence)`,
  );
  console.log(
    `Baseline composite cost (median): ${baselinePrice.toFixed(8)} per token`,
  );
  console.log("");
  baselineCohort.forEach((m, idx) => {
    const multiplier =
      baselinePrice <= 0 ? 1 : Math.max(1, Math.ceil(m.cost / baselinePrice));
    console.log(
      `  [${idx + 1}] ${m.id.padEnd(45)} cost: ${m.cost.toFixed(8)}  mult: ${multiplier}x`,
    );
  });

  // Compute multiplier for ALL models in the final sequence
  console.log("\n=== Multiplier Distribution (all models in sequence) ===");
  const allMultipliers = finalSequence.map((m) => ({
    id: m.id,
    cost: m.cost,
    multiplier:
      baselinePrice <= 0 ? 1 : Math.max(1, Math.ceil(m.cost / baselinePrice)),
  }));
  const uniqueMults = [
    ...new Set(allMultipliers.map((m) => m.multiplier)),
  ].sort((a, b) => a - b);
  const byMult: Record<number, number> = {};
  for (const m of allMultipliers) {
    byMult[m.multiplier] = (byMult[m.multiplier] || 0) + 1;
  }
  for (const mult of uniqueMults) {
    console.log(`  ${mult}x → ${byMult[mult]} models`);
  }

  console.log("\n=== Absolute System Baseline Default Recommendation ===");
  const bestAnchor = finalSequence[0];
  if (bestAnchor) {
    const bestMult =
      baselinePrice <= 0
        ? 1
        : Math.max(1, Math.ceil(bestAnchor.cost / baselinePrice));
    console.log(`→ Primary Engine Lock: ${bestAnchor.id} (${bestAnchor.name})`);
    console.log(
      `  Properties: Cost: ${bestAnchor.cost.toFixed(8)} | Context: ${bestAnchor.contextWindow.toLocaleString()} | Provider: ${bestAnchor.id.split("/")[0]} | Baseline Mult: ${bestMult}x`,
    );
  }
}

main().catch((e) => {
  console.error("Pipeline execution loop failure:", e);
  process.exit(1);
});
