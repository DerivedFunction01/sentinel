import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * GET /api/api-keys — list the current user's API keys (prefix only).
 * POST /api/api-keys — create a new API key, returns the full key once.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Generate a random key: sp_live_<32 hex chars>
  const random = crypto.randomBytes(16).toString("hex");
  const plainKey = `sp_live_${random}`;
  const keyPrefix = plainKey.slice(0, 12);
  const hashedKey = await bcrypt.hash(plainKey, 10);

  const key = await db.apiKey.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      keyPrefix,
      hashedKey,
    },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });

  return NextResponse.json({ key, plainKey }, { status: 201 });
}

/**
 * DELETE /api/api-keys?id=<keyId> — revoke an API key.
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });
  }

  // Ensure the key belongs to the current user.
  const key = await db.apiKey.findFirst({ where: { id, userId: session.user.id } });
  if (!key) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  await db.apiKey.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
