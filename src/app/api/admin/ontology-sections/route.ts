import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import fs from "fs";
import path from "path";

const ONTOLOGY_DIR = path.join(process.cwd(), "uploads", "ontology");

interface Section {
  id: string;
  label: string;
}

interface CategorySections {
  [category: string]: Section[];
}

function parseFrontmatterCategory(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = match[1];
  const catMatch = fm.match(/^businessCategory:\s*(.+)$/m);
  if (!catMatch) return null;
  return catMatch[1].trim();
}

function getOntologySections(filePath: string, category: string): Section[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const matches = content.match(/^###\s+(\d+)\.\s+(.+)$/gm);
    if (!matches) return [];
    return matches
      .map((m) => {
        const numMatch = m.match(/^###\s+(\d+)\.\s+(.+)$/);
        if (!numMatch) return null;
        const num = numMatch[1];
        const label = numMatch[2].trim();
        return {
          id: `${category}/${num}`,
          label: `${num}. ${label}`,
        };
      })
      .filter((s): s is Section => s !== null);
  } catch {
    return [];
  }
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
      const category = parseFrontmatterCategory(content);
      if (!category) continue;

      const sections = getOntologySections(filePath, category);
      if (sections.length > 0) {
        result[category] = [
          {
            id: `${category}/ALL`,
            label: "★ All of the above / Universal Section Policy",
          },
          ...sections,
        ];
      }
    }
  } catch (error) {
    console.error("Error reading ontology sections:", error);
  }

  return NextResponse.json(result);
}
