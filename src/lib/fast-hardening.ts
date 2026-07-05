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
import { Granularity } from "./enums";
import {
  retrieveInspirationExamples,
  formatInspirationExamplesBlock,
  type InspirationExample,
} from "@/lib/inspiration-retriever";
import {
  executeMultiStepHardeningFull,
  getDeterministicHardenedPrompt,
} from "@/lib/scan-prompts";
import { generateToolRecommendation } from "@/lib/tool-extractor";

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
}

export interface FastHardeningResult {
  hardenedPrompt: string;
  protectedTools: string[]; // Tools that already cover restrictions
  recommendedTools: ToolDef[]; // New tools needed (empty if all protected)
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

  // Step 2: Tool handling (skip if protected)
  if (isProtected) {
    // Protected: no tool extraction needed
    protectedTools = targetThing.protectedByTools!;

    // Build recommendation for protected tools - use existing tools that match
    recommendedTools = tools.filter((t: ToolDef) =>
      protectedTools.includes(t.function?.name || ""),
    );
  } else {
    // Not protected: run full tool extraction
    const inspirationExamples = await retrieveInspirationExamples(
      targetThing || createDefaultThing(forbiddenTask),
      extractorModel,
      granularity,
      metadata,
      tracker,
      trace,
      tools,
      forbiddenTask,
    );

    inspirationExamplesBlock =
      formatInspirationExamplesBlock(inspirationExamples);

    // Check if inspiration examples provide direct matches
    const directMatches = inspirationExamples.filter(
      (ex) => ex.directMatch && ex.bestMatchingCandidate,
    );

    if (directMatches.length > 0) {
      // Fast path: use direct match examples
      slowPathHit = false;
      recommendedTools = directMatches.map((ex) => ex.toolJson);
    } else {
      // Slow path: need LLM extraction
      slowPathHit = true;
      const result = await generateToolRecommendation(
        systemPrompt,
        forbiddenTask,
        granularity,
        extractorModel,
        metadata,
        tracker,
        undefined,
        tools,
        trace,
        trials,
        mockToolResponses,
        inspirationExamples,
      );
      const parsed = parseToolRecommendation(result.toolRecommendation || "");
      recommendedTools = Array.isArray(parsed) ? parsed : [];
    }
  }

  // Step 3: Generate hardened prompt with routing matrix
  let hardenedPrompt = "";
  try {
    hardenedPrompt = await executeMultiStepHardeningFull(
      callModel,
      systemPrompt,
      forbiddenTask,
      breachedAttacks,
      recommendedTools.length > 0 ? recommendedTools : undefined,
      inspirationExamplesBlock,
      trace,
      metadata?.attackSummary?.summarizedPatterns,
      metadata,
    );
  } catch (err) {
    console.error("Fast hardening failed:", err);
    hardenedPrompt = getDeterministicHardenedPrompt(systemPrompt);
  }

  return {
    hardenedPrompt,
    protectedTools,
    recommendedTools,
    slowPathHit,
  };
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
    isPresent: true,
  };
}

/**
 * Parse tool recommendation to extract ToolDef array
 */
function parseToolRecommendation(recommendation: string): ToolDef[] {
  try {
    const parsed = JSON.parse(recommendation);
    if (parsed.tools && Array.isArray(parsed.tools)) {
      return parsed.tools.map((t: any) => t.toolJson || t);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}
