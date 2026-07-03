import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.userId },
      select: { userTags: true },
    });

    let tags: Array<{ id: string; name: string }> = [];
    try {
      if (dbUser?.userTags) {
        tags = JSON.parse(dbUser.userTags);
      }
    } catch {}

    return NextResponse.json({ tags });
  } catch (error: any) {
    console.error("Error fetching user tags:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { tags } = body;

    // Validate: must be an array
    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: "tags must be an array" },
        { status: 400 },
      );
    }

    // Validate: max 25 entries
    if (tags.length > 25) {
      return NextResponse.json(
        { error: "Maximum 25 tags allowed" },
        { status: 400 },
      );
    }

    // Validate each entry
    const seenIds = new Set<string>();
    for (const tag of tags) {
      if (!tag.id || typeof tag.id !== "string") {
        return NextResponse.json(
          { error: "Each tag must have a string id" },
          { status: 400 },
        );
      }
      if (!tag.name || typeof tag.name !== "string") {
        return NextResponse.json(
          { error: "Each tag must have a string name" },
          { status: 400 },
        );
      }
      const trimmed = tag.name.trim();
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "Tag name cannot be empty" },
          { status: 400 },
        );
      }
      if (trimmed.length >= 25) {
        return NextResponse.json(
          { error: `Tag name "${trimmed}" exceeds 25 characters` },
          { status: 400 },
        );
      }
      if (seenIds.has(tag.id)) {
        return NextResponse.json(
          { error: `Duplicate tag id: ${tag.id}` },
          { status: 400 },
        );
      }
      seenIds.add(tag.id);
    }

    // Save
    const cleaned = tags.map((t: { id: string; name: string }) => ({
      id: t.id,
      name: t.name.trim(),
    }));

    await db.user.update({
      where: { id: user.userId },
      data: { userTags: JSON.stringify(cleaned) },
    });

    return NextResponse.json({ tags: cleaned });
  } catch (error: any) {
    console.error("Error updating user tags:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
