import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";

/** GET /api/user — current user's profile + token balance. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      role: true,
      scanTokens: true,
      hardeningTokens: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

/** PATCH /api/user — update profile (name, company). */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, company } = await req.json();

  const user = await db.user.update({
    where: { id: session.user.id },
    data: {
      name: name ?? undefined,
      company: company ?? undefined,
    },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      role: true,
      scanTokens: true,
      hardeningTokens: true,
    },
  });

  return NextResponse.json({ user });
}
