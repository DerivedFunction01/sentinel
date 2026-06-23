import { db } from "@/lib/db";
import { callOpenRouter } from "@/lib/scan-pipeline";
import type { BusinessCategory, Granularity, HardeningTrace } from "./types";

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
  businessCategories?: BusinessCategory[],
): Promise<InspirationExample[]> {
  try {
    const businessCategoryContext =
      businessCategories && businessCategories.length > 0
        ? `\nTarget Business Categories: ${businessCategories.join(", ")}\nFocus on examples that match these business domains.`
        : "";
    const prompt = `You are a search query generator. Your task is to analyze the following security constraint/forbidden task of an AI assistant and generate search tags and a keyword query to find relevant tool schema templates in our database.
    
Forbidden Task: "${forbiddenTask}"
Target Granularity: ${granularity}
${businessCategoryContext}

Output ONLY a JSON object containing the keys "query" 
(a string of 1-3 keywords, e.g. "discount" or "refund"), 
"tags" (an array of lowercase tags, e.g. ["finance", "policy", "authentication", "pii", "moderation"]), 
and optionally "predictedCategories" (an array of business categories most relevant to this forbidden task, e.g. ["BANKING_FINANCE", "LAW_FIRM"]). 
Do not output any preamble, markdown blocks, or explanation.`;
    const response = await callOpenRouter(
      extractorModel,
      [{ role: "user", content: prompt }],
      undefined,
      tracker,
    );

    let query = "";
    let tags: string[] = [];
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
        return {
          ex,
          matchingWordsCount,
          granularityBonus,
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
        // Then sort by granularity match bonus (descending)
        return b.granularityBonus - a.granularityBonus;
      });

    const filtered = scoredExamples.map((item) => item.ex);

    // Return the top 2 examples
    const result: InspirationExample[] = [];
    for (const ex of filtered.slice(0, 2)) {
      try {
        result.push({
          name: ex.name,
          description: ex.description,
          tags: JSON.parse(ex.tags),
          granularity: ex.granularity,
          toolJson: JSON.parse(ex.toolJson),
          mockResponse: JSON.parse(ex.mockResponse),
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
