import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";
import bcrypt from "bcryptjs";

/**
 * POST /api/admin/users
 *
 * Create a new user or customer admin.
 */
export async function POST(req: Request) {
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

  const { name, email, password, role, company } = await req.json();
  if (!email || !password || !role) {
    return NextResponse.json({ error: "Email, password, and role are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Validate role
  if (![UserRole.User, UserRole.CustomerAdmin, UserRole.SuperAdmin].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Scope validation
  let targetCompany = company || null;
  if (currentUser.role === UserRole.CustomerAdmin) {
    if (role === UserRole.SuperAdmin) {
      return NextResponse.json({ error: "Cannot create Super Admin" }, { status: 403 });
    }
    // Lock to customer admin's company ID
    targetCompany = currentUser.company;
  }

  const existing = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  let newUser = await db.user.create({
    data: {
      name: name || null,
      email: email.toLowerCase(),
      password: hashed,
      role,
      company: targetCompany,
      scanTokens: 10,
    },
  });

  // Unique Company ID logic: if this is a Customer Admin and has no company ID, set it to their own ID
  if (role === UserRole.CustomerAdmin && !newUser.company) {
    newUser = await db.user.update({
      where: { id: newUser.id },
      data: { company: newUser.id },
    });
  }

  return NextResponse.json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    company: newUser.company,
    scanTokens: newUser.scanTokens,
    createdAt: newUser.createdAt.toISOString(),
  }, { status: 201 });
}

/**
 * PATCH /api/admin/users
 *
 * Update user role or adjust tokens (with pooling logic for customer admins).
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

  const { userId, role, tokenDelta } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Fetch the target user to perform scope checks
  const targetUser = await db.user.findUnique({
    where: { id: userId }
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isSuper = currentUser.role === UserRole.SuperAdmin;

  // Scope validation for customer admins
  if (!isSuper) {
    if (!targetUser.company || targetUser.company !== currentUser.company) {
      return NextResponse.json({ error: "Forbidden: User is not in your company" }, { status: 403 });
    }
    if (role && role === UserRole.SuperAdmin) {
      return NextResponse.json({ error: "Forbidden: Cannot assign Super Admin role" }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (role && Object.values(UserRole).includes(role as UserRole)) {
    data.role = role;
  }

  // Token adjustment transaction logic
  if (typeof tokenDelta === "number" && tokenDelta !== 0) {
    if (!isSuper) {
      // Customer Admin token adjustments are deducted/refunded to their pool (own scanTokens)
      if (tokenDelta > 0) {
        // Admin needs enough tokens to give
        if (currentUser.scanTokens < tokenDelta) {
          return NextResponse.json({ error: "Insufficient tokens in your admin pool" }, { status: 400 });
        }
      } else {
        // Prevent user's balance from going below 0
        if (targetUser.scanTokens + tokenDelta < 0) {
          return NextResponse.json({ error: "User does not have enough tokens to deduct" }, { status: 400 });
        }
      }

      // Execute transaction to update both users
      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: { scanTokens: { increment: tokenDelta } }
        }),
        db.user.update({
          where: { id: currentUser.id },
          data: { scanTokens: { decrement: tokenDelta } }
        })
      ]);
    } else {
      // Super admin is not limited by a pool
      await db.user.update({
        where: { id: userId },
        data: { scanTokens: { increment: tokenDelta } }
      });
    }
  }

  if (Object.keys(data).length > 0) {
    await db.user.update({
      where: { id: userId },
      data,
    });
  }

  const updatedUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      scanTokens: true,
      createdAt: true,
      _count: { select: { scans: true, tokenRequests: true } }
    }
  });

  return NextResponse.json(updatedUser);
}
