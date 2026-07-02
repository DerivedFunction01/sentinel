import fs from "fs";
import path from "path";

export enum PromptFileType {
  Judge = "new_judge.md",
  AttackGenerator = "attack_gen_pre.md",
  SeedExtractor = "seed_extractor.md",
}

const promptCache: Record<PromptFileType, string | null> = {
  [PromptFileType.Judge]: null,
  [PromptFileType.AttackGenerator]: null,
  [PromptFileType.SeedExtractor]: null,
};

export function getPromptFile(type: PromptFileType): string {
  if (promptCache[type] === null) {
    try {
      const filePath = path.join(
        process.cwd(),
        "uploads",
        "scan_prompts",
        type,
      );
      promptCache[type] = fs.readFileSync(filePath, "utf-8").trim();
    } catch (err) {
      console.error(`Failed to load prompt file ${type}:`, err);
      promptCache[type] = "";
    }
  }
  return promptCache[type]!;
}

const promptFileCache = new Map<string, string>();

export function loadPromptFile(filename: string): string {
  if (promptFileCache.has(filename)) {
    return promptFileCache.get(filename)!;
  }
  try {
    const filePath = path.join(
      process.cwd(),
      "uploads",
      "hardening_prompts",
      filename,
    );
    const content = fs.readFileSync(filePath, "utf-8").trim();
    promptFileCache.set(filename, content);
    return content;
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err);
    return "";
  }
}
