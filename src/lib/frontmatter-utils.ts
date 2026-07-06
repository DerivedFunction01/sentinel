/**
 * Parse YAML-style frontmatter from a markdown file.
 * Returns { title, description, businessCategory, body }.
 *
 * This is intentionally a standalone function so it can be swapped out
 * for a library (e.g. gray-matter) without touching call sites.
 */
export function parseFrontmatter(content: string): {
  title: string;
  description: string;
  businessCategory: string;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m);
  if (!match)
    return {
      title: "",
      description: "",
      businessCategory: "",
      body: content.trim(),
    };

  const meta = match[1];
  const body = match[2].trim();

  const get = (key: string): string => {
    const line = meta.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return line ? line[1].trim() : "";
  };

  return {
    title: get("title"),
    description: get("description"),
    businessCategory: get("businessCategory"),
    body,
  };
}

export interface OntologySection {
  id: string;
  label: string;
}

/**
 * Extract sections from the body of an ontology markdown file.
 * Sections are marked as `### N. Title`. The caller provides the full file content;
 * this function parses frontmatter for the businessCategory and scans for sections.
 *
 * Returns an array of { id, label } objects where id is "{category}/{number}".
 */
export function getOntologySectionsFromContent(
  content: string,
): OntologySection[] {
  const { businessCategory } = parseFrontmatter(content);
  if (!businessCategory) return [];

  const matches = content.match(/^###\s+(\d+)\.\s+(.+)$/gm);
  if (!matches) return [];

  return matches
    .map((m) => {
      const numMatch = m.match(/^###\s+(\d+)\.\s+(.+)$/);
      if (!numMatch) return null;
      const num = numMatch[1];
      const label = numMatch[2].trim();
      return {
        id: `${businessCategory}/${num}`,
        label: `${num}. ${label}`,
      };
    })
    .filter((s): s is OntologySection => s !== null);
}
