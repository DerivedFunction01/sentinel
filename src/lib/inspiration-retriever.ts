import { db } from "@/lib/db";
import { callOpenRouter } from "@/lib/scan-pipeline";
import {
  Granularity,
  HardeningTrace,
  BusinessCategory,
  BreachedAttack,
  ScanMetadata,
} from "./types";

export interface InspirationExample {
  name: string;
  description: string;
  tags: string[];
  granularity: string;
  toolJson: any;
  mockResponse: any;
  businessCategories?: BusinessCategory[];
}

export async function retrieveInspirationExamples(
  forbiddenTask: string,
  extractorModel: string,
  granularity: Granularity,
  tracker?: any,
  trace?: HardeningTrace,
  metadata?: ScanMetadata,
): Promise<InspirationExample[]> {
  try {
    const businessCategories = metadata?.seedExtraction?.businessCategories;
    const personaDescription = metadata?.seedExtraction?.personaDescription;
    const businessFeatures = metadata?.seedExtraction?.businessFeatures;
    const businessScenarios = metadata?.seedExtraction?.businessScenarios;

    // Build rich business context for the prompt
    const businessCategoryContext =
      businessCategories && businessCategories.length > 0
        ? `\nTarget Business Categories: ${businessCategories.join(", ")}\nFocus on examples that match these business domains.`
        : `\nPredict it from these Enums: ${Object.values(BusinessCategory)}`;

    const personaContext = personaDescription
      ? `\nAssistant Persona: ${personaDescription}\nTailor search toward examples relevant to this role.`
      : "";

    const featuresContext =
      businessFeatures && businessFeatures.length > 0
        ? `\nBusiness Features: ${businessFeatures.slice(0, 3).join(", ")}\nConsider these capabilities when searching.`
        : "";

    const scenariosContext =
      businessScenarios && businessScenarios.length > 0
        ? `\nBusiness Scenarios: ${businessScenarios.slice(0, 2).join(", ")}\nPrioritize examples that handle similar real-world use cases.`
        : "";

    const prompt = `You are a search query generator. Your task is to analyze the following security constraint/forbidden task of an AI assistant and generate search tags and a keyword query to find relevant tool schema templates in our database.
    
Forbidden Task: "${forbiddenTask}"
Target Granularity: ${granularity}${businessCategoryContext}${personaContext}${featuresContext}${scenariosContext}

Output ONLY a JSON object containing the keys "query" (a string of 1-3 keywords, e.g. "discount" or "refund"), "tags" (an array of lowercase tags, e.g. ["finance", "policy", "authentication", "pii", "moderation"]), and optionally "predictedCategories" (an array of business categories most relevant to this forbidden task, e.g. ["BANKING_FINANCE", "LAW_FIRM"]). Do not output any preamble, markdown blocks, or explanation.`;

    const response = await callOpenRouter(
      extractorModel,
      [{ role: "user", content: prompt }],
      undefined,
      tracker,
    );

    let query = "";
    let tags: string[] = [];
    let predictedCategories: BusinessCategory[] = [];
    try {
      const cleaned = (response.content || "")
        .replace(/^```[a-zA-Z]*\n/g, "")
        .replace(/\n```$/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      query = parsed.query ? parsed.query.toLowerCase() : "";
      tags = Array.isArray(parsed.tags)
        ? parsed.tags.map((t: string) => t.toLowerCase())
        : [];
      // Extract predicted business categories if provided by LLM
      if (Array.isArray(parsed.predictedCategories)) {
        predictedCategories = parsed.predictedCategories.filter(
          (c: string) => typeof c === "string" && c.length > 0,
        ) as BusinessCategory[];
      }
    } catch (e) {
      console.warn("Failed to parse search parameters from LLM response:", e);
      // Fallback search using split words from the forbidden task
      query = forbiddenTask.split(/\s+/)[0]?.toLowerCase() || "";
    }

    const allExamples = await db.toolSchemaExample.findMany();

    const searchWords: string[] = [];
    if (query) {
      searchWords.push(
        ...query
          .toLowerCase()
          .split(/[\s_]+/)
          .filter(Boolean),
      );
    }
    tags.forEach((t) => {
      searchWords.push(
        ...t
          .toLowerCase()
          .split(/[\s_]+/)
          .filter(Boolean),
      );
    });

    const scoredExamples = allExamples
      .map((ex) => {
        let matchingWordsCount = 0;
        if (searchWords.length > 0) {
          const nameLower = ex.name.toLowerCase();
          const descLower = ex.description.toLowerCase();
          const jsonLower = ex.toolJson.toLowerCase();
          let tagsLower = "";
          try {
            tagsLower = JSON.stringify(JSON.parse(ex.tags)).toLowerCase();
          } catch {}

          searchWords.forEach((word) => {
            if (
              nameLower.includes(word) ||
              descLower.includes(word) ||
              tagsLower.includes(word) ||
              jsonLower.includes(word)
            ) {
              matchingWordsCount++;
            }
          });
        }

        const granularityBonus = ex.granularity === granularity ? 1 : 0;

        // Calculate business category match bonus
        let categoryBonus = 0;
        if (businessCategories && businessCategories.length > 0) {
          try {
            const exampleCategories = JSON.parse(
              ex.businessCategories || "[]",
            ) as BusinessCategory[];
            if (
              Array.isArray(exampleCategories) &&
              exampleCategories.length > 0
            ) {
              // Count how many target categories match the example's categories
              const matchingCategories = businessCategories.filter((cat) =>
                exampleCategories.includes(cat),
              );
              // Bonus proportional to match ratio (0 to 2 points)
              categoryBonus =
                (matchingCategories.length / businessCategories.length) * 2;
            }
          } catch {}
        }

        return {
          ex,
          matchingWordsCount,
          granularityBonus,
          categoryBonus,
        };
      })
      .filter((item) => {
        // If there are search words, only keep examples that match at least one search word
        if (searchWords.length > 0) {
          return item.matchingWordsCount > 0;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by match count first (descending)
        if (b.matchingWordsCount !== a.matchingWordsCount) {
          return b.matchingWordsCount - a.matchingWordsCount;
        }
        // Then sort by category bonus (descending)
        if (b.categoryBonus !== a.categoryBonus) {
          return b.categoryBonus - a.categoryBonus;
        }
        // Then sort by granularity match bonus (descending)
        return b.granularityBonus - a.granularityBonus;
      });

    const filtered = scoredExamples.map((item) => item.ex);

    // Return the top N examples
    const numberOfExamples = 4;
    const result: InspirationExample[] = [];
    for (const ex of filtered.slice(0, numberOfExamples)) {
      try {
        result.push({
          name: ex.name,
          description: ex.description,
          tags: JSON.parse(ex.tags),
          granularity: ex.granularity,
          toolJson: JSON.parse(ex.toolJson),
          mockResponse: JSON.parse(ex.mockResponse),
          businessCategories: JSON.parse(ex.businessCategories || "[]"),
        });
      } catch {}
    }

    if (trace) {
      trace.step0 = {
        query,
        tags,
        retrievedExamples: result,
      };
    }

    return result;
  } catch (err) {
    console.error("Error retrieving inspiration examples:", err);
    return [];
  }
}

export function formatInspirationExamplesBlock(
  examples: InspirationExample[],
): string {
  if (examples.length === 0) return "";
  let block =
    "\nINSPIRATION EXAMPLES FROM DATABASE (use these as templates or patterns for your schema design):\n";
  examples.forEach((ex, idx) => {
    block += `\nExample ${idx + 1}: ${ex.name} (${ex.description})\n`;
    block += `Schema:\n${JSON.stringify(ex.toolJson, null, 2)}\n`;
    block += `Mock Response:\n${JSON.stringify(ex.mockResponse, null, 2)}\n`;
  });
  return block;
}
