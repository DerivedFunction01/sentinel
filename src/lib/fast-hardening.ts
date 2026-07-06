/**
 * Fast-path hardening workflow for protected tool detection
 *
 * This module implements the clean "hardening first, tools later" approach:
 * 1. Seed extraction identifies protected restrictions
 * 2. Protected restrictions bypass tool extraction entirely
 * 3. Hardening generates routing matrix for all restrictions
 */
import { type UsageTracker } from "@/lib/model-utils";
import {
  type ToolDef,
  type Trial,
  type ScanMetadata,
  type BreachedAttack,
  type HardeningTrace,
  RestrictionThing,
} from "@/lib/types";
import { Granularity, RestrictionCategory } from "./enums";
import {
  executeMultiStepHardeningFull,
  getDeterministicHardenedPrompt,
} from "@/lib/scan-prompts";
import { generateToolRecommendationFast } from "@/lib/tool-recommendation-fast";

export interface FastHardeningParams {
  systemPrompt: string;
  forbiddenTask: string;
  breachedAttacks: BreachedAttack[];
  tools: ToolDef[];
  mockToolResponses: Record<string, unknown>;
  granularity: Granularity;
  extractorModel: string;
  hardenerModel: string;
  metadata: ScanMetadata;
  trials: Trial[];
  tracker?: UsageTracker;
  trace?: HardeningTrace;
  includeToolRecommendation?: boolean;
}

export interface FastHardeningResult {
  hardenedPrompt: string;
  toolRecommendation: string;
  compatibilityScore: number;
  protectedTools: string[];
  recommendedTools: ToolDef[];
  hardeningModelId: string;
  hardeningModelName: string;
  slowPathHit: boolean;
}

/**
 * Fast-path hardening workflow with protected tool detection
 *
 * Flow:
 * 1. Check seed extraction for tool-protected restrictions
 * 2. If protected: skip tool extraction, use protected tools for routing
 * 3. If not protected: run inspiration lookup and tool extraction
 * 4. Generate hardened prompt with routing matrix
 */
export async function executeFastHardening(
  params: FastHardeningParams,
  callModel: (prompt: string) => Promise<string>,
): Promise<FastHardeningResult> {
  const {
    systemPrompt,
    forbiddenTask,
    breachedAttacks,
    tools,
    mockToolResponses,
    granularity,
    extractorModel,
    hardenerModel,
    metadata,
    trials,
    tracker,
    trace,
    includeToolRecommendation = true,
  } = params;

  // Step 1: Identify protected restrictions from seed extraction
  const targetThing = metadata.seedExtraction?.things?.find(
    (t) => t.forbiddenTask === forbiddenTask,
  );

  const isProtected =
    targetThing?.coversRestriction === true &&
    targetThing.protectedByTools &&
    targetThing.protectedByTools.length > 0;

  let protectedTools: string[] = [];
  let recommendedTools: ToolDef[] = [];
  let slowPathHit = false;
  let inspirationExamplesBlock = "";
  let fastResult:
    | Awaited<ReturnType<typeof generateToolRecommendationFast>>
    | undefined;

  // Step 2: Tool handling (skip if protected or tool recommendation is disabled)
  if (!includeToolRecommendation) {
    // Tool recommendation disabled — skip entirely
    protectedTools = [];
    recommendedTools = [];
    fastResult = undefined;
  } else if (isProtected) {
    // Protected: no tool extraction needed
    protectedTools = targetThing.protectedByTools!;

    // Build recommendation for protected tools - use existing tools that match
    recommendedTools = tools.filter((t: ToolDef) =>
      protectedTools.includes(t.function?.name || ""),
    );
  } else {
    // Not protected: run fast tool recommendation
    // generateToolRecommendationFast handles both direct-match and single-call generation
    fastResult = await generateToolRecommendationFast(
      forbiddenTask,
      granularity,
      extractorModel,
      metadata,
      tracker,
      trace,
      tools,
      undefined, // inspirationExamples — let the function fetch them internally
      mockToolResponses,
    );

    slowPathHit = !fastResult.fastPathHit;

    if (fastResult.toolRecommendation) {
      // Parse the JSON to extract recommendedTools for deduplication
      try {
        const parsed = JSON.parse(fastResult.toolRecommendation);
        recommendedTools = (parsed.tools || [])
          .map((t: any) => t.toolJson as ToolDef)
          .filter(Boolean);
      } catch {
        recommendedTools = [];
      }
    }
  }

  // Apply deduplication to recommended tools before passing to hardening
  const deduplicatedTools =
    recommendedTools.length > 0
      ? deduplicateTools(recommendedTools, granularity)
      : [];

  // Step 3: Generate hardened prompt with routing matrix
  let hardenedPrompt = "";
  try {
    hardenedPrompt = await executeMultiStepHardeningFull(
      callModel,
      systemPrompt,
      forbiddenTask,
      breachedAttacks,
      deduplicatedTools.length > 0 ? deduplicatedTools : undefined,
      inspirationExamplesBlock,
      trace,
      metadata?.attackSummary?.summarizedPatterns,
      metadata,
    );
  } catch (err) {
    console.error("Fast hardening failed:", err);
    hardenedPrompt = getDeterministicHardenedPrompt(systemPrompt);
  }

  // Build tool recommendation JSON
  let toolRecommendation = "";
  let compatibilityScore = 0;

  if (isProtected && protectedTools.length > 0) {
    // Protected: build recommendation from existing tools
    compatibilityScore = 100;
    toolRecommendation = JSON.stringify({
      tools: protectedTools.map((t) => ({
        name: t,
        granularity,
        compatibilityScore: 100,
        rationale: `Already configured tool covering: ${forbiddenTask}`,
      })),
      compatibilityScore: 100,
      extractorModel,
    });
  } else if (deduplicatedTools.length > 0) {
    // Use the fast result's recommendation string if available, otherwise build from deduplicated
    if (fastResult?.toolRecommendation) {
      toolRecommendation = fastResult.toolRecommendation;
      compatibilityScore = fastResult.compatibilityScore ?? 85;
    } else {
      compatibilityScore = 85;
      toolRecommendation = JSON.stringify({
        tools: deduplicatedTools.map((t) => {
          const fn = t.function;
          return {
            name: fn?.name || "unknown",
            granularity,
            compatibilityScore: (t as any).compatibilityScore || 85,
            rationale:
              (t as any).rationale || "Recommended tool for restriction",
            toolJson: t,
          };
        }),
        compatibilityScore,
        extractorModel,
      });
    }
  }

  // Resolve model ID/name
  const hardeningModelId = hardenerModel;
  const hardeningModelName = hardenerModel.split("/").pop() || hardenerModel;

  return {
    hardenedPrompt,
    toolRecommendation,
    compatibilityScore,
    protectedTools,
    recommendedTools,
    hardeningModelId,
    hardeningModelName,
    slowPathHit,
  };
}

function compactToolSchema(detailedTool: ToolDef): ToolDef {
  // Extract existing properties safely, defaulting to an empty object
  const existingProps =
    (detailedTool.function?.parameters as any)?.properties ?? {};

  // Define defaults in one place to eliminate repetition
  const defaultQuery = {
    type: "string",
    description:
      "A concise, self-contained summary of the user's request. Must include all necessary context and remove conversational filler.",
  };

  const defaultMode = {
    type: "string",
    enum: ["inquiry", "execution", "hypothetical_execution"],
    description:
      "The operational intent: 'inquiry' for fetching/searching data; 'execution' for mutative actions or state changes; 'hypothetical_execution' for dry-runs, simulations, or planning without side effects.",
  };

  return {
    type: "function",
    function: {
      name: detailedTool.function?.name ?? "",
      description: detailedTool.function?.description ?? "",
      parameters: {
        type: "object",
        properties: {
          query: existingProps.query ?? defaultQuery,
          operation_mode: existingProps.operation_mode ?? defaultMode,
        },
        required: ["query", "operation_mode"], // Standard practice for JSON schemas
      },
    },
  };
}
/**
 * Deduplicate tools by name, keeping the first occurrence.
 * If granularity is Compact, convert Detailed tools to Compact first.
 */
function deduplicateTools(
  tools: ToolDef[],
  targetGranularity: Granularity,
): ToolDef[] {
  const seen = new Set<string>();
  const result: ToolDef[] = [];

  for (const tool of tools) {
    const name = tool.function?.name || "";
    if (!name) continue;

    // Convert to target granularity if needed
    let processedTool = tool;
    if (targetGranularity === Granularity.Compact) {
      // Check if this is a Detailed tool (has more than just query/operation_mode params)
      const params = tool.function?.parameters as
        | Record<string, unknown>
        | undefined;
      const paramKeys = params ? Object.keys(params) : [];
      const hasExtraParams = paramKeys.some(
        (k) => k !== "query" && k !== "operation_mode",
      );
      if (hasExtraParams) {
        processedTool = compactToolSchema(tool);
      }
    }

    // Deduplicate by name after conversion
    const processedName = processedTool.function?.name || name;
    if (!seen.has(processedName)) {
      seen.add(processedName);
      result.push(processedTool);
    }
  }

  return result;
}

/**
 * Create a default RestrictionThing for cases where seed extraction didn't find one
 */
function createDefaultThing(forbiddenTask: string): RestrictionThing {
  return {
    forbiddenTask,
    thingName: "",
    thingDescription: "",
    thingNameVariants: [],
    thingDescriptionVariants: [],
    credentials: [],
    businessScenarios: [],
    ontologySection: undefined,
    isPresent: true,
    category: RestrictionCategory.DYNAMIC_POLICY,
  };
}
