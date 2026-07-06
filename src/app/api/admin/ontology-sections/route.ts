import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { getOntologySectionsFromContent, OntologySection } from "@/lib/frontmatter-utils";
import fs from "fs";
import path from "path";

const ONTOLOGY_DIR = path.join(process.cwd(), "uploads", "ontology");

interface CategorySections {
  [category: string]: OntologySection[];
}

/** GET /api/admin/ontology-sections - Returns dynamic ontology sections grouped by category */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.SuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result: CategorySections = {};

  try {
    if (!fs.existsSync(ONTOLOGY_DIR)) {
      return NextResponse.json(result);
    }

    const files = fs.readdirSync(ONTOLOGY_DIR).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(ONTOLOGY_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const sections = getOntologySectionsFromContent(content);
      if (sections.length === 0) continue;

      // Use the businessCategory from the parsed sections
      const category = sections[0].id.split("/")[0];
      if (sections.length > 0) {
        if (!result[category]) {
          result[category] = [
            {
              id: `${category}/ALL`,
              label: "★ All of the above / Universal Section Policy",
            },
            ...sections,
          ];
        }
      }
    }
  } catch (error) {
    console.error("Error reading ontology sections:", error);
  }

  return NextResponse.json(result);
}
