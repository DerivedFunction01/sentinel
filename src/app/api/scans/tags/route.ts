import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getScanByReportId, getUserScans } from "@/lib/scan-db";

export async function POST(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { scanIds, tagIds } = body;

    if (!Array.isArray(scanIds) || !Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: "scanIds and tagIds must be arrays" },
        { status: 400 },
      );
    }

    if (scanIds.length === 0) {
      return NextResponse.json(
        { error: "scanIds must not be empty" },
        { status: 400 },
      );
    }

    const removeTagIds: string[] = Array.isArray(body.removeTagIds)
      ? body.removeTagIds
      : [];

    if (removeTagIds.length > 0) {
      const duplicate = removeTagIds.some((id: string) => tagIds.includes(id));
      if (duplicate) {
        return NextResponse.json(
          { error: "A tagId cannot appear in both tagIds and removeTagIds" },
          { status: 400 },
        );
      }
    }

    // Fetch the user's vocabulary to resolve tag names
    const dbUser = await db.user.findUnique({
      where: { id: user.userId },
      select: { userTags: true },
    });

    let vocabulary: Array<{ id: string; name: string }> = [];
    try {
      if (dbUser?.userTags) {
        vocabulary = JSON.parse(dbUser.userTags);
      }
    } catch {}

    const vocabMap = new Map(vocabulary.map((v) => [v.id, v.name]));

    // Resolve each tagId against the vocabulary
    const resolvedTags: string[] = [];
    for (const tagId of tagIds) {
      const name = vocabMap.get(tagId);
      if (!name) {
        return NextResponse.json(
          { error: `Tag id "${tagId}" not found in your vocabulary` },
          { status: 400 },
        );
      }
      resolvedTags.push(`${tagId}~${name}`);
    }

    // Update each scan, deduping by tagId prefix
    const addTagPrefixSet = new Set(tagIds);
    const removeTagPrefixSet = new Set(removeTagIds);

    for (const scanId of scanIds) {
      const scan = await db.scan.findFirst({
        where: { reportId: scanId, userId: user.userId },
        select: { id: true, tags: true },
      });

      if (!scan) continue;

      let existingTags: string[] = [];
      try {
        existingTags = JSON.parse(scan.tags || "[]");
      } catch {}

      const filtered = existingTags.filter((entry) => {
        const existingId = entry.split("~")[0];
        return !addTagPrefixSet.has(existingId) && !removeTagPrefixSet.has(existingId);
      });

      const merged = [...filtered, ...resolvedTags];

      await db.scan.update({
        where: { id: scan.id },
        data: { tags: JSON.stringify(merged) },
      });
    }

    // Return updated scan summaries
    const updatedScans = await getUserScans(user.userId);

    return NextResponse.json({ scans: updatedScans });
  } catch (error: any) {
    console.error("Error bulk tagging scans:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}