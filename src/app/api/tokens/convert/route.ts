import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const HARDENING_CONVERSION_RATE = 10; // 1 scan token → 10 hardening tokens
const REEVALUATION_CONVERSION_RATE = 30; // 1 scan token → 30 reevaluation tokens

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scanTokensToConvert: number = Number(body.scanTokens);
    const target: string = body.target || "hardening"; // "hardening" | "reevaluation"

    if (!scanTokensToConvert || scanTokensToConvert < 1 || !Number.isInteger(scanTokensToConvert)) {
      return NextResponse.json(
        { error: "invalid_amount", message: "scanTokens must be a positive integer." },
        { status: 400 },
      );
    }

    if (target !== "hardening" && target !== "reevaluation") {
      return NextResponse.json(
        { error: "invalid_target", message: "target must be 'hardening' or 'reevaluation'." },
        { status: 400 },
      );
    }

    const conversionRate = target === "reevaluation" ? REEVALUATION_CONVERSION_RATE : HARDENING_CONVERSION_RATE;

    // Fetch current balance
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { scanTokens: true, hardeningTokens: true, reevaluationTokens: true },
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

    const tokensGained = scanTokensToConvert * conversionRate;

    // Atomic: deduct scan tokens, add target tokens
    const updateData: any = {
      scanTokens: { decrement: scanTokensToConvert },
    };
    if (target === "reevaluation") {
      updateData.reevaluationTokens = { increment: tokensGained };
    } else {
      updateData.hardeningTokens = { increment: tokensGained };
    }

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { scanTokens: true, hardeningTokens: true, reevaluationTokens: true },
    });

    return NextResponse.json({
      scanTokensConverted: scanTokensToConvert,
      tokensGained,
      target,
      conversionRate,
      scanTokensRemaining: updated.scanTokens,
      hardeningTokensRemaining: updated.hardeningTokens,
      reevaluationTokensRemaining: updated.reevaluationTokens,
    });
  } catch (error: any) {
    console.error("Error converting tokens:", error);
    return new Response("Error converting tokens", { status: 500 });
  }
}
