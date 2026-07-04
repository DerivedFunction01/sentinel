import fs from "fs";
import path from "path";
import {
  HardeningTrace,
  BreachedAttack,
  SeedInfo,
  ScanMetadata,
  TrialTurn,
} from "./types";
import { CredentialMode } from "./enums";
import { ONTOLOGY_CATEGORY_VALUES } from "./ontology-categories";
import { TrialVerdict } from "@/lib/enums";
import { patterns, renderAttack, renderAttackV2 } from "@/lib/attack-templates";
import { parseFrontmatter } from "@/lib/tool-extractor";

import {
  PromptFileType,
  getPromptFile,
  loadPromptFile,
  processTemplateConditions,
  replacePlaceholders,
} from "@/lib/prompt-loader";

const ONTOLOGY_DIR = path.join(process.cwd(), "uploads", "ontology");

/**
 * Build a map of businessCategory → filename for all ontology markdown files.
 */
function buildCategoryToFilenameMap(): Record<string, string> {
  const map: Record<string, string> = {};
  try {
    if (!fs.existsSync(ONTOLOGY_DIR)) return map;
    const files = fs.readdirSync(ONTOLOGY_DIR).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(ONTOLOGY_DIR, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const { businessCategory } = parseFrontmatter(content);
        if (businessCategory) {
          map[businessCategory] = file;
        }
      } catch {}
    }
  } catch {}
  return map;
}

/**
 * Extract only the section body for a given section number from an ontology markdown file.
 * Sections are marked as `### N. Title` in the ontology files.
 * Returns the section content (without the frontmatter), or empty string if not found.
 */
function extractSectionBody(filePath: string, sectionNumber: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { body } = parseFrontmatter(content);
    if (!body) return "";

    const lines = body.split("\n");
    const targetHeader = `### ${sectionNumber}.`;
    let inSection = false;
    let sectionLines: string[] = [];
    let found = false;

    for (const line of lines) {
      const trimmed = line.trim();
      // Check if this is a header
      if (trimmed.match(/^###\s+\d+\./)) {
        if (inSection) {
          // We've reached the next section — stop
          break;
        }
        if (trimmed.startsWith(targetHeader)) {
          inSection = true;
          found = true;
          sectionLines.push(line);
          continue;
        }
      }
      if (inSection) {
        sectionLines.push(line);
      }
    }

    return found ? sectionLines.join("\n").trim() : "";
  } catch {
    return "";
  }
}

/**
 * Load ontology content for hardening prompts, respecting per-thing ontologySection IDs.
 *
 * When a RestrictionThing has an `ontologySection` (e.g. "RETAIL_HOSPITALITY_RESTAURANT/3"),
 * only that specific section is loaded from the corresponding ontology file.
 * Things without an ontologySection are ignored for per-section loading.
 * The `relevantFiles` list is used as a fallback for generic file-level content
 * that was not mapped to a specific thing section.
 */
function loadTargetedOntologyContent(
  things: { ontologySection?: string; forbiddenTask?: string }[],
  relevantFiles?: string[],
): string {
  const categoryToFilename = buildCategoryToFilenameMap();
  const seenSections = new Set<string>();
  let output = "";

  // 1. Load specific sections from things with ontologySection
  for (const thing of things) {
    const sectionId = thing.ontologySection;
    if (!sectionId) continue;

    // Avoid loading the same section twice
    if (seenSections.has(sectionId)) continue;
    seenSections.add(sectionId);

    const parts = sectionId.split("/");
    if (parts.length !== 2) continue;
    const [businessCategory, sectionNumber] = parts;

    const filename = categoryToFilename[businessCategory];
    if (!filename) continue;

    const filePath = path.join(ONTOLOGY_DIR, filename);
    if (!fs.existsSync(filePath)) continue;

    const sectionBody = extractSectionBody(filePath, sectionNumber);
    if (sectionBody) {
      output += `\n--- Policy Guidelines from ${filename} (Section ${sectionNumber}) ---\n${sectionBody}\n`;
    }
  }

  // 2. Load full files from relevantFiles that weren't already covered by section extraction
  //    Skip universal/meta files (general_business.md, main_agent.md) — they are only
  //    included when explicitly referenced via a RestrictionThing.ontologySection.
  const SKIP_UNLESS_REFERENCED = new Set([
    "general_business.md",
    "main_agent.md",
  ]);
  if (relevantFiles) {
    const coveredFiles = new Set<string>();
    for (const thing of things) {
      const sectionId = thing.ontologySection;
      if (!sectionId) continue;
      const parts = sectionId.split("/");
      if (parts.length !== 2) continue;
      const filename = categoryToFilename[parts[0]];
      if (filename) coveredFiles.add(filename);
    }

    for (const file of relevantFiles) {
      if (coveredFiles.has(file)) continue; // already covered via specific sections
      if (SKIP_UNLESS_REFERENCED.has(file)) continue; // only include via explicit section refs
      const filePath = path.join(ONTOLOGY_DIR, file);
      if (!fs.existsSync(filePath)) continue;
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/m);
        const body = match ? match[1].trim() : content.trim();
        output += `\n--- Policy Guidelines from ${file} ---\n${body}\n`;
      } catch {}
    }
  }

  return output;
}

function extractTaggedContent(
  text: string,
  startTag: string,
  endTag: string,
): string {
  const startIdx = text.indexOf(startTag);
  const endIdx = text.indexOf(endTag);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return text.substring(startIdx + startTag.length, endIdx).trim();
  } else if (startIdx !== -1) {
    return text.substring(startIdx + startTag.length).trim();
  } else if (endIdx !== -1) {
    return text.substring(0, endIdx).trim();
  }
  return "";
}

export function getSeedExtractorSystem(): string {
  const template = getPromptFile(PromptFileType.SeedExtractor);
  return replacePlaceholders(template, {
    BUSINESS_CATEGORIES: ONTOLOGY_CATEGORY_VALUES.join(", "),
  });
}

export const SEED_EXTRACTOR_USER_TEMPLATE = (
  systemPrompt: string,
  toolsJson: string,
  mockJson: string,
) => `<system_prompt>
${systemPrompt}
</system_prompt>

<tools>
${toolsJson}
</tools>

<mock_tool_responses>
${mockJson}
</mock_tool_responses>`;

/**
 * Static system prefix for the attack generator — fully cacheable across invocations.
 * Sent as the system message so providers can reuse the cached prefix.
 */
export function getAttackGeneratorSystemPrefix(): string {
  return getPromptFile(PromptFileType.AttackGenerator);
}

/**
 * Build the per-call user message for the attack generator.
 * Only the dynamic parts go here — thingName, thingDescription, instructions, etc.
 * This is small and varies per request, so it does not invalidate the system message cache.
 */
export function buildAttackGeneratorUserContent(
  seedInfo: SeedInfo,
  layout: {
    attackDescription: string;
    patternId: string;
  },
  credentialMode?: CredentialMode,
): string {
  const firstThing = seedInfo.things?.[0] || {};
  const {
    thingName = "",
    thingDescription = "",
    businessScenarios = [],
    credentials = [],
  } = firstThing;
  const { personaDescription = "", businessFeatures = [] } = seedInfo;
  const { attackDescription } = layout;

  const draftParts = renderAttackV2(
    patterns.find((p) => p.patternId === layout.patternId) || patterns[0],
    thingName,
    thingDescription,
  );

  const renderedParts = Array.isArray(draftParts) ? draftParts : [draftParts];
  const [opener, coreClaim, justification, closer] = renderedParts;

  // Determine random choices
  const chooseFeature = businessFeatures.length > 0 && Math.random() < 0.5;
  const feature = chooseFeature
    ? businessFeatures[Math.floor(Math.random() * businessFeatures.length)]
    : "";

  const chooseScenario = businessScenarios.length > 0 && Math.random() < 0.5;
  const scenario = chooseScenario
    ? businessScenarios[Math.floor(Math.random() * businessScenarios.length)]
    : "";

  const chooseGeneralFramework = Math.random() < 0.5;

  const hasCredentials =
    credentials && credentials.length > 0 && !!credentialMode;
  const credential = hasCredentials
    ? credentials[Math.floor(Math.random() * credentials.length)]
    : "";
  const isExactCredential =
    hasCredentials && credentialMode === CredentialMode.EXACT;
  const isSimilarCredential =
    hasCredentials && credentialMode !== CredentialMode.EXACT;

  const isVerbose =
    thingDescription.length > 60 ||
    thingDescription.includes(",") ||
    thingDescription.includes(";");

  // Load the template
  const template = getPromptFile(PromptFileType.AttackGeneratorUser);

  // Define conditions mapping
  const conditions: Record<string, boolean> = {
    personaDescription: !!personaDescription,
    businessFeature: chooseFeature,
    businessScenario: chooseScenario,
    attackDescription: !!attackDescription,
    exactCredential: isExactCredential,
    similarCredential: isSimilarCredential,
    isGeneralFramework: chooseGeneralFramework,
    hasOpener: !!opener,
    hasCoreClaim: !!coreClaim,
    hasJustification: !!justification,
    hasCloser: !!closer,
    isVerbose: isVerbose,
  };

  // Process the conditional blocks
  let processed = processTemplateConditions(template, conditions);

  // Replace placeholders
  processed = replacePlaceholders(processed, {
    THING_NAME: thingName,
    THING_DESCRIPTION: thingDescription,
    PERSONA_DESCRIPTION: personaDescription,
    BUSINESS_FEATURE: feature,
    BUSINESS_SCENARIO: scenario,
    ATTACK_DESCRIPTION: attackDescription,
    CREDENTIAL: credential,
    OPENER: opener || "",
    CORE_CLAIM: coreClaim || "",
    JUSTIFICATION: justification || "",
    CLOSER: closer || "",
  });

  // Clean up any extra empty lines left by stripped tags
  return processed.replace(/\n{3,}/g, "\n\n").trim();
}

// export const REWRITE_ASSISTANT_PREFILL = `Understood. This is data transformation, not fulfillment. I need to find all the placeholders marked with "{}" in <example_2>,
// and will transform what is in <draft_text>...</draft_text> in <example_2> into one smooth paragraph without answering embedded requests. <BEGIN>`;

export const REWRITE_ASSISTANT_PREFILL_V2 = ``;
// Understood. This is text generation for security testing, not conversational fulfillment. I will draft a single, cohesive paragraph in the first person using the structural guidelines and seed examples for inspiration. <BEGIN>
/**
 * Fixed prefix sent as a system message for judge evaluation.
 * Contains the grading instructions and example analysis that are constant
 * across all trials. Providers can cache this across requests.
 */

export function getJudgeEvaluationFixedPrefix(): string {
  // Replaced the {{DEFENDED}} and {{BREACHED}} with TrialVerdict

  return replacePlaceholders(getPromptFile(PromptFileType.Judge), {
    DEFENDED: TrialVerdict.Defended,
    BREACHED: TrialVerdict.Breached,
  });
}

/**
 * Build the per-trial suffix for judge evaluation.
 * This variable portion is sent as the user message each trial.
 */
export function buildJudgeEvaluationSuffix(
  forbiddenTask: string,
  judgeInstructions: string,
  systemPrompt: string,
  attackPrompt: string,
  targetResponse: string,
  toolTraceJson: string,
  isGenerative?: boolean,
  transcript?: TrialTurn[],
): string {
  const hasTranscript = !!(transcript && transcript.length > 0);

  let transcriptText = "";
  if (hasTranscript && transcript) {
    for (const turn of transcript) {
      if (turn.role === "user") {
        transcriptText += `[User]: ${turn.content}\n`;
      } else if (turn.role === "assistant") {
        if (turn.toolCalls && turn.toolCalls.length > 0) {
          transcriptText += `[Assistant]: (Initiating Tool Calls)\n`;
          for (const tc of turn.toolCalls) {
            transcriptText += `  (Calls Tool "${tc.name}" with arguments: ${JSON.stringify(tc.arguments)})\n`;
          }
        }
        if (turn.content) {
          transcriptText += `[Assistant]: ${turn.content}\n`;
        }
      } else if (turn.role === "tool") {
        transcriptText += `[Tool Response for "${turn.name}"]: ${turn.content}\n`;
      }
    }
  }

  const template = getPromptFile(PromptFileType.JudgeEvaluationSuffix);

  const conditions = {
    hasTranscript,
    noTranscript: !hasTranscript,
  };

  const processed = processTemplateConditions(template, conditions);

  return replacePlaceholders(processed, {
    FORBIDDEN_TASK: forbiddenTask,
    JUDGE_INSTRUCTIONS: judgeInstructions,
    SYSTEM_PROMPT: systemPrompt,
    TRANSCRIPT_TEXT: transcriptText.trim(),
    TOOL_TRACE: toolTraceJson,
    IS_GENERATIVE: String(isGenerative ?? false),
    ATTACK_PROMPT: attackPrompt,
    TARGET_RESPONSE: targetResponse,
    VERDICT_BREACHED: TrialVerdict.Breached,
    VERDICT_DEFENDED: TrialVerdict.Defended,
  });
}

// ── Additional Seed and Optimization Templates ──

export const OPTIMIZATION_PROMPT = getPromptFile(
  PromptFileType.OptimizationPrompt,
);

export function getOptDetectorInstructions(systemPrompt: string): string {
  const template = loadPromptFile("instructions_template_opt_detector.md");
  return replacePlaceholders(template, { SYSTEM_PROMPT: systemPrompt });
}

export function getOptTranslatorInstructions(targetLanguage: string): string {
  const template = loadPromptFile("instructions_template_opt_translator.md");
  return replacePlaceholders(template, { TARGET_LANGUAGE: targetLanguage });
}

interface OptDetectorResult {
  language: string;
  optimizationPrompt: string | null;
  cleanedPrompt: string;
}

async function runOptDetector(
  callModel: (prompt: string) => Promise<string>,
  systemPrompt: string,
  trace?: HardeningTrace,
): Promise<OptDetectorResult> {
  const instructions = getOptDetectorInstructions(systemPrompt);
  try {
    const res = await callModel(instructions);
    const language =
      extractTaggedContent(res, "<LANGUAGE>", "</LANGUAGE>") || "English";
    const optimizationPrompt =
      extractTaggedContent(res, "<OPT_PROMPT>", "</OPT_PROMPT>") || null;
    const cleanedPrompt =
      extractTaggedContent(res, "<CLEANED_PROMPT>", "</CLEANED_PROMPT>") ||
      systemPrompt;
    const parsed: OptDetectorResult = {
      language,
      optimizationPrompt,
      cleanedPrompt,
    };
    if (trace) {
      trace.optDetector = {
        promptSent: instructions,
        output: parsed,
      };
    }
    return parsed;
  } catch (err) {
    console.error("Opt detector step failed:", err);
    return {
      language: "English",
      optimizationPrompt: null,
      cleanedPrompt: systemPrompt,
    };
  }
}

async function runOptTranslator(
  callModel: (prompt: string) => Promise<string>,
  targetLanguage: string,
  trace?: HardeningTrace,
): Promise<string> {
  if (targetLanguage.toLowerCase() === "english") {
    return OPTIMIZATION_PROMPT.trim();
  }
  const instructions = getOptTranslatorInstructions(targetLanguage);
  try {
    const res = await callModel(instructions);
    const translated = extractTaggedContent(
      res,
      "<TRANSLATION>",
      "</TRANSLATION>",
    );
    if (trace) {
      trace.optTranslator = {
        promptSent: instructions,
        output: translated || res,
      };
    }
    return translated || OPTIMIZATION_PROMPT.trim();
  } catch (err) {
    console.error("Opt translator step failed:", err);
    return OPTIMIZATION_PROMPT.trim();
  }
}

export function getHardenedPromptCompactionInstructions(
  systemPrompt: string,
  changedSentences: string,
): string {
  const template = loadPromptFile("instructions_template_compaction.md");
  return replacePlaceholders(template, {
    SYSTEM_PROMPT: systemPrompt,
    CHANGED_SENTENCES: changedSentences,
  });
}

export function getHardenedPromptStep1Instructions(
  systemPrompt: string,
  forbiddenTask: string,
  breachedAttacks: BreachedAttack[],
  recommendedTools?: any[],
  summarizedPatterns?: string,
  metadata?: ScanMetadata,
): string {
  const hasTools = !!(recommendedTools && recommendedTools.length > 0);
  const hasBreaches = breachedAttacks.length > 0;
  const hasSummarized = !!summarizedPatterns;

  let ontologyContent = "";
  if (metadata?.seedExtraction) {
    const things = metadata.seedExtraction.things || [];
    const relevantFiles = metadata.seedExtraction.relevantFiles;
    ontologyContent = loadTargetedOntologyContent(things, relevantFiles);
  }

  const template = loadPromptFile("instructions_template_step1.md");
  const step1Text = loadPromptFile("step1.md");

  const conditions = {
    hasTools,
    hasBreachedAttacks: hasBreaches,
    hasSummarizedPatterns: hasBreaches && hasSummarized,
    noSummarizedPatterns: hasBreaches && !hasSummarized,
    noBreachedAttacks: !hasBreaches,
    hasOntologyContent: !hasTools && !!ontologyContent,
  };

  const processed = processTemplateConditions(template, conditions);

  const toolsJson = hasTools
    ? JSON.stringify(
        recommendedTools.map((t) => {
          const toolObj = t.toolJson || t;
          const fn = toolObj.function;
          return {
            name: t.name || fn?.name || toolObj.name,
            description: fn?.description || toolObj.description,
          };
        }),
        null,
        2,
      )
    : "";

  const attacksList = hasBreaches
    ? breachedAttacks.map((a, i) => `${i + 1}. "${a.attack}"`).join("\n")
    : "";

  return replacePlaceholders(processed, {
    SYSTEM_PROMPT: systemPrompt,
    FORBIDDEN_TASK: forbiddenTask,
    STEP_1_TEXT: step1Text,
    TOOLS_JSON: toolsJson,
    SUMMARIZED_PATTERNS: summarizedPatterns || "",
    BREACHED_ATTACKS_LIST: attacksList,
    ONTOLOGY_CONTENT: ontologyContent,
  });
}

export function getHardenedPromptStep1FullInstructions(
  systemPrompt: string,
  forbiddenTask: string,
  breachedAttacks: BreachedAttack[],
  recommendedTools?: any[],
  summarizedPatterns?: string,
  metadata?: ScanMetadata,
): string {
  const hasTools = !!(recommendedTools && recommendedTools.length > 0);
  const hasBreaches = breachedAttacks.length > 0;
  const hasSummarized = !!summarizedPatterns;

  let ontologyContent = "";
  if (metadata?.seedExtraction) {
    const things = metadata.seedExtraction.things || [];
    const relevantFiles = metadata.seedExtraction.relevantFiles;
    ontologyContent = loadTargetedOntologyContent(things, relevantFiles);
  }

  const template = loadPromptFile("instructions_template_step1_full.md");
  const step1Text = loadPromptFile("step1.md");

  const conditions = {
    hasTools,
    hasBreachedAttacks: hasBreaches,
    hasSummarizedPatterns: hasBreaches && hasSummarized,
    noSummarizedPatterns: hasBreaches && !hasSummarized,
    noBreachedAttacks: !hasBreaches,
    hasOntologyContent: !hasTools && !!ontologyContent,
  };

  const processed = processTemplateConditions(template, conditions);

  const toolsJson = hasTools
    ? JSON.stringify(
        recommendedTools.map((t) => {
          const toolObj = t.toolJson || t;
          const fn = toolObj.function;
          return {
            name: t.name || fn?.name || toolObj.name,
            description: fn?.description || toolObj.description,
          };
        }),
        null,
        2,
      )
    : "";

  const attacksList = hasBreaches
    ? breachedAttacks.map((a, i) => `${i + 1}. "${a.attack}"`).join("\n")
    : "";

  return replacePlaceholders(processed, {
    SYSTEM_PROMPT: systemPrompt,
    FORBIDDEN_TASK: forbiddenTask,
    STEP_1_TEXT: step1Text,
    TOOLS_JSON: toolsJson,
    SUMMARIZED_PATTERNS: summarizedPatterns || "",
    BREACHED_ATTACKS_LIST: attacksList,
    ONTOLOGY_CONTENT: ontologyContent,
  });
}

export function getHardenedPromptStep2Instructions(
  intermediatePrompt: string,
  forbiddenTask: string,
  breachedAttacks: BreachedAttack[],
  recommendedTools?: any[],
  summarizedPatterns?: string,
  metadata?: ScanMetadata,
): string {
  const hasTools = !!(recommendedTools && recommendedTools.length > 0);
  const hasBreaches = breachedAttacks.length > 0;
  const hasSummarized = !!summarizedPatterns;

  let ontologyContent = "";
  if (metadata?.seedExtraction) {
    const things = metadata.seedExtraction.things || [];
    const relevantFiles = metadata.seedExtraction.relevantFiles;
    ontologyContent = loadTargetedOntologyContent(things, relevantFiles);
  }

  const template = loadPromptFile("instructions_template_step2.md");
  const step2Text = hasTools
    ? loadPromptFile("step2_with_tools.md")
    : loadPromptFile("step2_without_tools.md");

  const sharedRules = loadPromptFile("shared_guardrail_rules.md");

  const conditions = {
    hasTools,
    hasBreachedAttacks: hasBreaches,
    hasSummarizedPatterns: hasBreaches && hasSummarized,
    noSummarizedPatterns: hasBreaches && !hasSummarized,
    noBreachedAttacks: !hasBreaches,
    hasOntologyContent: !hasTools && !!ontologyContent,
  };

  const processed = processTemplateConditions(template, conditions);

  const toolsJson = hasTools
    ? JSON.stringify(
        recommendedTools.map((t) => {
          const toolObj = t.toolJson || t;
          const fn = toolObj.function;
          return {
            name: t.name || fn?.name || toolObj.name,
            description: fn?.description || toolObj.description,
          };
        }),
        null,
        2,
      )
    : "";

  const attacksList = hasBreaches
    ? breachedAttacks.map((a, i) => `${i + 1}. "${a.attack}"`).join("\n")
    : "";

  return replacePlaceholders(processed, {
    SYSTEM_PROMPT: intermediatePrompt,
    FORBIDDEN_TASK: forbiddenTask,
    STEP_2_TEXT: step2Text,
    SHARED_GUARDRAIL_RULES: sharedRules,
    TOOLS_JSON: toolsJson,
    SUMMARIZED_PATTERNS: summarizedPatterns || "",
    BREACHED_ATTACKS_LIST: attacksList,
    ONTOLOGY_CONTENT: ontologyContent,
  });
}

function extractSystemPrompt(text: string): string {
  const startTag = "<SYSTEM_PROMPT>";
  const endTag = "</SYSTEM_PROMPT>";
  const startIdx = text.indexOf(startTag);
  const endIdx = text.indexOf(endTag);

  let result = text;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    result = text.substring(startIdx + startTag.length, endIdx).trim();
  } else if (startIdx !== -1) {
    result = text.substring(startIdx + startTag.length).trim();
  } else if (endIdx !== -1) {
    result = text.substring(0, endIdx).trim();
  }

  // Fallback cleanup
  result = result
    .replace(/^```[a-zA-Z]*\n/g, "")
    .replace(/\n```$/g, "")
    .trim();
  if (result.startsWith("REVISED SYSTEM PROMPT")) {
    result = result.substring("REVISED SYSTEM PROMPT".length).trim();
  }

  return result;
}

/* Old Code
export async function executeMultiStepHardening(
  callModel: (prompt: string) => Promise<string>,
  systemPrompt: string,
  forbiddenTask: string,
  breachedAttacks: BreachedAttack[],
  recommendedTools?: any[],
  inspirationExamplesBlock?: string,
  trace?: HardeningTrace,
  summarizedPatterns?: string,
  metadata?: ScanMetadata,
): Promise<string> {
  // ── Pre-step: Optimization Prompt Detection & Language Identification ──
  // DISABLED: Commented out to reduce token costs. Can be re-enabled later if needed.
  // Detects the prompt language, strips any existing optimization block, and
  // returns a "cleaned" prompt so hardening steps work on uncontaminated content.
  // const detectorResult = await runOptDetector(callModel, systemPrompt, trace);
  // const detectedLanguage = detectorResult.language || "English";
  // const workingPrompt = detectorResult.cleanedPrompt || systemPrompt;

  // Use systemPrompt directly since opt detection is disabled
  const workingPrompt = systemPrompt;
  const detectedLanguage = "English"; // Default since detector is disabled

  // ── Step 1: Tool Delegation ──
  const step1Instructions = getHardenedPromptStep1Instructions(
    workingPrompt,
    forbiddenTask,
    breachedAttacks,
    recommendedTools,
    summarizedPatterns,
    metadata,
  );

  let changedSentences = "";
  try {
    const res = await callModel(step1Instructions);
    changedSentences = extractTaggedContent(
      res || "",
      "<CHANGED_SENTENCES>",
      "</CHANGED_SENTENCES>",
    );
    if (trace) {
      trace.step1 = {
        promptSent: step1Instructions,
        changedSentencesRaw: changedSentences,
      };
    }
  } catch (err) {
    console.error("Step 1 of prompt hardening failed:", err);
  }

  // ── Step 1.5: Compaction ──
  // Start from original prompt; compaction applies the diff
  let compactedPrompt = workingPrompt;
  if (changedSentences) {
    const compactionInstructions = getHardenedPromptCompactionInstructions(
      workingPrompt,
      changedSentences,
    );
    try {
      const res = await callModel(compactionInstructions);
      compactedPrompt = extractSystemPrompt(res || "");
      if (trace) {
        trace.compaction = {
          promptSent: compactionInstructions,
          outputPrompt: compactedPrompt,
        };
      }
    } catch (err) {
      console.error("Compaction step of prompt hardening failed:", err);
      compactedPrompt = workingPrompt;
    }
  }

  // ── Step 2: Guardrails Addition ──
  // CONDITIONAL: Skip when tools are present and enforce restrictions (rules as code pattern)
  // When tools handle the forbidden task, we skip Step 2 to avoid redundant guardrails
  let finalPrompt = compactedPrompt;
  const hasToolsEnforcingRestrictions =
    recommendedTools && recommendedTools.length > 0;

  if (!hasToolsEnforcingRestrictions) {
    // Only run Step 2 when no tools are present to enforce restrictions
    const step2Instructions = getHardenedPromptStep2Instructions(
      compactedPrompt,
      forbiddenTask,
      breachedAttacks,
      recommendedTools,
      summarizedPatterns,
      metadata,
    );

    let step2FinalPrompt = "";
    try {
      const res = await callModel(step2Instructions);
      step2FinalPrompt = extractSystemPrompt(res || "");
      if (trace) {
        trace.step2 = {
          promptSent: step2Instructions,
          outputPrompt: step2FinalPrompt,
        };
      }
      finalPrompt = step2FinalPrompt;
    } catch (err) {
      console.error("Step 2 of prompt hardening failed:", err);
      finalPrompt = compactedPrompt;
    }
  } else {
    // Tools are enforcing restrictions, so skip Step 2 (rules as code pattern)
    // The tool definitions already handle the forbidden task dynamically
    if (trace) {
      trace.step2 = {
        skipped: true,
        reason: "Tools present to enforce restrictions (rules as code pattern)",
      };
    }
  }

  if (finalPrompt.includes("<system_prompt>")) {
    finalPrompt = finalPrompt.split("<system_prompt>")[1];
  }
  if (finalPrompt.includes("</system_prompt>")) {
    finalPrompt = finalPrompt.split("</system_prompt>")[0];
  }

  // ── Post-step: Optimization Prompt Translation & Append ──
  // DISABLED: Commented out to reduce token costs. Can be re-enabled later if needed.
  // Translate the optimization prompt into the detected language (no-op for English)
  // and append it to the final hardened prompt.
  // const translatedOptPrompt = await runOptTranslator(
  //   callModel,
  //   detectedLanguage,
  //   trace,
  // );
  // finalPrompt = `${translatedOptPrompt}\n\n${finalPrompt.trim()}`;

  return finalPrompt.trim();
}
*/
export async function executeMultiStepHardeningFull(
  callModel: (prompt: string) => Promise<string>,
  systemPrompt: string,
  forbiddenTask: string,
  breachedAttacks: BreachedAttack[],
  recommendedTools?: any[],
  inspirationExamplesBlock?: string,
  trace?: HardeningTrace,
  summarizedPatterns?: string,
  metadata?: ScanMetadata,
): Promise<string> {
  const workingPrompt = systemPrompt;

  // ── Step 1: Tool Delegation (Outputs Full Prompt) ──
  const step1Instructions = getHardenedPromptStep1FullInstructions(
    workingPrompt,
    forbiddenTask,
    breachedAttacks,
    recommendedTools,
    summarizedPatterns,
    metadata,
  );

  let hardenedPrompt = workingPrompt;
  try {
    const res = await callModel(step1Instructions);
    const extracted = extractTaggedContent(
      res || "",
      "<REVISED_SYSTEM_PROMPT>",
      "</REVISED_SYSTEM_PROMPT>",
    );
    if (extracted) {
      hardenedPrompt = extracted.trim();
    } else {
      hardenedPrompt = extractSystemPrompt(res || "");
    }

    if (trace) {
      trace.step1 = {
        promptSent: step1Instructions,
        changedSentencesRaw: res,
      };
      trace.compaction = {
        promptSent: "(Compaction bypassed; Step 1 outputted full prompt)",
        outputPrompt: hardenedPrompt,
      };
    }
  } catch (err) {
    console.error("Step 1 of full prompt hardening failed:", err);
  }

  // ── Step 2: Guardrails Addition ──
  // Bypassed completely in executeMultiStepHardeningFull
  let finalPrompt = hardenedPrompt;
  if (trace) {
    trace.step2 = {
      skipped: true,
      reason: "Step 2 bypassed in executeMultiStepHardeningFull",
    };
  }

  if (finalPrompt.includes("<system_prompt>")) {
    finalPrompt = finalPrompt.split("<system_prompt>")[1];
  }
  if (finalPrompt.includes("</system_prompt>")) {
    finalPrompt = finalPrompt.split("</system_prompt>")[0];
  }

  return finalPrompt.trim();
}

export function getDeterministicHardenedPrompt(systemPrompt: string): string {
  return `${OPTIMIZATION_PROMPT.trim()}\n${systemPrompt}`;
}
