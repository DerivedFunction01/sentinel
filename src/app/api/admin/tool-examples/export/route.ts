import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";
import { gzipSync } from "zlib";

/**
 * GET /api/admin/tool-examples/export
 *
 * Exports all ToolSchemaExample records as a gzipped JSONL file.
 * Each line is a JSON object with the full example record.
 *
 * The response is a .jsonl.gz download.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.SuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const examples = await db.toolSchemaExample.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Build JSONL — one JSON object per line.
  const lines = examples.map((ex) =>
    JSON.stringify({
      id: ex.id,
      name: ex.name,
      description: ex.description,
      tags: ex.tags,
      granularity: ex.granularity,
      toolJson: ex.toolJson,
      mockResponse: ex.mockResponse,
      isBuiltIn: ex.isBuiltIn,
      businessCategories: ex.businessCategories,
      createdAt: ex.createdAt.toISOString(),
      updatedAt: ex.updatedAt.toISOString(),
    }),
  );

  const jsonl = lines.join("\n");
  const gzipped = gzipSync(jsonl);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `ToolRegistry-tool-examples-${date}.jsonl.gz`;

  return new NextResponse(gzipped, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
