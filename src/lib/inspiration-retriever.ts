import { db } from "@/lib/db";
import { callOpenRouter } from "@/app/api/scan/launch/route";
import type { HardeningTrace } from "./types";

export interface InspirationExample {
  name: string;
  description: string;
  tags: string[];
  granularity: string;
  toolJson: any;
  mockResponse: any;
}

export async function retrieveInspirationExamples(
  forbiddenTask: string,
  extractorModel: string,
  granularity: "compact" | "detailed",
  tracker?: any,
  trace?: HardeningTrace,
): Promise<InspirationExample[]> {
  try {
    const prompt = `You are a search query generator. Your task is to analyze the following security constraint/forbidden task of an AI assistant and generate search tags and a keyword query to find relevant tool schema templates in our database.
    
Forbidden Task: "${forbiddenTask}"
Target Granularity: ${granularity}

Output ONLY a JSON object containing the keys "query" (a string of 1-3 keywords, e.g. "discount" or "refund") and "tags" (an array of lowercase tags, e.g. ["finance", "policy", "authentication", "pii", "moderation"]). Do not output any preamble, markdown blocks, or explanation.`;

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
      tags = Array.isArray(parsed.tags) ? parsed.tags.map((t: string) => t.toLowerCase()) : [];
    } catch (e) {
      console.warn("Failed to parse search parameters from LLM response:", e);
      // Fallback search using split words from the forbidden task
      query = forbiddenTask.split(/\s+/)[0]?.toLowerCase() || "";
    }

    const examples = await db.toolSchemaExample.findMany({
      where: { granularity },
    });

    const filtered = examples.filter((ex) => {
      let match = true;
      if (tags.length > 0) {
        try {
          const parsedTags = (JSON.parse(ex.tags) as string[]).map((t) => t.toLowerCase());
          match = tags.some((t) => 
            parsedTags.some((pt) => pt.includes(t) || t.includes(pt))
          );
        } catch {
          match = false;
        }
      }
      if (match && query) {
        const nameMatch = ex.name.toLowerCase().includes(query);
        const descMatch = ex.description.toLowerCase().includes(query);
        const jsonMatch = ex.toolJson.toLowerCase().includes(query);
        let tagMatch = false;
        try {
          tagMatch = JSON.parse(ex.tags).some((t: string) => t.toLowerCase().includes(query));
        } catch {}
        match = nameMatch || descMatch || jsonMatch || tagMatch;
      }
      return match;
    });

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

export function formatInspirationExamplesBlock(examples: InspirationExample[]): string {
  if (examples.length === 0) return "";
  let block = "\nINSPIRATION EXAMPLES FROM DATABASE (use these as templates or patterns for your schema design):\n";
  examples.forEach((ex, idx) => {
    block += `\nExample ${idx + 1}: ${ex.name} (${ex.description})\n`;
    block += `Schema:\n${JSON.stringify(ex.toolJson, null, 2)}\n`;
    block += `Mock Response:\n${JSON.stringify(ex.mockResponse, null, 2)}\n`;
  });
  return block;
}
