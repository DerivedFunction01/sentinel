/**
 * Shared hardening workflow used by both the scan pipeline and the
 * on-demand /api/scan/[id]/harden endpoint.
 *
 * Uses the fast-hardening module which implements:
 * - Protected restriction detection (skips tool extraction for covered restrictions)
 * - Direct-match fast path for database tools
 * - Slow path LLM extraction when needed
 * - Single-step prompt hardening with routing matrix
 */
import { type UsageTracker } from "@/lib/model-utils";
import {
  executeFastHardening,
  type FastHardeningParams,
  type FastHardeningResult,
} from "@/lib/fast-hardening";
import { type ToolDef, type Trial, type ScanMetadata, type BreachedAttack, type HardeningTrace } from "@/lib/types";
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
 * Delegates to executeFastHardening which handles:
 *   1. Check if restriction is already protected by existing tools
 *   2. Tool recommendation (skip if protected, run otherwise)
 *   3. Multi-step prompt hardening via executeMultiStepHardeningFull
 *   4. Fallback to deterministic hardening on error
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

  // Delegate to the fast-hardening module
  const fastParams: FastHardeningParams = {
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
    includeToolRecommendation,
  };

  const result: FastHardeningResult = await executeFastHardening(fastParams, callModel);

  // Handle the case where includeToolRecommendation is false
  // Protected tools should still be included, but new recommendations should be stripped
  let toolRecommendation = result.toolRecommendation;
  let compatibilityScore = result.compatibilityScore;

  if (!includeToolRecommendation && !result.protectedTools.length) {
    toolRecommendation = "";
    compatibilityScore = 0;
  }

  return {
    hardenedPrompt: result.hardenedPrompt,
    toolRecommendation,
    compatibilityScore,
    hardeningModelId: result.hardeningModelId,
    hardeningModelName: result.hardeningModelName,
    slowPathHit: result.slowPathHit,
  };
}