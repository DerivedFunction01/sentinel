import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const CONVERSION_RATE = 10; // 1 scan token → 10 hardening tokens

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scanTokensToConvert: number = Number(body.scanTokens);

    if (!scanTokensToConvert || scanTokensToConvert < 1 || !Number.isInteger(scanTokensToConvert)) {
      return NextResponse.json(
        { error: "invalid_amount", message: "scanTokens must be a positive integer." },
        { status: 400 },
      );
    }

    // Fetch current balance
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { scanTokens: true, hardeningTokens: true },
    });

    if (!user || user.scanTokens < scanTokensToConvert) {
      return NextResponse.json(
        {
          error: "insufficient_scan_tokens",
          message: `You need ${scanTokensToConvert} scan token${scanTokensToConvert > 1 ? "s" : ""} to convert. You have ${user?.scanTokens ?? 0}.`,
          required: scanTokensToConvert,
          available: user?.scanTokens ?? 0,
        },
        { status: 402 },
      );
    }

    const hardeningGained = scanTokensToConvert * CONVERSION_RATE;

    // Atomic: deduct scan tokens, add hardening tokens
    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        scanTokens: { decrement: scanTokensToConvert },
        hardeningTokens: { increment: hardeningGained },
      },
      select: { scanTokens: true, hardeningTokens: true },
    });

    return NextResponse.json({
      scanTokensConverted: scanTokensToConvert,
      hardeningTokensGained: hardeningGained,
      scanTokensRemaining: updated.scanTokens,
      hardeningTokensRemaining: updated.hardeningTokens,
      conversionRate: CONVERSION_RATE,
    });
  } catch (error: any) {
    console.error("Error converting tokens:", error);
    return new Response("Error converting tokens", { status: 500 });
  }
}
