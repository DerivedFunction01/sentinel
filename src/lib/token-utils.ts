import { getEncoding } from "js-tiktoken";
import { patterns } from "./attack-templates";
import { getPromptFile, PromptFileType } from "./prompt-loader";
import { TOKEN_CONSTANTS } from "./token-constants";

const enc = getEncoding("cl100k_base");

/**
 * Estimates the token count of a given string using the cl100k_base encoding (GPT-4 standard).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  try {
    return enc.encode(text).length;
  } catch (error) {
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
    count += TOKEN_CONSTANTS.MESSAGE_ROLE_OVERHEAD;
  }
  count += TOKEN_CONSTANTS.MESSAGE_STRUCTURAL_OVERHEAD;
  return count;
}

export function getModelPricing(modelId: string, dbModels: any[]) {
  const model = dbModels.find((m) => m.id === modelId);
  return {
    prompt: parseFloat(model?.promptPrice || "0.0000001"),
    completion: parseFloat(model?.completionPrice || "0.0000004"),
  };
}

/**
 * Returns pre-computed ontology token sizes from the cached template tokens.
 */
function getOntologySizes(dbModels: any[]): {
  mainAgentTokens: number;
  generalBusinessTokens: number;
  avgDomainTokens: number;
} {
  // Default values if not available
  return {
    mainAgentTokens: TOKEN_CONSTANTS.ONTOLOGY_DEFAULT_MAIN_AGENT_TOKENS,
    generalBusinessTokens:
      TOKEN_CONSTANTS.ONTOLOGY_DEFAULT_GENERAL_BUSINESS_TOKENS,
    avgDomainTokens: TOKEN_CONSTANTS.ONTOLOGY_DEFAULT_AVG_DOMAIN_TOKENS,
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
  templateTokens?: {
    mainAgentTokens?: number;
    generalBusinessTokens?: number;
    avgDomainTokens?: number;
  },
): number {
  let totalHold = 0;

  const seedPrice = getModelPricing(seedExtractorModel, dbModels);
  const attackPrice = getModelPricing(attackGeneratorModel, dbModels);
  const judgePrice = getModelPricing(judgeModel, dbModels);
  const hardenerPrice = getModelPricing(hardenerModel, dbModels);
  const extractorPrice = getModelPricing(extractorModel, dbModels);

  // Load template lengths dynamically for precise estimations
  const suggestForbiddenTokens = estimateTokens(
    getPromptFile(PromptFileType.SuggestForbiddenTasks),
  );
  const systemPromptExtractorTokens = estimateTokens(
    getPromptFile(PromptFileType.SystemPromptExtractor),
  );
  const extractSeedInfoTokens = estimateTokens(
    getPromptFile(PromptFileType.ExtractSeedInfo),
  );
  const generateConcreteScenariosTokens = estimateTokens(
    getPromptFile(PromptFileType.GenerateConcreteScenarios),
  );
  const classifyDomainTokens = estimateTokens(
    getPromptFile(PromptFileType.ClassifyDomain),
  );
  // const classifyRestrictionsTokens = estimateTokens(
  //   getPromptFile(PromptFileType.ClassifyRestrictions),
  // );
  const attackGeneratorTokens = estimateTokens(
    getPromptFile(PromptFileType.AttackGenerator),
  );
  const judgeTokens =
    estimateTokens(getPromptFile(PromptFileType.Judge)) +
    estimateTokens(getPromptFile(PromptFileType.JudgeEvaluationSuffix));
  const optimizationPromptTokens = estimateTokens(
    getPromptFile(PromptFileType.OptimizationPrompt),
  );

  // Use provided template tokens or defaults (with proper fallbacks for undefined values)
  const ontologyTokens = templateTokens
    ? {
        mainAgentTokens:
          templateTokens.mainAgentTokens ??
          TOKEN_CONSTANTS.ONTOLOGY_DEFAULT_MAIN_AGENT_TOKENS,
        generalBusinessTokens:
          templateTokens.generalBusinessTokens ??
          TOKEN_CONSTANTS.ONTOLOGY_DEFAULT_GENERAL_BUSINESS_TOKENS,
        avgDomainTokens:
          templateTokens.avgDomainTokens ??
          TOKEN_CONSTANTS.ONTOLOGY_DEFAULT_AVG_DOMAIN_TOKENS,
      }
    : getOntologySizes(dbModels);

  for (const prompt of prompts) {
    const sysPromptTokens = estimateTokens(prompt.systemPrompt || "");
    const forbiddenTokens = estimateTokens(prompt.forbiddenTask || "");
    const instructionsTokens = estimateTokens(prompt.judgeInstructions || "");
    const basePromptTokens =
      sysPromptTokens + forbiddenTokens + instructionsTokens;

    // Estimate trials dynamically instead of hardcoded 48
    const patternsCount = patterns.length;
    const totalTargetCount = patternsCount * 3;
    // Default to 4 when forbiddenTask is empty (matches the 4-item cap in suggestForbiddenTasks.md)
    let numThings = TOKEN_CONSTANTS.DEFAULT_NUM_THINGS;
    if (prompt.forbiddenTask?.trim()) {
      numThings =
        prompt.forbiddenTask
          .split(/\n\s*\n/)
          .map((t: string) => t.trim())
          .filter(Boolean).length || 1;
    }
    const countPerThing = Math.max(
      patternsCount,
      Math.ceil(totalTargetCount / numThings),
    );
    const estimatedTrials = numThings * countPerThing;

    // 1. Seed Extraction: includes domain classification + suggested tasks + seed extraction + concrete scenario generation
    // Ontology content is always included: main_agent + general_business + avg domain files
    const ontologyContentTokens =
      ontologyTokens.mainAgentTokens +
      ontologyTokens.generalBusinessTokens +
      ontologyTokens.avgDomainTokens; // Average 1-2 domain files

    const seedExtractorTemplateTokens =
      systemPromptExtractorTokens +
      suggestForbiddenTokens +
      extractSeedInfoTokens +
      generateConcreteScenariosTokens +
      classifyDomainTokens;
    // classifyRestrictionsTokens;
    const seedHold =
      (basePromptTokens + seedExtractorTemplateTokens + ontologyContentTokens) *
        seedPrice.prompt +
      TOKEN_CONSTANTS.SEED_EXTRACTION_COMPLETION_BUFFER * seedPrice.completion;

    // 2. Attack Gen: uses AttackGenerator template instructions
    const attackHold =
      (basePromptTokens + attackGeneratorTokens) * attackPrice.prompt +
      TOKEN_CONSTANTS.ATTACK_GEN_COMPLETION_BUFFER * attackPrice.completion;

    totalHold +=
      (seedHold + attackHold) * TOKEN_CONSTANTS.TOKEN_HOLD_SCALE_MULTIPLIER;

    // 3. Target models
    for (const targetId of targetModels) {
      const targetPrice = getModelPricing(targetId, dbModels);

      // Target Sim: system prompt + typical conversation history/tool schemas buffer
      const targetSimHold =
        estimatedTrials *
        ((basePromptTokens + TOKEN_CONSTANTS.TARGET_SIM_PROMPT_BUFFER) *
          targetPrice.prompt +
          TOKEN_CONSTANTS.TARGET_SIM_COMPLETION_BUFFER *
            targetPrice.completion);

      // Judge: base prompt + Judge instructions + JudgeEvaluationSuffix + reasoning outputs
      const judgeEvalHold =
        estimatedTrials *
        ((basePromptTokens + judgeTokens) * judgePrice.prompt +
          TOKEN_CONSTANTS.JUDGE_EVAL_COMPLETION_BUFFER * judgePrice.completion);

      // Re-evaluation borderline trials (budget up to 5) using JudgeReEvaluation template (roughly equal to judgeTokens)
      const reEvalHold =
        TOKEN_CONSTANTS.RE_EVAL_TRIALS_BUDGET *
        ((basePromptTokens + judgeTokens) * judgePrice.prompt +
          TOKEN_CONSTANTS.RE_EVAL_COMPLETION_BUFFER * judgePrice.completion);

      totalHold +=
        (targetSimHold + judgeEvalHold + reEvalHold) *
        TOKEN_CONSTANTS.TOKEN_HOLD_SCALE_MULTIPLIER;
    }

    // 4. Hardening
    if (enableHardening) {
      const hardenHold =
        (basePromptTokens + optimizationPromptTokens) * hardenerPrice.prompt +
        TOKEN_CONSTANTS.HARDENING_COMPLETION_BUFFER * hardenerPrice.completion;
      const toolExtractorHold =
        (basePromptTokens + extractSeedInfoTokens) * extractorPrice.prompt +
        TOKEN_CONSTANTS.TOOL_EXTRACTOR_COMPLETION_BUFFER *
          extractorPrice.completion;
      totalHold +=
        (hardenHold + toolExtractorHold) *
        TOKEN_CONSTANTS.TOKEN_HOLD_SCALE_MULTIPLIER;
    }
  }

  // 15% safety buffer
  return Math.ceil(totalHold * TOKEN_CONSTANTS.SAFETY_BUFFER_MULTIPLIER);
}

/**
 * Calculates the upfront token hold for a single trial re-evaluation.
 */
export function calculateSingleReevalHold(
  trial: any,
  referenceExamples: Array<{
    attack: string;
    response: string;
    reasoning: string;
  }>,
  forbiddenTask: string,
  judgeModel: string,
  dbModels: any[],
): number {
  const judge = dbModels.find((m) => m.id === judgeModel);
  const judgePrice = {
    prompt: parseFloat(judge?.promptPrice || "0.0000001"),
    completion: parseFloat(judge?.completionPrice || "0.0000004"),
  };

  const refText = referenceExamples
    .map((r) => `${r.attack}\n${r.response}\n${r.reasoning}`)
    .join("\n");

  const forbiddenTaskTokens = estimateTokens(forbiddenTask || "");
  const attackTokens = estimateTokens(trial.attack || "");
  const responseTokens = estimateTokens(trial.response || "");
  const transcriptTokens = estimateTokens(
    typeof trial.transcript === "string"
      ? trial.transcript
      : JSON.stringify(trial.transcript || ""),
  );
  const toolCallsTokens = estimateTokens(
    typeof trial.toolCalls === "string"
      ? trial.toolCalls
      : JSON.stringify(trial.toolCalls || ""),
  );

  const inputTokens =
    forbiddenTaskTokens +
    attackTokens +
    responseTokens +
    transcriptTokens +
    toolCallsTokens +
    estimateTokens(refText) +
    TOKEN_CONSTANTS.REEVAL_SYSTEM_PROMPT_OVERHEAD; // system prompt overhead buffer

  const upfrontHold = Math.ceil(
    (inputTokens * judgePrice.prompt +
      TOKEN_CONSTANTS.REEVAL_COMPLETION_BUFFER * judgePrice.completion) *
      TOKEN_CONSTANTS.TOKEN_HOLD_SCALE_MULTIPLIER *
      TOKEN_CONSTANTS.SAFETY_BUFFER_MULTIPLIER,
  );

  return upfrontHold;
}

export interface CloneHoldParams {
  trialCount: number;
  basePromptTokens: number;
  targetModel: string;
  judgeModel: string;
  mode: "reset-model" | "reset-judge";
  dbModels: any[];
}

export function estimateCloneHold({
  trialCount,
  basePromptTokens,
  targetModel,
  judgeModel,
  mode,
  dbModels,
}: CloneHoldParams): number {
  const targetPrice = getModelPricing(targetModel, dbModels);
  const targetTrialTokens =
    (basePromptTokens + TOKEN_CONSTANTS.TARGET_SIM_PROMPT_BUFFER) * targetPrice.prompt +
    TOKEN_CONSTANTS.TARGET_SIM_COMPLETION_BUFFER * targetPrice.completion;
  const targetTotal = trialCount * targetTrialTokens;

  const judgePrice = getModelPricing(judgeModel, dbModels);
  const judgeTemplateTokens =
    estimateTokens(getPromptFile(PromptFileType.Judge)) +
    estimateTokens(getPromptFile(PromptFileType.JudgeEvaluationSuffix));
  const judgeTrialTokens =
    (basePromptTokens + judgeTemplateTokens) * judgePrice.prompt +
    TOKEN_CONSTANTS.JUDGE_EVAL_COMPLETION_BUFFER * judgePrice.completion;
  const judgeTotal = trialCount * judgeTrialTokens;

  const total = mode === "reset-model" ? targetTotal + judgeTotal : judgeTotal;

  return Math.ceil(
    total *
      TOKEN_CONSTANTS.TOKEN_HOLD_SCALE_MULTIPLIER *
      TOKEN_CONSTANTS.SAFETY_BUFFER_MULTIPLIER,
  );
}

export async function processRefund(
  userId: string,
  upfrontHold: number | undefined,
  tracker: { totalCost: number },
  db: any,
  context?: string,
): Promise<{ finalTokenCost: number; refund: number }> {
  if (upfrontHold == null) return { finalTokenCost: 0, refund: 0 };

  const finalTokenCost = Math.ceil(tracker.totalCost * 1000000);
  const refund = Math.max(0, upfrontHold - finalTokenCost);

  await db.user.update({
    where: { id: userId },
    data: { scanTokens: { increment: refund } },
  });

  if (context) {
    console.log(
      `[refund] ${context}: upfront=${upfrontHold}, cost=${finalTokenCost}, refunded=${refund}`,
    );
  }

  return { finalTokenCost, refund };
}
