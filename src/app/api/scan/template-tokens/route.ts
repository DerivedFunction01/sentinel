import { NextResponse } from "next/server";
import { estimateTokens } from "@/lib/token-utils";
import { getPromptFile, PromptFileType } from "@/lib/prompt-loader";
import { patterns } from "@/lib/attack-templates";

let cached: Record<string, number> | null = null;

/**
 * Returns pre-computed token counts for stable prompt templates.
 * These are used by the scan-page cost widget to build CostEstimationItem[]
 * without needing server-side user-content tokenization.
 */
export async function GET() {
  if (cached) {
    return NextResponse.json(cached);
  }

  const suggestForbidden = estimateTokens(
    getPromptFile(PromptFileType.SuggestForbiddenTasks),
  );
  const systemPromptExtractor = estimateTokens(
    getPromptFile(PromptFileType.SystemPromptExtractor),
  );
  const extractSeedInfo = estimateTokens(
    getPromptFile(PromptFileType.ExtractSeedInfo),
  );
  const attackGenerator = estimateTokens(
    getPromptFile(PromptFileType.AttackGenerator),
  );
  const judge =
    estimateTokens(getPromptFile(PromptFileType.Judge)) +
    estimateTokens(getPromptFile(PromptFileType.JudgeEvaluationSuffix));
  const optimizationPrompt = estimateTokens(
    getPromptFile(PromptFileType.OptimizationPrompt),
  );

  const patternsCount = patterns.length;

  cached = {
    suggestForbidden,
    systemPromptExtractor,
    extractSeedInfo,
    attackGenerator,
    judge,
    optimizationPrompt,
    patternsCount,
    /** seed extractor template total */
    seedTemplate: systemPromptExtractor + suggestForbidden + extractSeedInfo,
    /** completion buffer for seed extraction step */
    seedCompletionBuffer: 1000,
    /** attack generator completion buffer (7200 tokens typical) */
    attackCompletionBuffer: 7200,
    /** per-trial target sim dynamic buffer */
    targetSimBuffer: 1000,
    /** per-trial target completion buffer */
    targetCompletionBuffer: 200,
    /** per-trial judge completion buffer */
    judgeCompletionBuffer: 100,
    /** re-eval completion buffer */
    reEvalCompletionBuffer: 200,
    /** number of re-eval trials budgeted */
    reEvalCount: 5,
    /** hardening completion buffer */
    hardenCompletionBuffer: 1500,
    /** tool extractor completion buffer */
    extractorCompletionBuffer: 1500,
  };

  return NextResponse.json(cached);
}
