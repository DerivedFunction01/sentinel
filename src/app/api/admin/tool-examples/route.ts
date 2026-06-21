import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";

/** GET /api/admin/tool-examples - Fetch all examples */
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

  return NextResponse.json(examples);
}

/** POST /api/admin/tool-examples - Create a new tool schema example */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.SuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, description, tags, granularity, toolJson, mockResponse } = await req.json();

    if (!name || !description || !granularity || !toolJson || !mockResponse) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate JSON formatting
    try {
      JSON.parse(toolJson);
    } catch {
      return NextResponse.json({ error: "Invalid Tool JSON schema format" }, { status: 400 });
    }

    try {
      JSON.parse(mockResponse);
    } catch {
      return NextResponse.json({ error: "Invalid Mock Response JSON format" }, { status: 400 });
    }

    // tags must be a string (JSON array of strings)
    let tagsStr = "[]";
    if (Array.isArray(tags)) {
      tagsStr = JSON.stringify(tags);
    } else if (typeof tags === "string") {
      try {
        JSON.parse(tags);
        tagsStr = tags;
      } catch {
        tagsStr = JSON.stringify([tags]);
      }
    }

    const example = await db.toolSchemaExample.create({
      data: {
        name,
        description,
        tags: tagsStr,
        granularity,
        toolJson,
        mockResponse,
        isBuiltIn: false,
      },
    });

    return NextResponse.json(example);
  } catch (err: any) {
    console.error("Error creating tool schema example:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** DELETE /api/admin/tool-examples - Delete an example by ID */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.SuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    await db.toolSchemaExample.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting tool schema example:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

/** PATCH /api/admin/tool-examples - Update an existing example */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.SuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id, name, description, tags, granularity, toolJson, mockResponse } = await req.json();

    if (!id || !name || !description || !granularity || !toolJson || !mockResponse) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate JSON formatting
    try {
      JSON.parse(toolJson);
    } catch {
      return NextResponse.json({ error: "Invalid Tool JSON schema format" }, { status: 400 });
    }

    try {
      JSON.parse(mockResponse);
    } catch {
      return NextResponse.json({ error: "Invalid Mock Response JSON format" }, { status: 400 });
    }

    // tags must be a string (JSON array of strings)
    let tagsStr = "[]";
    if (Array.isArray(tags)) {
      tagsStr = JSON.stringify(tags);
    } else if (typeof tags === "string") {
      try {
        JSON.parse(tags);
        tagsStr = tags;
      } catch {
        tagsStr = JSON.stringify([tags]);
      }
    }

    const example = await db.toolSchemaExample.update({
      where: { id },
      data: {
        name,
        description,
        tags: tagsStr,
        granularity,
        toolJson,
        mockResponse,
      },
    });

    return NextResponse.json(example);
  } catch (err: any) {
    console.error("Error updating tool schema example:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
