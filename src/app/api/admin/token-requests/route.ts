import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { TokenRequestStatus, UserRole } from "@/lib/enums";

/** GET /api/admin/token-requests — list ALL token requests (admin only). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.Admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await db.tokenRequest.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, company: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

/**
 * PATCH /api/admin/token-requests — approve or deny a request.
 * Body: { id: string, action: "APPROVED" | "DENIED", adminNote?: string }
 *
 * On approval, the requested amount is added to the user's scanTokens.
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.Admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, action, adminNote } = await req.json();
  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const request = await db.tokenRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== TokenRequestStatus.Pending) {
    return NextResponse.json(
      { error: "Request already resolved" },
      { status: 400 },
    );
  }

  // Update the request record.
  const updated = await db.tokenRequest.update({
    where: { id },
    data: {
      status: action,
      adminNote: adminNote || null,
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true, company: true } },
    },
  });

  // If approved, credit the tokens to the user.
  if (action === TokenRequestStatus.Approved) {
    await db.user.update({
      where: { id: request.userId },
      data: { scanTokens: { increment: request.amount } },
    });
  }

  return NextResponse.json({ request: updated });
}
