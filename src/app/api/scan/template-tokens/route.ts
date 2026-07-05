import { NextResponse } from "next/server";
import { estimateTokens } from "@/lib/token-utils";
import { getPromptFile, PromptFileType } from "@/lib/prompt-loader";
import { getJudgeEvaluationFixedPrefix } from "@/lib/scan-prompts";
import { patterns } from "@/lib/attack-templates";
import fs from "fs";
import path from "path";

const ONTOLOGY_DIR = path.join(process.cwd(), "uploads", "ontology");

let cached: Record<string, number> | null = null;

/**
 * Tokenize all ontology files and cache their sizes.
 * These are used to estimate seed extraction costs accurately.
 */
function getOntologyTokenSizes(): Record<string, number> {
  const files = [
    "main_agent.md",
    "general_business.md",
    "commerce.md",
    "finance.md",
    "medical.md",
    "legal.md",
    "cyber.md",
    "hiring.md",
    "technical_support.md",
    "infrastructure.md",
    "insurance.md",
    "law_enforcement.md",
    "real_estate.md",
    "roleplay_fiction.md",
    "high_risk_science.md",
    "accounting.md",
    "civics.md",
    "copyright_ip.md",
    "education.md",
  ];

  const sizes: Record<string, number> = {};
  for (const file of files) {
    const filePath = path.join(ONTOLOGY_DIR, file);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        // Extract body only (without frontmatter)
        const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/m);
        const body = match ? match[1].trim() : content.trim();
        sizes[file] = estimateTokens(body);
      } else {
        sizes[file] = 0;
      }
    } catch {
      sizes[file] = 0;
    }
  }

  // Calculate average for domain ontologies (all except main_agent and general_business)
  const domainFiles = Object.keys(sizes).filter(
    (f) => f !== "main_agent.md" && f !== "general_business.md" && sizes[f] > 0,
  );
  const avgDomain =
    domainFiles.length > 0
      ? Math.round(
          domainFiles.reduce((sum, f) => sum + sizes[f], 0) /
            domainFiles.length,
        )
      : 1000;

  return {
    mainAgent: sizes["main_agent.md"] || 100,
    generalBusiness: sizes["general_business.md"] || 2000,
    avgDomain: avgDomain,
  };
}

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

  // Re-evaluation specific templates
  const judgeReEvalTemplate = estimateTokens(
    getPromptFile(PromptFileType.JudgeReEvaluation),
  );
  const judgeFixedPrefix = estimateTokens(getJudgeEvaluationFixedPrefix());

  const patternsCount = patterns.length;

  // Get ontology token sizes
  const ontologySizes = getOntologyTokenSizes();

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
    /** re-eval user message template (JudgeReEvaluation.md) */
    judgeReEvalTemplate,
    /** re-eval system prompt (Judge.md with verdict labels filled in) */
    judgeFixedPrefix,
    /** combined static overhead for one re-eval call (system + user template) */
    judgeReEvalOverhead: judgeReEvalTemplate + judgeFixedPrefix,
    /** re-eval completion buffer */
    reEvalCompletionBuffer: 1000,
    /** number of re-eval trials budgeted (scan pipeline) */
    reEvalCount: 5,
    /** hardening completion buffer */
    hardenCompletionBuffer: 1500,
    /** tool extractor completion buffer */
    extractorCompletionBuffer: 1500,
    /** ontology token sizes for cost estimation */
    mainAgentTokens: ontologySizes.mainAgent,
    generalBusinessTokens: ontologySizes.generalBusiness,
    avgDomainTokens: ontologySizes.avgDomain,
  };

  return NextResponse.json(cached);
}
