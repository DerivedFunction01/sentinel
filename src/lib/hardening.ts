/**
 * Shared hardening workflow used by both the scan pipeline and the
 * on-demand /api/scan/[id]/harden endpoint.
 *
 * Extracted to eliminate code duplication between:
 *   - src/lib/scan-pipeline.ts
 *   - src/app/api/scan/[id]/harden/route.ts  (POST handler)
 */
import {
  deriveToolRequirements,
  generateToolRecommendation,
  parseSectionedRecommendation,
} from "@/lib/tool-extractor";
import {
  retrieveInspirationExamples,
  formatInspirationExamplesBlock,
  type InspirationExample,
} from "@/lib/inspiration-retriever";
import {
  executeMultiStepHardeningFull,
  getDeterministicHardenedPrompt,
} from "@/lib/scan-prompts";
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
  useFullPromptStep1?: boolean;
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
 *   1. Check if restriction is already protected by existing tools
 *   2. Rephrase restrictions into tool requirements (for inspiration search)
 *   3. Get inspiration examples from the database (shared between tool extractor and hardening)
 *   4. Tool recommendation (if includeToolRecommendation is true and not protected)
 *   5. Parse recommended tools
 *   6. Multi-step prompt hardening via executeMultiStepHardening
 *   7. Fallback to deterministic hardening on error
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
    useFullPromptStep1 = true,
  } = params;

  // Steps 1–4 are only needed when tool extraction is requested.
  // When hardening-only (fast path), skip the inspiration retrieval and
  // tool extraction pipeline entirely — they make unnecessary LLM/DB calls.
  let inspirationExamples: InspirationExample[] = [];
  let inspirationExamplesBlock = "";
  let toolRecommendation = "";
  let compatibilityScore = 0;
  let slowPathHit = false;

  // Check if this specific restriction is already covered by existing tools
  const targetThing =
    metadata.seedExtraction?.things?.find(
      (t: any) => t.forbiddenTask === forbiddenTask,
    );
  const isRestrictionProtected = targetThing?.coversRestriction === true &&
    targetThing?.protectedByTools &&
    targetThing.protectedByTools.length > 0;

  // Only run tool extraction if the restriction is NOT already protected by tools
  if (includeToolRecommendation && !isRestrictionProtected) {
    // Step 1: Derive tool requirements from seed extraction (zero LLM cost)
    const { toolRequirements } = deriveToolRequirements(
      metadata,
      forbiddenTask,
    );

    // Step 2: Get inspiration examples from the database
    const thingForInspiration = targetThing ||
      ({
        forbiddenTask,
        thingName: "",
        thingDescription: "",
        thingNameVariants: [],
        thingDescriptionVariants: [],
        credentials: [],
        businessScenarios: [],
        ontologySection: undefined,
        isPresent: true,
      } as RestrictionThing);
    inspirationExamples = await retrieveInspirationExamples(
      thingForInspiration,
      extractorModel,
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
  } else if (isRestrictionProtected) {
    // Protected: use existing tools, no need for tool extraction
    // Build tool recommendation from protected tools
    toolRecommendation = JSON.stringify({
      tools: targetThing.protectedByTools?.map((t) => ({
        name: t,
        granularity,
        compatibilityScore: 100, // Existing tools are perfect match
        rationale: `Already configured tool covering: ${forbiddenTask}`,
      })) || [],
      compatibilityScore: 100,
      extractorModel,
    });
  }

  // Step 4: Parse recommended tools
  const recommendedToolsList = toolRecommendation
    ? parseSectionedRecommendation(toolRecommendation)
    : [];

  let hardenedPrompt = "";
  try {
    if (useFullPromptStep1) {
      // Always True
      hardenedPrompt = await executeMultiStepHardeningFull(
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
    } else {
      // Old - Legacy
      // hardenedPrompt = await executeMultiStepHardening(
      //   callModel,
      //   systemPrompt,
      //   forbiddenTask,
      //   breachedAttacks,
      //   recommendedToolsList,
      //   inspirationExamplesBlock,
      //   trace,
      //   metadata?.attackSummary?.summarizedPatterns,
      //   metadata,
      // );
    }
  } catch (err) {
    console.error("Error generating hardened prompt:", err);
    hardenedPrompt = getDeterministicHardenedPrompt(systemPrompt);
  }

  // Step 5: Resolve model ID/name
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