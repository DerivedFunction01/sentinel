/**
 * Shared hardening workflow used by both the scan pipeline and the
 * on-demand /api/scan/[id]/harden endpoint.
 *
 * Extracted to eliminate code duplication between:
 *   - src/lib/scan-pipeline.ts
 *   - src/app/api/scan/[id]/harden/route.ts  (POST handler)
 */
import {
  generateToolRecommendation,
  parseSectionedRecommendation,
  rephraseRestrictions,
} from "@/lib/tool-extractor";
import {
  retrieveInspirationExamples,
  formatInspirationExamplesBlock,
  type InspirationExample,
} from "@/lib/inspiration-retriever";
import {
  executeMultiStepHardening,
  getDeterministicHardenedPrompt,
} from "@/lib/scan-prompts";
import { TrialVerdict } from "@/lib/enums";
import { DEFAULT_MODEL, type UsageTracker } from "@/lib/model-utils";
import {
  type ToolDef,
  type Trial,
  type ScanMetadata,
  type BreachedAttack,
  type HardeningTrace,
  RestrictionThing,
} from "@/lib/types";
import { Granularity } from "./enums";

export interface GenerateHardenedPromptParams {
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

export interface GenerateHardenedPromptResult {
  hardenedPrompt: string;
  toolRecommendation: string;
  compatibilityScore: number;
  hardeningModelId: string;
  hardeningModelName: string;
  /** true when the slow LLM extraction loop ran; false on fast-path or no-tool runs */
  slowPathHit: boolean;
}

/**
 * Execute the hardening workflow shared by ScanPipeline and the
 * on-demand /api/scan/[id]/harden POST handler.
 *
 * Steps:
 *   1. Rephrase restrictions into tool requirements (for inspiration search)
 *   2. Get inspiration examples from the database (shared between tool extractor and hardening)
 *   3. Tool recommendation (if includeToolRecommendation is true)
 *   4. Parse recommended tools
 *   5. Multi-step prompt hardening via executeMultiStepHardening
 *   6. Fallback to deterministic hardening on error
 *
 * @param params  All inputs required for hardening
 * @param callModel  A function that sends a prompt to an LLM and returns its text
 * @returns  The hardened prompt, tool recommendation, compatibility score, and model info
 */
export async function generateHardenedPrompt(
  params: GenerateHardenedPromptParams,
  callModel: (prompt: string) => Promise<string>,
): Promise<GenerateHardenedPromptResult> {
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

  // Steps 1–3 are only needed when tool extraction is requested.
  // When hardening-only (fast path), skip the inspiration retrieval and
  // tool extraction pipeline entirely — they make unnecessary LLM/DB calls.
  let inspirationExamples: InspirationExample[] = [];
  let inspirationExamplesBlock = "";
  let toolRecommendation = "";
  let compatibilityScore = 0;
  let slowPathHit = false;

  if (includeToolRecommendation) {
    // Step 1: Rephrase restrictions into tool requirements (cached on metadata)
    const rephrased = await rephraseRestrictions(
      forbiddenTask,
      extractorModel || DEFAULT_MODEL,
      metadata,
      tracker,
    );
    const toolRequirements = rephrased.toolRequirements;

    // Step 2: Get inspiration examples from the database
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
        vulnerabilities: [],
        credentials: [],
        businessScenarios: [],
        ontologySection: undefined,
        isPresent: true,
      } as RestrictionThing);
    inspirationExamples = await retrieveInspirationExamples(
      targetThing,
      extractorModel || DEFAULT_MODEL,
      granularity,
      metadata,
      tracker,
      trace,
      tools,
      toolRequirements,
    );
    inspirationExamplesBlock =
      formatInspirationExamplesBlock(inspirationExamples);

    // Step 3: Run tool extraction (pass pre-fetched examples to avoid a second fetch)
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
    toolRecommendation = result.toolRecommendation || "";
    compatibilityScore = result.compatibilityScore || 0;
    slowPathHit = result.slowPathHit;
  }

  // Step 4: Parse recommended tools
  const recommendedToolsList = toolRecommendation
    ? parseSectionedRecommendation(toolRecommendation)
    : [];

  // Step 5: Multi-step prompt hardening
  let hardenedPrompt = "";
  try {
    hardenedPrompt = await executeMultiStepHardening(
      callModel,
      systemPrompt,
      forbiddenTask,
      breachedAttacks,
      recommendedToolsList,
      inspirationExamplesBlock,
      trace,
      metadata?.attackSummary?.summarizedPatterns,
      metadata,
    );
  } catch (err) {
    console.error("Error generating hardened prompt:", err);
    hardenedPrompt = getDeterministicHardenedPrompt(systemPrompt);
  }

  // Step 6: Resolve model ID/name
  const hardeningModelId = hardenerModel;
  const hardeningModelName = hardenerModel.split("/").pop() || hardenerModel;

  return {
    hardenedPrompt,
    toolRecommendation,
    compatibilityScore,
    hardeningModelId,
    hardeningModelName,
    slowPathHit,
  };
}
