import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { TokenRequestStatus } from "@/lib/enums";

/** GET /api/token-requests — list the current user's token requests. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await db.tokenRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

/** POST /api/token-requests — create a new token refill request. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount, reason, plan } = await req.json();
  if (!amount || amount < 1 || amount > 10000) {
    return NextResponse.json(
      { error: "Amount must be between 1 and 10000." },
      { status: 400 },
    );
  }

  const request = await db.tokenRequest.create({
    data: {
      userId: session.user.id,
      amount: Math.floor(amount),
      reason: reason || null,
      plan: plan || null,
      status: TokenRequestStatus.Pending,
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}
