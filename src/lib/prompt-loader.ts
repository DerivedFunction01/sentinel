import fs from "fs";
import path from "path";

export enum PromptFileType {
  Judge = "new_judge.md",
  AttackGenerator = "attack_gen_pre.md",
  SeedExtractor = "seed_extractor.md",
  AttackGeneratorUser = "attack_generator_user.md",
  JudgeEvaluationSuffix = "judge_evaluation_suffix.md",
  SuggestForbiddenTasks = "suggest_forbidden_tasks.md",
  SystemPromptExtractor = "system_prompt_extractor.md",
  OptimizationPrompt = "optimization_prompt.md",
  ExtractSeedInfo = "extract_seed_info.md",
  JudgeReEvaluation = "judge_re_evaluation.md",
  SearchQueryGenerator = "inspiration_prompts/search_query_generator.md",
  ScoringEvaluator = "inspiration_prompts/scoring_evaluator.md",
}

const promptCache: Record<PromptFileType, string | null> = {
  [PromptFileType.Judge]: null,
  [PromptFileType.AttackGenerator]: null,
  [PromptFileType.SeedExtractor]: null,
  [PromptFileType.AttackGeneratorUser]: null,
  [PromptFileType.JudgeEvaluationSuffix]: null,
  [PromptFileType.SuggestForbiddenTasks]: null,
  [PromptFileType.SystemPromptExtractor]: null,
  [PromptFileType.OptimizationPrompt]: null,
  [PromptFileType.ExtractSeedInfo]: null,
  [PromptFileType.JudgeReEvaluation]: null,
  [PromptFileType.SearchQueryGenerator]: null,
  [PromptFileType.ScoringEvaluator]: null,
};

export function getPromptFile(type: PromptFileType): string {
  if (promptCache[type] === null) {
    try {
      const filePath = path.join(
        process.cwd(),
        "uploads",
        "scan_prompts",
        type,
      );
      promptCache[type] = fs.readFileSync(filePath, "utf-8").trim();
    } catch (err) {
      console.error(`Failed to load prompt file ${type}:`, err);
      promptCache[type] = "";
    }
  }
  return promptCache[type]!;
}

const promptFileCache = new Map<string, string>();

export function loadPromptFile(filename: string): string {
  if (promptFileCache.has(filename)) {
    return promptFileCache.get(filename)!;
  }
  try {
    const filePath = path.join(
      process.cwd(),
      "uploads",
      "hardening_prompts",
      filename,
    );
    const content = fs.readFileSync(filePath, "utf-8").trim();
    promptFileCache.set(filename, content);
    return content;
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err);
    return "";
  }
}

export function processTemplateConditions(
  template: string,
  conditions: Record<string, boolean>,
): string {
  let result = template;
  for (const [tag, isTrue] of Object.entries(conditions)) {
    const startTag = `<${tag}>`;
    const endTag = `</${tag}>`;
    const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, "g");
    if (isTrue) {
      result = result.replace(regex, "$1");
    } else {
      result = result.replace(regex, "");
    }
  }
  return result;
}

export function replacePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  let result = template;
  for (const [key, val] of Object.entries(values)) {
    result = result.split(`{{${key}}}`).join(val ?? "");
  }
  return result;
}
