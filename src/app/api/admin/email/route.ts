import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ADMIN_ROLES } from "@/lib/enums";

/**
 * POST /api/admin/email
 *
 * Customer/super admin only. Creates an EmailLog record (mock — no real SMTP).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(ADMIN_ROLES as string[]).includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { to, subject, body } = await req.json();
  if (!to?.trim() || !subject?.trim()) {
    return NextResponse.json({ error: "Recipient and subject are required" }, { status: 400 });
  }

  const email = await db.emailLog.create({
    data: {
      userId: session.user.id,
      to: to.trim(),
      subject: subject.trim(),
      body: body || "",
      status: "SENT", // mock — always "sent"
    },
    select: {
      id: true,
      to: true,
      subject: true,
      body: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    email: {
      ...email,
      createdAt: email.createdAt.toISOString(),
    },
  }, { status: 201 });
}
