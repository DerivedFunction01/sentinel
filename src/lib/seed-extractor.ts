import fs from "fs";
import path from "path";
import {
  callOpenRouter,
  UsageTracker,
  parseReasoningAndOutput,
} from "@/lib/model-utils";
import { SeedInfo, RestrictionThing } from "@/lib/types";
import { parseFrontmatter, getOntologySectionsFromContent, OntologySection } from "@/lib/frontmatter-utils";
import {
  PromptFileType,
  getPromptFile,
  replacePlaceholders,
} from "@/lib/prompt-loader";
import { extractTaggedContent } from "@/lib/model-utils";
import { RestrictionCategory } from "./enums";

const ONTOLOGY_DIR = path.join(process.cwd(), "uploads", "ontology");

function getCategoryForFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { businessCategory } = parseFrontmatter(content);
    return businessCategory || "GENERAL";
  } catch {
    return "GENERAL";
  }
}

/**
 * Step 1: LLM-based Domain Classifier
 * Asks LLM to select relevant ontology files; derives categories from frontmatter.
 */
async function classifyDomain(
  extractorModel: string,
  systemPrompt: string,
  toolsJson: string,
  tracker?: UsageTracker,
): Promise<{ categories: string[]; relevantFiles: string[] }> {
  try {
    // Get all available markdown files in uploads/ontology (excluding main_agent.md)
    let filesWithSections: string[] = [];
    if (fs.existsSync(ONTOLOGY_DIR)) {
      const files = fs
        .readdirSync(ONTOLOGY_DIR)
        .filter((f) => f.endsWith(".md") && f !== "main_agent.md");
      for (const file of files) {
        const filePath = path.join(ONTOLOGY_DIR, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const category = getCategoryForFile(filePath);
        const sections = getOntologySectionsFromContent(content);
        if (sections.length > 0) {
          filesWithSections.push(
            `- ${file} (contains policy sections: ${sections.map((s) => s.label).join(", ")})`,
          );
        } else {
          filesWithSections.push(`- ${file}`);
        }
      }
    }

    const template = getPromptFile(PromptFileType.ClassifyDomain);
    const systemMessage = replacePlaceholders(template, {
      FILES_WITH_SECTIONS: filesWithSections.join("\n"),
    });

    const userMessage = `<system_prompt>\n${systemPrompt}\n</system_prompt>\n\n<tools>\n${toolsJson}\n</tools>`;

    const response = await callOpenRouter(
      extractorModel,
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      undefined,
      tracker,
    );

    const content = response.content || "";
    const cleanContent = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanContent);
    const relevantFiles: string[] = Array.isArray(parsed.relevantFiles)
      ? parsed.relevantFiles
      : [];

    // Derive categories from frontmatter of each selected file
    const categories: string[] = [];
    for (const file of relevantFiles) {
      const filePath = path.join(ONTOLOGY_DIR, file);
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const { businessCategory } = parseFrontmatter(fileContent);
          if (businessCategory && !categories.includes(businessCategory)) {
            categories.push(businessCategory);
          }
        } catch {
          // skip unparseable files
        }
      }
    }

    if (categories.length === 0) {
      categories.push("GENERAL");
    }

    return { categories, relevantFiles };
  } catch (error) {
    console.error("Error in classifyDomain:", error);
    return { categories: ["GENERAL"], relevantFiles: [] };
  }
}

export async function suggestForbiddenTasks(
  extractorModel: string,
  systemPrompt: string,
  tracker?: UsageTracker,
): Promise<string> {
  const systemMessage = getPromptFile(PromptFileType.SuggestForbiddenTasks);

  const userMessage = `<system_prompt>\n${systemPrompt}\n</system_prompt>`;

  const response = await callOpenRouter(
    extractorModel,
    [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    undefined,
    tracker,
  );

  let text = (response.content || "").trim();
  return parseReasoningAndOutput(text);
}

export async function extractCoreSystemPrompt(
  extractorModel: string,
  systemPrompt: string,
  tracker?: UsageTracker,
): Promise<string> {
  const systemMessage = getPromptFile(PromptFileType.SystemPromptExtractor);

  const userMessage = `<system_prompt>\n${systemPrompt}\n</system_prompt>`;

  const response = await callOpenRouter(
    extractorModel,
    [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    undefined,
    tracker,
  );

  let text = (response.content || "").trim();
  return parseReasoningAndOutput(text);
}


function cleanMockJson(mockJsonStr: string): string {
  try {
    const parsed = JSON.parse(mockJsonStr);
    if (typeof parsed !== "object" || parsed === null) return mockJsonStr;

    const cleaned: Record<string, any> = {};
    for (const [toolName, toolResponse] of Object.entries(parsed)) {
      if (typeof toolResponse === "object" && toolResponse !== null) {
        const cleanedResponse = { ...(toolResponse as Record<string, any>) };
        delete cleanedResponse.policy;
        delete cleanedResponse.exceptions;
        delete cleanedResponse.require_explicit_human_approval;
        delete cleanedResponse.escalate_to_support;
        cleaned[toolName] = cleanedResponse;
      } else {
        cleaned[toolName] = toolResponse;
      }
    }
    return JSON.stringify(cleaned, null, 2);
  } catch {
    return mockJsonStr;
  }
}

/**
 * Step 2: Rich Seed and Restriction Extraction
 * Uses loaded ontologies and the system prompt/tools to extract structured seed information.
 * If coreSystemPrompt is provided, it will be used instead of extracting it.
 */
export async function extractSeedInfo(
  extractorModel: string,
  systemPrompt: string,
  toolsJson: string,
  mockJson: string,
  forbiddenTask?: string,
  tracker?: UsageTracker,
  coreSystemPrompt?: string,
): Promise<SeedInfo> {
  const cleanedMockJson = cleanMockJson(mockJson);

  // 1. Run Domain Classification
  const { categories, relevantFiles } = await classifyDomain(
    extractorModel,
    coreSystemPrompt ?? systemPrompt,
    toolsJson,
    tracker,
  );

  // 2. Load Ontologies & Build Section Buckets
  let ontologyContent = "";
  const domainSections: OntologySection[] = [];
  const metaSections: OntologySection[] = [];

  try {
    // Always load main_agent.md into meta sections
    const mainAgentPath = path.join(ONTOLOGY_DIR, "main_agent.md");
    if (fs.existsSync(mainAgentPath)) {
      ontologyContent += `\n=== ONTOLOGY: main_agent.md ===\n${fs.readFileSync(mainAgentPath, "utf-8")}\n`;
      const mainContent = fs.readFileSync(mainAgentPath, "utf-8");
      metaSections.push(...getOntologySectionsFromContent(mainContent));
    }

    // Load general_business.md if matched
    const loadBusiness = relevantFiles.includes("general_business.md");
    if (loadBusiness) {
      const bizPath = path.join(ONTOLOGY_DIR, "general_business.md");
      if (fs.existsSync(bizPath)) {
        ontologyContent += `\n=== ONTOLOGY: general_business.md ===\n${fs.readFileSync(bizPath, "utf-8")}\n`;
        const bizContent = fs.readFileSync(bizPath, "utf-8");
        domainSections.push(...getOntologySectionsFromContent(bizContent));
      }
    }

    // Load other selected domain ontologies
    for (const file of relevantFiles) {
      if (file === "general_business.md" || file === "main_agent.md") continue;
      const filePath = path.join(ONTOLOGY_DIR, file);
      if (fs.existsSync(filePath)) {
        ontologyContent += `\n=== ONTOLOGY: ${file} ===\n${fs.readFileSync(filePath, "utf-8")}\n`;
        const fileContent = fs.readFileSync(filePath, "utf-8");
        domainSections.push(...getOntologySectionsFromContent(fileContent));
      }
    }
  } catch (error) {
    console.error("Error loading ontology files:", error);
  }

  // 3. Resolve Target Forbidden Tasks
  let targetTasks: string[] = [];
  if (forbiddenTask && forbiddenTask.trim()) {
    targetTasks = forbiddenTask
      .split(/\n\s*\n/)
      .map((t) => t.trim())
      .filter(Boolean);
  } else {
    try {
      const suggested = await suggestForbiddenTasks(
        extractorModel,
        systemPrompt,
        tracker,
      );
      targetTasks = suggested
        .split(/\n\s*\n/)
        .map((t) => t.trim())
        .filter(Boolean);
    } catch (error) {
      console.error(
        "Error running suggestForbiddenTasks inside extractSeedInfo:",
        error,
      );
    }
  }

  // 4. Perform Rich Seed and Restriction Extraction
  const template = getPromptFile(PromptFileType.ExtractSeedInfo);
  const domainText = domainSections
    .map((s) => `  ${s.id} — ${s.label}`)
    .join("\n");
  const metaText = metaSections.map((s) => `  ${s.id} — ${s.label}`).join("\n");

  const systemPromptExtractor = replacePlaceholders(template, {
    DOMAIN_SECTIONS: domainText,
    META_SECTIONS: metaText,
  });

  // Use the core sanitized prompt (computed after try block resolves)
  // This saves tokens by sending a compacted prompt instead of the full defensive one
  const promptForExtraction = coreSystemPrompt ?? systemPrompt;

  const userPromptExtractor = `<target_forbidden_tasks>
${targetTasks.map((t) => `- ${t}`).join("\n")}
</target_forbidden_tasks>

  <system_prompt>
  ${promptForExtraction}
  </system_prompt>

  <tools>
  ${toolsJson}
  </tools>

  <mock_tool_responses>
  ${cleanedMockJson}
  </mock_tool_responses>

  <matched_ontologies>
  ${ontologyContent || "No specific ontologies loaded."}
  </matched_ontologies>`;

  const defaultSeed: SeedInfo = {
    things: [],
    personaDescription: "general AI assistant",
    businessFeatures: [],
    businessCategories: categories,
    isGenerative: false,
  };

  try {
    const response = await callOpenRouter(
      extractorModel,
      [
        { role: "system", content: systemPromptExtractor },
        { role: "user", content: userPromptExtractor },
      ],
      undefined,
      tracker,
    );

    const content = response.content || "";
    const cleanContent = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanContent);

    const things: RestrictionThing[] = (
      Array.isArray(parsed.things) ? parsed.things : []
    ).filter((t: any) => {
      if (t.isPresent === false || t.isPresent === "false") {
        return false;
      }
      if (typeof t.ontologySection === "string") {
        const match = t.ontologySection.match(/^GENERAL_AGENT\/(\d+)$/);
        if (match) {
          const sectionNum = parseInt(match[1], 10);
          if (sectionNum >= 8 && sectionNum <= 21) {
            return false;
          }
        }
      }
      return true;
    });

    // Augment scenarios with concrete, generated user queries
    const thingsWithScenarios = await augmentThingsWithConcreteScenarios(
      things,
      extractorModel,
      promptForExtraction,
      tracker,
    );

    return {
      things: thingsWithScenarios,
      personaDescription:
        parsed.personaDescription || defaultSeed.personaDescription,
      businessFeatures: parsed.businessFeatures || defaultSeed.businessFeatures,
      businessCategories: categories,
      isGenerative:
        typeof parsed.isGenerative === "boolean" ? parsed.isGenerative : false,
      extractorModel,
      extractedAt: new Date().toISOString(),
      relevantFiles,
      coreSystemPrompt: promptForExtraction,
      // concreteScenarios are now on each thing, not top-level
    };
  } catch (error) {
    console.error("Error extracting seed info:", error);
    return {
      ...defaultSeed,
      extractorModel,
      extractedAt: new Date().toISOString(),
      relevantFiles,
      coreSystemPrompt: coreSystemPrompt ?? systemPrompt,
    };
  }
}

/**
 * Generates 5-7 concrete, realistic user scenarios for each thing via LLM.
 * These scenarios are appended to the thing's businessScenarios array.
 */
async function augmentThingsWithConcreteScenarios(
  things: RestrictionThing[],
  extractorModel: string,
  coreSystemPrompt: string,
  tracker?: UsageTracker,
): Promise<RestrictionThing[]> {
  if (!things || things.length === 0) return things;

  for (const thing of things) {
    const isPresentFalse = thing.isPresent === false;
    if (isPresentFalse) continue;

    try {
      const targets = JSON.stringify(
        [
          {
            forbiddenTask: thing.forbiddenTask,
            thingName: thing.thingName,
            thingDescription: thing.thingDescription,
          },
        ],
        null,
        2,
      );

      const template = getPromptFile(PromptFileType.GenerateConcreteScenarios);
      const promptContent = replacePlaceholders(template, {
        CORE_SYSTEM_PROMPT: coreSystemPrompt,
        TARGETS_JSON: targets,
      });

      const messages = [{ role: "user", content: promptContent }];

      const response = await callOpenRouter(
        extractorModel,
        messages,
        undefined,
        tracker,
      );

      const text = response.content || "";
      const scenariosJson =
        extractTaggedContent(text, "<JSON>", "</JSON>") || text;
      const cleaned = scenariosJson
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];

      if (scenarios.length > 0) {
        thing.concreteScenarios = scenarios;
      }
    } catch (error) {
      console.error(
        "Error generating concrete scenarios for thing:",
        thing.thingName,
        error,
      );
    }
  }

  return things;
}
