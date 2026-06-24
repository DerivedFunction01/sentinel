/**
 * Shared hardening workflow used by both the scan pipeline and the
 * on-demand /api/scan/[id]/harden endpoint.
 *
 * Extracted to eliminate code duplication between:
 *   - src/lib/scan-pipeline.ts   (executeScanPipeline)
 *   - src/app/api/scan/[id]/harden/route.ts  (POST handler)
 */
import {
  generateToolRecommendation,
  parseSectionedRecommendation,
} from "@/lib/tool-extractor";
import {
  retrieveInspirationExamples,
  formatInspirationExamplesBlock,
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
  Granularity,
} from "@/lib/types";

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
}

/**
 * Execute the hardening workflow shared by executeScanPipeline and the
 * on-demand /api/scan/[id]/harden POST handler.
 *
 * Steps:
 *   1. Tool recommendation (if includeToolRecommendation is true)
 *   2. Parse recommended tools
 *   3. Retrieve inspiration examples from the database
 *   4. Multi-step prompt hardening via executeMultiStepHardening
 *   5. Fallback to deterministic hardening on error
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

  // Step 1: Run tool extraction
  let toolRecommendation = "";
  let compatibilityScore = 0;

  if (includeToolRecommendation) {
    const result = await generateToolRecommendation(
      systemPrompt,
      forbiddenTask,
      granularity,
      extractorModel,
      metadata,
      tracker,
      undefined,
      tools,
      undefined,
      trials,
      mockToolResponses,
    );
    toolRecommendation = result.toolRecommendation || "";
    compatibilityScore = result.compatibilityScore || 0;
  }

  // Step 2: Parse recommended tools
  const recommendedToolsList = toolRecommendation
    ? parseSectionedRecommendation(toolRecommendation)
    : [];

  // Step 3: Get inspiration examples from the database
  const inspirationExamples = await retrieveInspirationExamples(
    forbiddenTask,
    extractorModel || DEFAULT_MODEL,
    granularity,
    metadata,
    tracker,
    undefined,
  );
  const inspirationExamplesBlock =
    formatInspirationExamplesBlock(inspirationExamples);

  // Step 4: Multi-step prompt hardening
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
    );
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
  };
}
