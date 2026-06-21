import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { TokenRequestStatus, UserRole } from "@/lib/enums";

/** GET /api/admin/token-requests — list token requests (scoped for customer admin, all for super admin). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id }
  });
  if (!currentUser || (currentUser.role !== UserRole.SuperAdmin && currentUser.role !== UserRole.CustomerAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSuper = currentUser.role === UserRole.SuperAdmin;

  const requests = await db.tokenRequest.findMany({
    where: isSuper ? {} : { user: { company: currentUser.company, role: UserRole.User } },
    include: {
      user: {
        select: { id: true, name: true, email: true, company: true, scanTokens: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

/**
 * PATCH /api/admin/token-requests — approve or deny a request.
 * Body: { id: string, action: "APPROVED" | "DENIED", adminNote?: string }
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id }
  });
  if (!currentUser || (currentUser.role !== UserRole.SuperAdmin && currentUser.role !== UserRole.CustomerAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, action, adminNote } = await req.json();
  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const request = await db.tokenRequest.findUnique({
    where: { id },
    include: { user: true }
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (request.status !== TokenRequestStatus.Pending) {
    return NextResponse.json({ error: "Request already resolved" }, { status: 400 });
  }

  const isSuper = currentUser.role === UserRole.SuperAdmin;

  // Scope check for Customer Admin
  if (!isSuper) {
    if (request.user.company !== currentUser.company) {
      return NextResponse.json({ error: "Forbidden: Cannot resolve request for user outside your company" }, { status: 403 });
    }
    if (request.user.role !== UserRole.User) {
      return NextResponse.json({ error: "Forbidden: Customer Admins can only approve requests from regular users" }, { status: 403 });
    }
  }

  // If approved, credit/deduct tokens. We run updates BEFORE updating the request, so we can fetch the user's updated balance in the same transaction or select it below.
  if (action === TokenRequestStatus.Approved) {
    if (!isSuper) {
      // Check admin balance first
      if (currentUser.scanTokens < request.amount) {
        return NextResponse.json({ error: "Insufficient tokens in your admin pool" }, { status: 400 });
      }

      await db.$transaction([
        db.user.update({
          where: { id: request.userId },
          data: { scanTokens: { increment: request.amount } }
        }),
        db.user.update({
          where: { id: currentUser.id },
          data: { scanTokens: { decrement: request.amount } }
        })
      ]);
    } else {
      // Super admin approval
      await db.user.update({
        where: { id: request.userId },
        data: { scanTokens: { increment: request.amount } },
      });
    }
  }

  // Update the request record.
  const updated = await db.tokenRequest.update({
    where: { id },
    data: {
      status: action,
      adminNote: adminNote || null,
      resolvedAt: new Date(),
      resolvedBy: currentUser.id,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, company: true, scanTokens: true }
      },
    },
  });

  return NextResponse.json({ request: updated });
}
