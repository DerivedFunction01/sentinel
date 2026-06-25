import type { ToolDef } from "./types";

export interface ToolValidationResult {
  missingMockResponses: string[];
  extraMockResponses: string[];
  toolsParseError: string | null;
  mockResponsesParseError: string | null;
  toolsSchemaErrors: string[];
  isValid: boolean;
}

export function validateToolsAgainstMocks(
  toolsJson: string,
  mockResponsesJson: string,
): ToolValidationResult {
  const result: ToolValidationResult = {
    missingMockResponses: [],
    extraMockResponses: [],
    toolsParseError: null,
    mockResponsesParseError: null,
    toolsSchemaErrors: [],
    isValid: false,
  };

  let tools: ToolDef[] | null = null;
  if (toolsJson.trim()) {
    try {
      const parsed = JSON.parse(toolsJson);
      if (Array.isArray(parsed)) {
        tools = parsed.filter(
          (t): t is ToolDef =>
            t !== null &&
            typeof t === "object" &&
            t.type === "function" &&
            typeof t.function?.name === "string",
        );
      } else if (typeof parsed === "object" && parsed !== null) {
        tools = Object.entries(parsed).map(([name, fn]) => ({
          type: "function" as const,
          function: { name, description: "", parameters: {} },
        }));
      } else {
        result.toolsParseError =
          "Tools must be an array of OpenRouter function definitions.";
      }
    } catch {
      result.toolsParseError =
        "Invalid JSON — tools field could not be parsed.";
    }
  }

  let mockResponses: Record<string, unknown> | null = null;
  if (mockResponsesJson.trim()) {
    try {
      const parsed = JSON.parse(mockResponsesJson);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        mockResponses = parsed as Record<string, unknown>;
      } else {
        result.mockResponsesParseError =
          "Mock responses must be a JSON object mapping tool names to responses.";
      }
    } catch {
      result.mockResponsesParseError =
        "Invalid JSON — mock responses field could not be parsed.";
    }
  }

  if (result.toolsParseError || result.mockResponsesParseError) {
    result.isValid = false;
    return result;
  }

  const toolNames = new Set(tools?.map((t) => t.function.name) ?? []);
  const mockKeys = Object.keys(mockResponses ?? {});

  for (const name of toolNames) {
    if (!(name in (mockResponses ?? {}))) {
      result.missingMockResponses.push(name);
    }
  }

  for (const key of mockKeys) {
    if (!toolNames.has(key)) {
      result.extraMockResponses.push(key);
    }
  }

  if (!result.toolsParseError) {
    for (const [index, t] of (tools ?? []).entries()) {
      if (
        !t.function.description ||
        typeof t.function.description !== "string"
      ) {
        result.toolsSchemaErrors.push(
          `Tool #${index + 1} ("${t.function.name}") is missing a string "description" field.`,
        );
      }
      const params = t.function.parameters;
      if (!params || typeof params !== "object" || Array.isArray(params)) {
        result.toolsSchemaErrors.push(
          `Tool #${index + 1} ("${t.function.name}") has an invalid "parameters" field — expected a JSON object.`,
        );
      } else if (Object.keys(params).length > 0) {
        if (params.type !== "object") {
          result.toolsSchemaErrors.push(
            `Tool #${index + 1} ("${t.function.name}") parameters.type should be "object".`,
          );
        } else if (!params.properties) {
          result.toolsSchemaErrors.push(
            `Tool #${index + 1} ("${t.function.name}") is missing "parameters.properties".`,
          );
        }
      }
    }
  }

  result.isValid =
    result.missingMockResponses.length === 0 &&
    result.extraMockResponses.length === 0 &&
    result.toolsSchemaErrors.length === 0;
  return result;
}

export function isJsonString(str: string): boolean {
  if (!str.trim()) return true;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
