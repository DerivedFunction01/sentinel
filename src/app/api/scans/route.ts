import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { getUserScans, deleteScans, deleteAllScans } from "@/lib/scan-db";

import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const full = searchParams.get("full") === "true";

    if (full) {
      const scans = await db.scan.findMany({
        where: { userId: user.userId },
        include: { hardenedPrompts: true },
        orderBy: { createdAt: "desc" },
      });
      const parsedScans = scans.map((scan) => {
        let parsedTools = [];
        try { parsedTools = JSON.parse(scan.tools); } catch {}
        let parsedMock = {};
        try { parsedMock = JSON.parse(scan.mockToolResponses); } catch {}
        let parsedTrials = [];
        try { parsedTrials = JSON.parse(scan.trials); } catch {}
        let parsedMeta = null;
        try { parsedMeta = scan.metadata ? JSON.parse(scan.metadata) : null; } catch {}
        let parsedTags = [];
        try { parsedTags = JSON.parse(scan.tags || "[]"); } catch {}

        return {
          ...scan,
          tools: parsedTools,
          mockToolResponses: parsedMock,
          trials: parsedTrials,
          metadata: parsedMeta,
          tags: parsedTags,
        };
      });
      return NextResponse.json({ scans: parsedScans });
    }

    const scans = await getUserScans(user.userId);
    return NextResponse.json({ scans });
  } catch (error: any) {
    console.error("Error fetching scans list:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { ids, all } = body;

    if (all) {
      await deleteAllScans(user.userId);
    } else if (Array.isArray(ids)) {
      await deleteScans(ids, user.userId);
    } else {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting scans:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

