import { ToolDef } from "./types";
/**
 * Find a default model from a list of models that is not a thinking/pro model
 * but is a fast/cheap one (flash, lite, mini, haiku, llama-3-8b, etc.).
 */

export const DEFAULT_MODEL = "~google/gemini-flash-latest";

export function findDefaultModel(
  models: Array<{ id: string; name: string }>,
): string {
  const match = models.find((m) => {
    const id = m.id.toLowerCase();
    const name = m.name.toLowerCase();

    // Must NOT match forbidden keywords (thinking/pro/reasoning/etc.)
    const forbiddenRegex = /thinking|pro|[-_]r1|reasoning|preview/i;
    const hasForbidden = forbiddenRegex.test(id) || forbiddenRegex.test(name);

    // Check if name/id contains a small parameter count (e.g. <= 14B like 8b, 7b, 3b, 1b, etc.)
    const paramMatch =
      id.match(/(?:^|[^a-z0-9])(\d+)[bB](?:$|[^a-z0-9])/) ||
      name.match(/(?:^|[^a-z0-9])(\d+)[bB](?:$|[^a-z0-9])/);
    const isSmallParamModel = paramMatch
      ? parseInt(paramMatch[1], 10) <= 14
      : false;

    // MUST match allowed keywords (flash/lite/mini/haiku) or be a small parameter model
    const allowedRegex = /flash|lite|mini|haiku/i;
    const hasAllowed =
      allowedRegex.test(id) || allowedRegex.test(name) || isSmallParamModel;

    return !hasForbidden && hasAllowed;
  });

  return match ? match.id : DEFAULT_MODEL; // fallback if none found
}

export function extractTaggedContent(
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

export interface UsageTracker {
  totalCost: number;
  dbModels: any[];
}

function getModelPrice(model: string, dbModels: any[]) {
  const dbModel = dbModels.find((m) => m.id === model);
  if (dbModel) {
    const prompt = parseFloat(dbModel.promptPrice || "0");
    const completion = parseFloat(dbModel.completionPrice || "0");
    if (prompt > 0 || completion > 0) {
      return { prompt, completion };
    }
  }
  return { prompt: 0.1 / 1000000, completion: 0.4 / 1000000 };
}

interface OpenRouterMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * Helper to call OpenRouter API completions.
 */
export async function callOpenRouter(
  model: string,
  messages: Array<{
    role: string;
    content: string | null;
    name?: string;
    tool_call_id?: string;
  }>,
  tools?: ToolDef[],
  tracker?: UsageTracker,
  reasoning?: Record<string, any>,
): Promise<OpenRouterMessage> {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        signal: controller.signal,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "DerivedFunction",
        },
        body: JSON.stringify({
          model,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined,
          reasoning: reasoning
            ? JSON.stringify(reasoning)
            : {
                exclude: true,
                effort: "low",
              },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice || !choice.message) {
      console.warn("OpenRouter API returned no message", { data });
      return { role: "assistant", content: "" };
    }

    // Accumulate token costs if usage statistics and pricing mappings exist
    if (tracker && data.usage) {
      const promptTokens = data.usage.prompt_tokens || 0;
      const completionTokens = data.usage.completion_tokens || 0;
      const pricing = getModelPrice(model, tracker.dbModels);
      const cost =
        promptTokens * pricing.prompt + completionTokens * pricing.completion;
      tracker.totalCost += cost;
    }

    return choice.message;
  } finally {
    clearTimeout(timeout);
  }
}

export const DEFAULT_MOCK_RESPONSE = {
  status: "unavailable",
  message: "Currently in maintenance",
  policy: {
    allow_discussion: false,
    describe_processing: false,
    exceptions: false,
    negotiation: false,
    allow_hypothetical: false,
    allow_extrapolation: false,
    allow_followup: false,
    require_explicit_human_approval: true,
    escalate_to_support: true,
    give_advice: {
      legal: false,
      medical: false,
      financial: false,
      safety: false,
      dietary: false,
      technical: false,
      programming: false,
      process:
        "Direct users to appropriate professionals or official channels for such matters.",
    },
  },
  support_contact: {
    website: "https://abc-corp.com/status",
    phone: "1-800-ABC-CORP",
  },
  next_steps:
    "Direct users to appropriate professionals or official channels for any requests.",
};
