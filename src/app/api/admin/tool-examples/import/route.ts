import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";
import { gunzipSync } from "zlib";

/**
 * POST /api/admin/tool-examples/import
 *
 * Accepts a gzipped or plain JSONL file of ToolSchemaExample records.
 * Parses each line, skips duplicates (matching name + granularity), and inserts the rest.
 *
 * Returns the count of imported, skipped, and error examples.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.SuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded. Expected a .jsonl.gz or .jsonl file." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let jsonl: string;
    try {
      jsonl = gunzipSync(buffer).toString("utf-8");
    } catch {
      // Fallback: try reading as plain JSONL
      try {
        jsonl = buffer.toString("utf-8");
      } catch {
        return NextResponse.json(
          { error: "Could not read the file. Expected a valid .jsonl or gzipped .jsonl.gz file." },
          { status: 400 },
        );
      }
    }

    const lines = jsonl.trim().split("\n").filter(Boolean);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const data = JSON.parse(lines[i]);

        // Validate required fields.
        if (!data.name || !data.description || !data.granularity || !data.toolJson || !data.mockResponse) {
          errors.push(`Line ${i + 1}: missing required fields`);
          continue;
        }

        // Check for existing tool schema example with same name and granularity.
        const existing = await db.toolSchemaExample.findFirst({
          where: {
            name: data.name,
            granularity: data.granularity,
          },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Tags must be stored as stringified JSON array
        let tagsStr = "[]";
        if (Array.isArray(data.tags)) {
          tagsStr = JSON.stringify(data.tags);
        } else if (typeof data.tags === "string") {
          try {
            JSON.parse(data.tags);
            tagsStr = data.tags;
          } catch {
            tagsStr = JSON.stringify([data.tags]);
          }
        }

        const validCategories = ["standard", "regulatory", "meta"];
        const resolvedCategory = validCategories.includes(data.category)
          ? data.category
          : "standard";

        await db.toolSchemaExample.create({
          data: {
            name: data.name,
            description: data.description,
            tags: tagsStr,
            granularity: data.granularity,
            category: resolvedCategory,
            toolJson: data.toolJson,
            mockResponse: data.mockResponse,
            isBuiltIn: data.isBuiltIn ?? false,
          },
        });
        imported++;
      } catch (err: any) {
        errors.push(`Line ${i + 1}: invalid JSON or database error (${err.message || err})`);
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      errors: errors.slice(0, 10), // cap the error list
    });
  } catch (err: any) {
    console.error("Error importing tool examples:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
