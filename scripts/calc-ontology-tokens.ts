import fs from "fs";
import path from "path";

// Use the same token estimation logic as the app
function estimateTokens(text: string): number {
  if (!text) return 0;
  try {
    // Simple approximation: ~1 token per 4 characters
    return Math.ceil(text.length / 4);
  } catch {
    return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
  }
}

const ONTOLOGY_DIR = path.join(process.cwd(), "uploads", "ontology");

if (!fs.existsSync(ONTOLOGY_DIR)) {
  console.error("Ontology directory not found:", ONTOLOGY_DIR);
  process.exit(1);
}

const ontologyFiles = fs
  .readdirSync(ONTOLOGY_DIR)
  .filter((f) => f.endsWith(".md"));

const ontologySizes: Record<string, number> = {};

for (const file of ontologyFiles) {
  try {
    const content = fs.readFileSync(path.join(ONTOLOGY_DIR, file), "utf-8");
    // Extract body after frontmatter (after closing ---)
    const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/m);
    const body = match ? match[1].trim() : content.trim();
    const tokens = estimateTokens(body);
    ontologySizes[file] = tokens;
    console.log(`${file}: ${tokens} tokens`);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    ontologySizes[file] = 0;
  }
}

const mainAgentTokens = ontologySizes["main_agent.md"] || 0;
const generalBusinessTokens = ontologySizes["general_business.md"] || 0;

const domainFiles = Object.keys(ontologySizes).filter(
  (f) => f !== "main_agent.md" && f !== "general_business.md" && ontologySizes[f] > 0,
);

const avgDomainTokens =
  domainFiles.length > 0
    ? Math.round(
        domainFiles.reduce((sum, f) => sum + ontologySizes[f], 0) / domainFiles.length,
      )
    : 0;

// Print current hardcoded values for comparison
console.log("\n=== CURRENT HARDCODED VALUES ===");
console.log("ONTOLOGY_DEFAULT_MAIN_AGENT_TOKENS: 500");
console.log("ONTOLOGY_DEFAULT_GENERAL_BUSINESS_TOKENS: 2000");
console.log("ONTOLOGY_DEFAULT_AVG_DOMAIN_TOKENS: 1000");

// Print calculated true values
console.log("\n=== CALCULATED TRUE VALUES ===");
console.log(`ONTOLOGY_DEFAULT_MAIN_AGENT_TOKENS: ${mainAgentTokens}`);
console.log(`ONTOLOGY_DEFAULT_GENERAL_BUSINESS_TOKENS: ${generalBusinessTokens}`);
console.log(`ONTOLOGY_DEFAULT_AVG_DOMAIN_TOKENS: ${avgDomainTokens}`);
console.log(`(based on ${domainFiles.length} domain files)`);

// Show all domain files for reference
console.log("\n=== DOMAIN FILES USED FOR AVERAGE ===");
domainFiles.forEach((f) => {
  console.log(`  ${f}: ${ontologySizes[f]} tokens`);
});