/**
 * Find a default model from a list of models that is not a thinking/pro model
 * but is a fast/cheap one (flash, lite, mini, haiku, llama-3-8b, etc.).
 */
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

  return match ? match.id : "google/gemini-2.5-flash"; // fallback if none found
}
