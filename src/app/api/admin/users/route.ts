import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";

/**
 * PATCH /api/admin/users
 *
 * Super admin only. Updates a user's role or adjusts their token balance.
 * Body: { userId: string, role?: string, tokenDelta?: number }
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.SuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, role, tokenDelta } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (role && Object.values(UserRole).includes(role as UserRole)) {
    data.role = role;
  }
  if (typeof tokenDelta === "number" && tokenDelta !== 0) {
    data.scanTokens = { increment: tokenDelta };
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data,
    select: { id: true, role: true, scanTokens: true },
  });

  return NextResponse.json(updated);
}
