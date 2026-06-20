import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";

export async function POST(req: Request) {
  try {
    const { name, email, password, company } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        password: hashed,
        company: company || null,
        role: UserRole.User,
        scanTokens: 10, // new users start with 10 free tokens
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
    });
  } catch {
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
