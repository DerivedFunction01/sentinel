import { db } from "@/lib/db";
import { callOpenRouter } from "@/lib/scan-pipeline";
import fs from "fs";
import path from "path";
import {
  ToolDef,
  ToolRecommendationItem,
  HardeningTrace,
  Granularity,
  BusinessCategory,
} from "./types";
import {
  retrieveInspirationExamples,
  formatInspirationExamplesBlock,
} from "./inspiration-retriever";

export function parseMarkdownSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const normalized = content.replace(/\r\n/g, "\n");

  // Split by headings starting with "## "
  const parts = normalized.split(/\n## /g);

  let firstPart = parts[0] || "";
  if (firstPart.startsWith("## ")) {
    firstPart = firstPart.substring(3);
  }
  sections["intro"] = firstPart;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const firstNewline = part.indexOf("\n");
    if (firstNewline === -1) {
      const heading = part.trim();
      sections[heading.toLowerCase()] = "";
      continue;
    }
    const heading = part.substring(0, firstNewline).trim();
    const body = part.substring(firstNewline + 1).trim();

    const normalizedKey = heading
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim();
    sections[normalizedKey] = body;
    sections[heading.toLowerCase()] = body;
  }

  return sections;
}

// ── Page-based pattern loader ─────────────────────────────────────────────────

const PAGES_DIR = path.join(
  process.cwd(),
  "uploads",
  "tool_generation_pattern",
  "pages",
);

export interface PatternPage {
  slug: string;
  title: string;
  description: string;
  body: string;
}

/**
 * Parse YAML-style frontmatter from a markdown file.
 * Returns { title, description, body }.
 *
 * This is intentionally a standalone function so it can be swapped out
 * for a library (e.g. gray-matter) without touching call sites.
 */
export function parseFrontmatter(content: string): {
  title: string;
  description: string;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m);
  if (!match) return { title: "", description: "", body: content.trim() };

  const meta = match[1];
  const body = match[2].trim();

  const get = (key: string): string => {
    const line = meta.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return line ? line[1].trim() : "";
  };

  return { title: get("title"), description: get("description"), body };
}

/**
 * Read _index.md for the canonical page order, then load each page file.
 * Returns an ordered array of PatternPage objects.
 *
 * Also builds normalizedTitle → body and slug → body maps for O(1) lookup.
 */
export function loadPatternPages(): {
  pages: PatternPage[];
  byTitle: Record<string, PatternPage>;
  bySlug: Record<string, PatternPage>;
} {
  const indexPath = path.join(PAGES_DIR, "_index.md");
  const rawIndex = fs.readFileSync(indexPath, "utf-8");
  const slugs = [...rawIndex.matchAll(/^- (.+)$/gm)].map((m) => m[1].trim());

  const pages: PatternPage[] = [];
  const byTitle: Record<string, PatternPage> = {};
  const bySlug: Record<string, PatternPage> = {};

  for (const slug of slugs) {
    const filePath = path.join(PAGES_DIR, `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      console.warn(`loadPatternPages: page not found: ${slug}.md`);
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const { title, description, body } = parseFrontmatter(raw);
    const page: PatternPage = { slug, title, description, body };

    pages.push(page);
    bySlug[slug] = page;
    // Index by normalized title for flexible lookup
    const normTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim();
    byTitle[normTitle] = page;
    byTitle[title.toLowerCase()] = page;
  }

  return { pages, byTitle, bySlug };
}

function loadPromptFile(filename: string): string {
  try {
    const filePath = path.join(
      process.cwd(),
      "uploads",
      "hardening_prompts",
      filename,
    );
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err);
    return "";
  }
}

export function getToolExtractionInstructions(
  hardenedPrompt: string,
  forbiddenTask: string,
  granularity: Granularity,
  requestedSections?: string[],
  existingTools?: ToolDef[],
  inspirationExamplesBlock?: string,
  breachedTrials?: any[],
  mockToolResponses?: Record<string, any>,
): string {
  let existingToolsBlock = "";
  if (existingTools && existingTools.length > 0) {
    existingToolsBlock = `\nCURRENT CONFIGURED TOOLS (to avoid redundancy, do NOT recreate these or suggest overlapping functionality):
<current_tools>
${JSON.stringify(
  existingTools.map((t) => {
    const fn = t.function || {};
    const tName = fn.name || "";
    const mockVal = mockToolResponses?.[tName] || {};
    return {
      name: tName,
      description: fn.description || "",
      parameters: fn.parameters || {},
      current_mock_response: mockVal,
    };
  }),
  null,
  2,
)}
</current_tools>\n`;
  }

  let breachedTrialsBlock = "";
  if (breachedTrials && breachedTrials.length > 0) {
    breachedTrialsBlock = `\nAdversarial attack prompts that SUCCESSFULLY bypassed the system prompt, including the model's response and the judge's verdict detailing why it leaked:
<breached_attack_trials>
${breachedTrials
  .map(
    (t, i) => `${i + 1}. ATTACK PROMPT: "${t.attack}"
   ASSISTANT RESPONSE: "${t.response}"
   JUDGE'S VERDICT REASONING: ${t.judgeVerdict || "None provided"}`,
  )
  .join("\n\n")}
</breached_attack_trials>\n`;
  }

  const granularityPrompt = `Target Granularity: ${granularity}.
Refer to the ${granularity} schema patterns and guidelines outlined in the Tooling Practices and Tool Generation Patterns above.`;

  // Dynamically load the patterns pages to prevent duplication of logic
  let patternsContent = "";
  try {
    const { byTitle } = loadPatternPages();

    // Do not pre-load sections by default to force the agent to query them agentically
    const sectionsToInclude = requestedSections || [];

    const builder: string[] = [];
    for (const sec of sectionsToInclude) {
      const normalizedSec = sec
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim();
      const page = byTitle[normalizedSec] || byTitle[sec.toLowerCase()];
      if (page) {
        builder.push(`## ${page.title}\n${page.body}`);
      }
    }
    patternsContent = builder.join("\n\n");
  } catch (e) {
    console.error(
      "Could not load tool generation pattern pages at runtime:",
      e,
    );
  }

  const template = loadPromptFile("tool_extractor_instructions.md");

  const formattedPatterns = patternsContent
    ? `Below are the pre-loaded Tool Generation Patterns sections:
<tool_generation_patterns>
${patternsContent}
</tool_generation_patterns>\n`
    : "";

  return template
    .replace(/\{\{GRANULARITY\}\}/g, granularity)
    .replace("{{HARDENED_PROMPT}}", hardenedPrompt)
    .replace("{{FORBIDDEN_TASK}}", forbiddenTask)
    .replace("{{INSPIRATION_EXAMPLES}}", inspirationExamplesBlock || "")
    .replace("{{BREACHED_ATTACK_TRIALS}}", breachedTrialsBlock)
    .replace("{{PATTERNS_CONTENT}}", formattedPatterns)
    .replace("{{GRANULARITY_PROMPT}}", granularityPrompt)
    .replace("{{EXISTING_TOOLS_BLOCK}}", existingToolsBlock);
}

export function parseSectionedRecommendation(
  text: string,
): ToolRecommendationItem[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.tools && Array.isArray(parsed.tools)) {
        return parsed.tools.map((t: any) => {
          if (t.toolJson) return t;
          return {
            name: t.name || t.function?.name || "unknown_tool",
            granularity: parsed.granularity || Granularity.Compact,
            compatibilityScore: parsed.compatibilityScore || 80,
            rationale: parsed.rationale || "Extracted from system prompt.",
            toolJson: t,
            mockResponse:
              parsed.mockToolResponses?.[t.name || t.function?.name] || {},
          };
        });
      }
    } catch {}
  }

  const tools: ToolRecommendationItem[] = [];
  const blocks = text.split(/(?:^|\n)(?:#+\s*)?\[TOOL:\s*/gi);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const endHeaderIdx = block.indexOf("]");
    if (endHeaderIdx === -1) continue;
    const name = block.substring(0, endHeaderIdx).trim();
    const body = block.substring(endHeaderIdx + 1);

    let granularity: Granularity = Granularity.Compact;
    const granMatch = body.match(/GRANULARITY:\s*(compact|detailed)/i);
    if (granMatch) {
      granularity = granMatch[1].toLowerCase() as Granularity;
    }

    let replaces: string | undefined = undefined;
    const replacesMatch = body.match(/REPLACES:\s*([a-zA-Z0-9_-]+|none)/i);
    if (replacesMatch) {
      const val = replacesMatch[1].trim();
      if (val.toLowerCase() !== "none") {
        replaces = val;
      }
    }

    let compatibilityScore = 100;
    const scoreMatch = body.match(/SCORE:\s*(\d+)/i);
    if (scoreMatch) {
      compatibilityScore = parseInt(scoreMatch[1], 10);
    }

    let rationale = "";
    const rationaleStart = body.indexOf("RATIONALE:");
    const schemaStart = body.indexOf("SCHEMA:");
    if (
      rationaleStart !== -1 &&
      schemaStart !== -1 &&
      schemaStart > rationaleStart
    ) {
      rationale = body
        .substring(rationaleStart + "RATIONALE:".length, schemaStart)
        .trim();
    }

    let toolJson: ToolDef | null = null;
    let schemaJsonText = "";
    const mockStart = body.indexOf("MOCK:");
    if (schemaStart !== -1 && mockStart !== -1 && mockStart > schemaStart) {
      schemaJsonText = body
        .substring(schemaStart + "SCHEMA:".length, mockStart)
        .trim();
    } else if (schemaStart !== -1 && mockStart === -1) {
      schemaJsonText = body.substring(schemaStart + "SCHEMA:".length).trim();
    }

    if (schemaJsonText) {
      try {
        const cleanedJson = schemaJsonText
          .replace(/^```[a-zA-Z]*\n/g, "")
          .replace(/\n```$/g, "")
          .trim();
        toolJson = JSON.parse(cleanedJson) as ToolDef;
      } catch (e) {
        console.error("Failed to parse toolJson schema:", e);
      }
    }

    let mockResponse: unknown = {};
    if (mockStart !== -1) {
      const mockJsonText = body.substring(mockStart + "MOCK:".length).trim();
      try {
        const cleanedJson = mockJsonText
          .replace(/^```[a-zA-Z]*\n/g, "")
          .replace(/\n```$/g, "")
          .trim();
        mockResponse = JSON.parse(cleanedJson);
      } catch (e) {
        console.error("Failed to parse mockResponse:", e);
      }
    }

    if (name && toolJson) {
      // Extract business categories if present in the output
      let businessCategories: BusinessCategory[] | undefined = undefined;
      const bizCatMatch = body.match(/BUSINESS_CATEGORIES:\s*\[([^\]]+)\]/i);
      if (bizCatMatch) {
        try {
          const cats = bizCatMatch[1]
            .split(",")
            .map((c) => c.trim().replace(/"/g, ""))
            .filter((c) => c.length > 0);
          if (cats.length > 0) {
            businessCategories = cats as BusinessCategory[];
          }
        } catch {}
      }

      tools.push({
        name,
        granularity,
        compatibilityScore,
        rationale,
        toolJson,
        mockResponse,
        replaces,
        businessCategories,
      });
    }
  }

  return tools;
}

export async function generateToolRecommendation(
  hardenedPrompt: string,
  forbiddenTask: string,
  granularity: Granularity,
  extractorModel: string,
  tracker?: any,
  requestedSections?: string[],
  existingTools?: ToolDef[],
  trace?: HardeningTrace,
  trials?: any[],
  mockToolResponses?: Record<string, any>,
  businessCategories?: BusinessCategory[],
  personaDescription?: string,
  businessFeatures?: string[],
  businessScenarios?: string[],
): Promise<{
  toolRecommendation: string | null;
  compatibilityScore: number | null;
}> {
  try {
    // Step 0: Retrieve inspiration examples from DB with full business context
    const inspirationExamples = await retrieveInspirationExamples(
      forbiddenTask,
      extractorModel,
      granularity,
      tracker,
      trace,
      businessCategories,
      personaDescription,
      businessFeatures,
      businessScenarios,
    );
    const inspirationExamplesBlock =
      formatInspirationExamplesBlock(inspirationExamples);

    const breachedTrials = trials
      ? trials.filter(
          (t) =>
            t.verdict === "breached" ||
            t.verdict === "Breached" ||
            t.judgeLabel === "LEAKED",
        )
      : [];

    const extractionInstructions = getToolExtractionInstructions(
      hardenedPrompt,
      forbiddenTask,
      granularity,
      requestedSections,
      existingTools,
      inspirationExamplesBlock,
      breachedTrials,
      mockToolResponses,
    );

    const messages: any[] = [{ role: "user", content: extractionInstructions }];

    const tools: ToolDef[] = [
      {
        type: "function",
        function: {
          name: "get_available_markdown_sections",
          description:
            "Get list of available section headers in the Tool Generation Patterns guide.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "read_markdown_sections",
          description:
            "Read specific sections of the Tool Generation Patterns guide.",
          parameters: {
            type: "object",
            properties: {
              sections: {
                type: "array",
                items: { type: "string" },
                description: "Array of section names to retrieve",
              },
            },
            required: ["sections"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "search_schema_examples",
          description:
            "Search reference tool schema examples in the database by query terms or tags.",
          parameters: {
            type: "object",
            properties: {
              granularity: {
                type: "string",
                enum: [Granularity.Compact, "detailed"],
              },
              query: {
                type: "string",
                description:
                  "Search term to match against name, description, tags or JSON",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags to filter examples",
              },
            },
            required: ["granularity"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_available_example_tags",
          description:
            "Retrieve all unique tags associated with the tool schema examples in the database.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
    ];

    let extractContent = "";
    let loopCount = 0;
    const maxLoops = 6;

    while (loopCount < maxLoops) {
      loopCount++;
      const extractResponse = await callOpenRouter(
        extractorModel,
        messages,
        tools,
        tracker,
      );

      // If the response indicates the assistant wants to call tools
      if (extractResponse.tool_calls && extractResponse.tool_calls.length > 0) {
        // Push the assistant message so the assistant context is preserved
        messages.push(extractResponse);

        for (const toolCall of extractResponse.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments || "{}");
          let result = "";

          if (name === "get_available_markdown_sections") {
            try {
              const { pages } = loadPatternPages();
              result = JSON.stringify(pages.map((p) => p.title));
            } catch (err: any) {
              result = JSON.stringify({ error: err.message });
            }
          } else if (name === "read_markdown_sections") {
            try {
              const { byTitle } = loadPatternPages();
              const requested: string[] = args.sections || [];
              const output: Record<string, string> = {};
              for (const r of requested) {
                const norm = r
                  .toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, "")
                  .trim();
                const page = byTitle[norm] || byTitle[r.toLowerCase()];
                output[r] = page ? page.body : "Section not found.";
              }
              result = JSON.stringify(output);
            } catch (err: any) {
              result = JSON.stringify({ error: err.message });
            }
          } else if (name === "search_schema_examples") {
            try {
              const examples = await db.toolSchemaExample.findMany({
                where: { granularity: args.granularity },
              });
              const query = args.query ? args.query.toLowerCase() : "";
              const tags: string[] = args.tags
                ? args.tags.map((t: string) => t.toLowerCase())
                : [];

              const filtered = examples.filter((ex) => {
                let match = true;
                if (tags.length > 0) {
                  try {
                    const parsedTags = (JSON.parse(ex.tags) as string[]).map(
                      (t) => t.toLowerCase(),
                    );
                    match = tags.every((t) => parsedTags.includes(t));
                  } catch {
                    match = false;
                  }
                }
                if (match && query) {
                  const nameMatch = ex.name.toLowerCase().includes(query);
                  const descMatch = ex.description
                    .toLowerCase()
                    .includes(query);
                  const jsonMatch = ex.toolJson.toLowerCase().includes(query);
                  let tagMatch = false;
                  try {
                    tagMatch = JSON.parse(ex.tags).some((t: string) =>
                      t.toLowerCase().includes(query),
                    );
                  } catch {}
                  match = nameMatch || descMatch || jsonMatch || tagMatch;
                }
                return match;
              });
              result = JSON.stringify(filtered.slice(0, 3));
            } catch (err: any) {
              result = JSON.stringify({ error: err.message });
            }
          } else if (name === "get_available_example_tags") {
            try {
              const examples = await db.toolSchemaExample.findMany({
                select: { tags: true },
              });
              const allTags = new Set<string>();
              for (const ex of examples) {
                try {
                  const parsed = JSON.parse(ex.tags) as string[];
                  parsed.forEach((t) => allTags.add(t));
                } catch {}
              }
              result = JSON.stringify(Array.from(allTags));
            } catch (err: any) {
              result = JSON.stringify({ error: err.message });
            }
          } else {
            result = JSON.stringify({ error: `Unknown tool ${name}` });
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: result,
          });
        }
      } else {
        extractContent = (extractResponse.content || "").trim();
        break;
      }
    }

    if (!extractContent) {
      throw new Error(
        "No recommendation content generated by the extractor model.",
      );
    }

    if (trace) {
      trace.toolExtraction = {
        promptSent: extractionInstructions,
        rawOutput: extractContent,
      };
    }

    const cleanExtract = extractContent
      .replace(/^```[a-zA-Z]*\n/g, "")
      .replace(/\n```$/g, "")
      .trim();

    const parsedRecommendation = parseSectionedRecommendation(cleanExtract);
    let compatibilityScore = 0;
    if (parsedRecommendation.length > 0) {
      const sum = parsedRecommendation.reduce(
        (acc, t) => acc + t.compatibilityScore,
        0,
      );
      compatibilityScore = Math.round(sum / parsedRecommendation.length);
    }

    const payload: any = {
      tools: parsedRecommendation,
      compatibilityScore,
      extractorModel,
      extractorModelName: "",
    };

    // Fill model meta info
    const dbModels = await db.model.findMany({
      select: { id: true, name: true },
    });
    const dbExtractorModel = dbModels.find((m) => m.id === extractorModel);
    payload.extractorModelName =
      dbExtractorModel?.name ||
      extractorModel.split("/").pop() ||
      extractorModel;

    return {
      toolRecommendation: JSON.stringify(payload),
      compatibilityScore,
    };
  } catch (err) {
    console.error(
      "Error during generateToolRecommendation pipeline execution:",
      err,
    );
    return { toolRecommendation: null, compatibilityScore: null };
  }
}
