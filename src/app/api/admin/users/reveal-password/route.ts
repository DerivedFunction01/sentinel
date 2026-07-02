import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";

/**
 * GET /api/admin/users/reveal-password?userId=...
 *
 * Retrieves the hashed password of a target user, subject to scoping:
 * - SuperAdmin: can reveal anyone's password
 * - CustomerAdmin: can reveal passwords only for users within their company
 * - User/Others: forbidden
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (
    !currentUser ||
    (currentUser.role !== UserRole.SuperAdmin &&
      currentUser.role !== UserRole.CustomerAdmin)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");

  if (!targetUserId) {
    return NextResponse.json(
      { error: "Missing userId parameter" },
      { status: 400 },
    );
  }

  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      company: true,
      password: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Scoping logic
  const isSuper = currentUser.role === UserRole.SuperAdmin;
  if (!isSuper) {
    // Customer Admin: must match company and company cannot be null/empty
    if (
      !currentUser.company ||
      !targetUser.company ||
      currentUser.company !== targetUser.company
    ) {
      return NextResponse.json(
        { error: "Forbidden: Scoped company access violation" },
        { status: 403 },
      );
    }
  }

  return NextResponse.json({ password: targetUser.password });
}
