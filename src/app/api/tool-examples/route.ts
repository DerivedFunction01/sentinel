import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tagsParam = searchParams.get("tags");
    const granularity = searchParams.get("granularity");

    const whereClause: any = {};
    if (granularity) {
      whereClause.granularity = granularity;
    }

    const examples = await db.toolSchemaExample.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    if (tagsParam) {
      const searchTags = tagsParam.split(",").map((t) => t.trim().toLowerCase());
      
      const scored = examples.map((ex) => {
        let score = 0;
        try {
          const parsedTags = JSON.parse(ex.tags) as string[];
          const parsedLower = parsedTags.map((t) => t.toLowerCase());
          score = parsedLower.filter((t) => searchTags.includes(t)).length;
        } catch {}
        return { ex, score };
      });

      // Filter to only those with at least one tag match, and sort by highest score first
      const filtered = scored
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.ex);

      return NextResponse.json(filtered);
    }

    return NextResponse.json(examples);
  } catch (error) {
    console.error("Error fetching tool examples:", error);
    return new Response("Error fetching tool examples", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, description, tags, granularity, toolJson, mockResponse } = body;

    if (!name || !description || !tags || !granularity || !toolJson || !mockResponse) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Verify tag serialization
    let tagsString = "";
    if (Array.isArray(tags)) {
      tagsString = JSON.stringify(tags);
    } else {
      tagsString = JSON.stringify(
        tags
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean)
      );
    }

    const created = await db.toolSchemaExample.create({
      data: {
        name,
        description,
        tags: tagsString,
        granularity,
        toolJson: typeof toolJson === "string" ? toolJson : JSON.stringify(toolJson),
        mockResponse: typeof mockResponse === "string" ? mockResponse : JSON.stringify(mockResponse),
        isBuiltIn: false,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("Error creating tool example:", error);
    return new Response("Error creating tool example", { status: 500 });
  }
}
