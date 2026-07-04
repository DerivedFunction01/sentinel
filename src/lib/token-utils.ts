import { getEncoding } from "js-tiktoken";
import { patterns } from "./attack-templates";
import { getPromptFile, PromptFileType } from "./prompt-loader";

const enc = getEncoding("cl100k_base");

/**
 * Estimates the token count of a given string using the cl100k_base encoding (GPT-4 standard).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  try {
    return enc.encode(text).length;
  } catch (error) {
    // Fallback: standard 1.3x word-to-token heuristic
    return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
  }
}

/**
 * Estimates the token count of an OpenAI/OpenRouter message payload.
 */
export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string | null }>,
): number {
  let count = 0;
  for (const msg of messages) {
    count += estimateTokens(msg.role);
    count += estimateTokens(msg.content || "");
    count += 4; // structural message overhead
  }
  count += 3; // response prefix overhead
  return count;
}

function getModelPricing(modelId: string, dbModels: any[]) {
  const model = dbModels.find((m) => m.id === modelId);
  return {
    prompt: parseFloat(model?.promptPrice || "0.0000001"),
    completion: parseFloat(model?.completionPrice || "0.0000004"),
  };
}

/**
 * Estimates the maximum upfront token hold required for a scan launch.
 * Uses a 1,000,000x multiplier scale and dynamic template lengths.
 */
export function calculateUpfrontScanHold(
  prompts: any[],
  targetModels: string[],
  seedExtractorModel: string,
  attackGeneratorModel: string,
  judgeModel: string,
  dbModels: any[],
  enableHardening: boolean,
  hardenerModel: string,
  extractorModel: string,
): number {
  let totalHold = 0;

  const seedPrice = getModelPricing(seedExtractorModel, dbModels);
  const attackPrice = getModelPricing(attackGeneratorModel, dbModels);
  const judgePrice = getModelPricing(judgeModel, dbModels);
  const hardenerPrice = getModelPricing(hardenerModel, dbModels);
  const extractorPrice = getModelPricing(extractorModel, dbModels);

  // Load template lengths dynamically for precise estimations
  const suggestForbiddenTokens = estimateTokens(getPromptFile(PromptFileType.SuggestForbiddenTasks));
  const systemPromptExtractorTokens = estimateTokens(getPromptFile(PromptFileType.SystemPromptExtractor));
  const extractSeedInfoTokens = estimateTokens(getPromptFile(PromptFileType.ExtractSeedInfo));
  const attackGeneratorTokens = estimateTokens(getPromptFile(PromptFileType.AttackGenerator));
  const judgeTokens = estimateTokens(getPromptFile(PromptFileType.Judge)) + estimateTokens(getPromptFile(PromptFileType.JudgeEvaluationSuffix));
  const optimizationPromptTokens = estimateTokens(getPromptFile(PromptFileType.OptimizationPrompt));

  for (const prompt of prompts) {
    const sysPromptTokens = estimateTokens(prompt.systemPrompt || "");
    const forbiddenTokens = estimateTokens(prompt.forbiddenTask || "");
    const instructionsTokens = estimateTokens(prompt.judgeInstructions || "");
    const basePromptTokens = sysPromptTokens + forbiddenTokens + instructionsTokens;

    // Estimate trials dynamically instead of hardcoded 48
    const patternsCount = patterns.length;
    const totalTargetCount = patternsCount * 3;
    let numThings = 3;
    if (prompt.forbiddenTask?.trim()) {
      numThings = prompt.forbiddenTask
        .split(/\n\s*\n/)
        .map((t: string) => t.trim())
        .filter(Boolean).length || 1;
    }
    const countPerThing = Math.max(patternsCount, Math.ceil(totalTargetCount / numThings));
    const estimatedTrials = numThings * countPerThing;

    // 1. Seed Extraction: includes domain classification + suggested tasks + seed extraction
    const seedExtractorTemplateTokens = systemPromptExtractorTokens + suggestForbiddenTokens + extractSeedInfoTokens;
    const seedHold = (basePromptTokens + seedExtractorTemplateTokens) * seedPrice.prompt + 1000 * seedPrice.completion;

    // 2. Attack Gen: uses AttackGenerator template instructions
    const attackHold = (basePromptTokens + attackGeneratorTokens) * attackPrice.prompt + 7200 * attackPrice.completion;

    totalHold += (seedHold + attackHold) * 1000000;

    // 3. Target models
    for (const targetId of targetModels) {
      const targetPrice = getModelPricing(targetId, dbModels);

      // Target Sim: system prompt + typical conversation history/tool schemas buffer
      const targetSimHold = estimatedTrials * ((basePromptTokens + 1000) * targetPrice.prompt + 200 * targetPrice.completion);

      // Judge: base prompt + Judge instructions + JudgeEvaluationSuffix + reasoning outputs
      const judgeEvalHold = estimatedTrials * ((basePromptTokens + judgeTokens) * judgePrice.prompt + 100 * judgePrice.completion);

      // Re-evaluation borderline trials (budget up to 5) using JudgeReEvaluation template (roughly equal to judgeTokens)
      const reEvalHold = 5 * ((basePromptTokens + judgeTokens) * judgePrice.prompt + 200 * judgePrice.completion);

      totalHold += (targetSimHold + judgeEvalHold + reEvalHold) * 1000000;
    }

    // 4. Hardening
    if (enableHardening) {
      const hardenHold = (basePromptTokens + optimizationPromptTokens) * hardenerPrice.prompt + 1500 * hardenerPrice.completion;
      const toolExtractorHold = (basePromptTokens + extractSeedInfoTokens) * extractorPrice.prompt + 1500 * extractorPrice.completion;
      totalHold += (hardenHold + toolExtractorHold) * 1000000;
    }
  }

  // 15% safety buffer
  return Math.ceil(totalHold * 1.15);
}
