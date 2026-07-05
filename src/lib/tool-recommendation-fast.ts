/**
 * Fast-path tool recommendation generator
 *
 * Replaces the agentic slow-path loop with a single LLM call that:
 * 1. Takes inspiration examples and thing context
 * 2. Generates compact tool schema (name, description, categories if detailed)
 * 3. Returns dummy mock response (placeholder)
 *
 * The old generateToolRecommendation (agentic loop with tool calling) is preserved
 * for backward compatibility but NOT used by new code.
 */
import { db } from "@/lib/db";
import { callOpenRouter, type UsageTracker } from "@/lib/model-utils";
import { Granularity, RestrictionBehavior } from "./enums";
import {
  type ToolDef,
  type HardeningTrace,
  type ScanMetadata,
  RestrictionThing,
} from "./types";
import {
  retrieveInspirationExamples,
  formatInspirationExamplesBlock,
  type InspirationExample,
} from "@/lib/inspiration-retriever";
import { deriveToolRequirements } from "@/lib/tool-extractor";
import {
  loadPromptFile,
  replacePlaceholders,
  processTemplateConditions,
} from "@/lib/prompt-loader";

// ── Output types ─────────────────────────────────────────────────────────────────

export interface FastToolRecommendationResult {
  toolRecommendation: string | null;
  compatibilityScore: number | null;
  /** True when the agentic slow path would have been used but we handled it */
  fastPathHit: boolean;
}

// ── Dummy mock response ───────────────────────────────────────────────────────────

/**
 * Placeholder mock response until real mock seeding is implemented.
 * Returns a simple denied response with a policy reference.
 */
function generateDummyMockResponse(toolName: string): Record<string, unknown> {
  return {
    status: "denied",
    reason: "Policy Restriction",
    message: `Access to ${toolName} is restricted per current policy.`,
    policy: {
      allow_discussion: false,
      describe_processing: false,
      exceptions: false,
      negotiation: false,
      require_explicit_human_approval: true,
      escalate_to_support: true,
    },
  };
}

// ── Schema generation helpers ─────────────────────────────────────────────────────

/**
 * Build a compact ToolDef from an LLM-generated description and optional categories.
 *
 * For compact granularity: keeps only query + operation_mode params.
 * For detailed granularity: adds a categories enum param.
 */
function buildCompactToolDef(
  name: string,
  description: string,
  categories: string[] | undefined,
  granularity: Granularity,
): ToolDef {
  const params: Record<string, unknown> = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "A concise, self-contained summary of the user's request. Must include all necessary context and remove conversational filler.",
      },
      operation_mode: {
        type: "string",
        enum: ["inquiry", "execution", "hypothetical_execution"],
        description:
          "The operational intent: 'inquiry' for fetching/searching data; 'execution' for mutative actions or state changes; 'hypothetical_execution' for dry-runs, simulations, or planning without side effects.",
      },
    },
    required: ["query", "operation_mode"],
  };

  // For detailed granularity, add the categories param so the LLM can specify sub-dimensions
  if (
    granularity === Granularity.Detailed &&
    categories &&
    categories.length > 0
  ) {
    (params.properties as Record<string, unknown>).categories = {
      type: "array",
      items: {
        type: "string",
        enum: categories,
      },
      description:
        "Specific categories or sub-topics this request falls under, if applicable.",
    };
    (params.required as string[]).push("categories");
  }

  return {
    type: "function",
    function: {
      name,
      description,
      parameters: params,
    },
  };
}

/**
 * Check if a tool already exists with an identical schema (skip it).
 */
function isToolIdentical(a: any, b: ToolDef): boolean {
  if (!a || !b) return false;
  const fnA = a.function || a;
  const fnB = b.function || b;
  if (fnA.name !== fnB.name) return false;
  if (fnA.description !== fnB.description) return false;
  return JSON.stringify(fnA.parameters) === JSON.stringify(fnB.parameters);
}

// ── Single-call LLM generation ────────────────────────────────────────────────────

/**
 * Generate a compact tool schema using a single LLM call.
 *
 * The LLM receives the full RestrictionThing context (name, description, variants,
 * business scenarios, concrete scenarios) plus inspiration examples and target granularity.
 *
 * It outputs a simple JSON: { name, description, categories? }
 * which is then converted to a full ToolDef + dummy mock response.
 */
async function generateToolFromInspiration(
  thing: RestrictionThing,
  granularity: Granularity,
  extractorModel: string,
  tracker?: UsageTracker,
): Promise<{
  toolJson: ToolDef;
  mockResponse: Record<string, unknown>;
} | null> {
  if (!thing) {
    return null;
  }
  const template = loadPromptFile("tool_generation_fast.md");

  // Process conditional blocks: show DETAILED section or COMPACT section based on granularity
  const withConditions = processTemplateConditions(template, {
    DETAILED: granularity === Granularity.Detailed,
    COMPACT: granularity !== Granularity.Detailed,
  });

  const prompt = replacePlaceholders(withConditions, {
    THING_NAME: thing.thingName || "(not specified)",
    THING_DESCRIPTION: thing.thingDescription || "(not specified)",
    THING_NAME_VARIANTS: (thing.thingNameVariants || []).join(", ") || "(none)",
    THING_DESCRIPTION_VARIANTS:
      (thing.thingDescriptionVariants || []).join(", ") || "(none)",
    BUSINESS_SCENARIOS: (thing.businessScenarios || []).join("\n") || "(none)",
    CONCRETE_SCENARIOS: (thing.concreteScenarios || []).join("\n") || "(none)",
    GRANULARITY: granularity,
  });

  try {
    const response = await callOpenRouter(
      extractorModel,
      [{ role: "user", content: prompt }],
      undefined,
      tracker,
    );

    const cleaned = (response.content || "")
      .replace(/^```[a-zA-Z]*\n?/g, "")
      .replace(/\n?```$/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const name = parsed.name || thing.thingName || "policy_enforcer";
    const description =
      parsed.description ||
      `Handles ${thing.thingName || "requested service"} requests.`;
    const categories: string[] | undefined =
      granularity === Granularity.Detailed && Array.isArray(parsed.categories)
        ? parsed.categories
        : undefined;

    const toolJson = buildCompactToolDef(
      sanitizeName(name),
      description,
      categories,
      granularity,
    );
    const mockResponse = generateDummyMockResponse(name);

    return { toolJson, mockResponse };
  } catch (err) {
    console.error("generateToolFromInspiration LLM call failed:", err);
    return null;
  }
}

/**
 * Sanitize a tool name to snake_case if needed.
 */
function sanitizeName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase() || "policy_enforcer"
  );
}

// ── Fast recommendation entry point ───────────────────────────────────────────────

/**
 * Fast-path tool recommendation.
 *
 * Flow:
 * 1. Check for direct-match inspiration examples (zero LLM cost)
 * 2. If direct match exists → use it (same as existing fast path)
 * 3. If no direct match → single LLM call to generate from thing context
 * 4. Never falls through to the agentic slow-path loop
 */
export async function generateToolRecommendationFast(
  forbiddenTask: string,
  granularity: Granularity,
  extractorModel: string,
  metadata: ScanMetadata,
  tracker?: UsageTracker,
  trace?: HardeningTrace,
  existingTools?: ToolDef[],
  inspirationExamples?: InspirationExample[],
  mockToolResponses?: Record<string, unknown>,
): Promise<FastToolRecommendationResult> {
  try {
    const { toolRequirements, mockPolicy } = deriveToolRequirements(
      metadata,
      forbiddenTask,
    );

    const targetThing =
      metadata.seedExtraction?.things?.find(
        (t: any) => t.forbiddenTask === forbiddenTask,
      ) ||
      ({
        forbiddenTask,
        thingName: "",
        thingDescription: "",
        thingNameVariants: [],
        thingDescriptionVariants: [],
        credentials: [],
        businessScenarios: [],
        isPresent: true,
        behaviorType: RestrictionBehavior.HARD_REFUSAL,
      } as RestrictionThing);

    // Skip tool generation for non-tool-gated restrictions
    if (
      targetThing.behaviorType === RestrictionBehavior.HARD_REFUSAL ||
      targetThing.behaviorType === RestrictionBehavior.DISCLAIMER_APPEND
    ) {
      return {
        toolRecommendation: null,
        compatibilityScore: null,
        fastPathHit: true,
      };
    }

    // ── Step 1: Get inspiration examples ─────────────────────────────────
    const examples =
      inspirationExamples ??
      (await retrieveInspirationExamples(
        targetThing,
        extractorModel,
        granularity,
        metadata,
        tracker,
        trace,
        existingTools,
        toolRequirements,
      ));

    // ── Step 2: Check for direct-match fast path ──────────────────────────
    const directMatches = examples.filter(
      (ex: InspirationExample) => ex.directMatch && ex.bestMatchingCandidate,
    );

    if (directMatches.length > 0) {
      return await handleDirectMatches(
        directMatches,
        forbiddenTask,
        granularity,
        extractorModel,
        metadata,
        tracker,
        trace,
        existingTools,
      );
    }

    // ── Step 3: No direct match — single LLM call to generate ─────────────
    const generated = await generateToolFromInspiration(
      targetThing,
      granularity,
      extractorModel,
      tracker,
    );

    if (!generated) {
      // LLM call failed — return null, caller will decide fallback
      return {
        toolRecommendation: null,
        compatibilityScore: null,
        fastPathHit: false,
      };
    }

    // Resolve model name
    const dbModels = await db.model.findMany({
      select: { id: true, name: true },
    });
    const dbExtractorModel = dbModels.find((m) => m.id === extractorModel);
    const extractorModelName =
      dbExtractorModel?.name ||
      extractorModel.split("/").pop() ||
      extractorModel;

    const toolName = generated.toolJson.function?.name || "policy_enforcer";

    const payload = {
      tools: [
        {
          name: toolName,
          granularity,
          compatibilityScore: 70,
          rationale: `Generated from inspiration for restriction: ${forbiddenTask}`,
          toolJson: generated.toolJson,
          mockResponse: generated.mockResponse,
        },
      ],
      compatibilityScore: 70,
      extractorModel,
      extractorModelName,
    };

    if (trace) {
      trace.toolExtraction = {
        promptSent: `(fast generation — single LLM call for: ${forbiddenTask})`,
        rawOutput: JSON.stringify(payload, null, 2),
      };
    }

    return {
      toolRecommendation: JSON.stringify(payload),
      compatibilityScore: 70,
      fastPathHit: true,
    };
  } catch (err) {
    console.error("Error during generateToolRecommendationFast:", err);
    return {
      toolRecommendation: null,
      compatibilityScore: null,
      fastPathHit: false,
    };
  }
}

// ── Direct-match handler (extracted from generateToolRecommendation) ──────────────

async function handleDirectMatches(
  directMatches: InspirationExample[],
  forbiddenTask: string,
  granularity: Granularity,
  extractorModel: string,
  metadata: ScanMetadata,
  tracker?: UsageTracker,
  trace?: HardeningTrace,
  existingTools?: ToolDef[],
): Promise<FastToolRecommendationResult> {
  // Resolve model name once
  const dbModels = await db.model.findMany({
    select: { id: true, name: true },
  });
  const dbExtractorModel = dbModels.find((m) => m.id === extractorModel);
  const extractorModelName =
    dbExtractorModel?.name || extractorModel.split("/").pop() || extractorModel;

  const businessFeatures = metadata.seedExtraction?.businessFeatures;

  const tools: any[] = [];
  let totalScore = 0;

  for (const match of directMatches) {
    let toolJson = match.toolJson;
    let mockResponse = match.mockResponse;

    // Check if this tool already exists (skip if identical)
    const existingTool = existingTools?.find(
      (t) =>
        t.function.name === match.name ||
        t.function.name === match.overlap?.replaceExisting,
    );
    if (existingTool) {
      if (isToolIdentical(toolJson, existingTool)) {
        continue; // OLD: identical tool already configured → skip
      }
      // Schema differs — use dummy mock for now
      mockResponse = generateDummyMockResponse(match.name);
    }

    const score = Math.round(
      ((match.requirementScore || 0) + (match.granularityScore || 0)) / 2,
    );
    totalScore += score;

    tools.push({
      name: match.name,
      granularity,
      compatibilityScore: score,
      rationale:
        match.rationale || `Direct match from database: ${match.description}`,
      toolJson,
      mockResponse,
      replaces: match.overlap?.replaceExisting,
    });
  }

  if (tools.length === 0) {
    return {
      toolRecommendation: null,
      compatibilityScore: null,
      fastPathHit: false,
    };
  }

  const avgScore = Math.round(totalScore / tools.length);

  const payload: any = {
    tools,
    compatibilityScore: avgScore,
    extractorModel,
    extractorModelName,
  };

  if (trace) {
    trace.toolExtraction = {
      promptSent: `(fast path — ${tools.length} direct-match tools)`,
      rawOutput: JSON.stringify(payload, null, 2),
    };
  }

  return {
    toolRecommendation: JSON.stringify(payload),
    compatibilityScore: avgScore,
    fastPathHit: true,
  };
}
