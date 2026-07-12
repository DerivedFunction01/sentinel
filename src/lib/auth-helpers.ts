/**
 *  Server-side auth helpers.
 */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ADMIN_ROLES, UserRole } from "@/lib/enums";
import type { AppSessionUser } from "@/lib/auth";

/** Returns the current session's user, or null if not logged in. */
export async function getSessionUser(): Promise<AppSessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as AppSessionUser;
}

/**
 * Requires a logged-in user. Redirects to /login if none.
 * Returns the full DB user record (includes scanTokens, company, etc.).
 */
export async function requireUser() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  const dbUser = await db.user.findUnique({
    where: { id: sessionUser.id },
  });
  if (!dbUser) redirect("/login");
  return dbUser;
}

/** Check if a role is at least customer admin level. */
export function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as string[]).includes(role);
}

/** Check if a role is super admin. */
export function isSuperAdminRole(role: string): boolean {
  return role === UserRole.SuperAdmin;
}

/**
 * Requires any admin (customer admin or super admin).
 * Redirects regular users to /dashboard, unauthenticated to /login.
 */
export async function requireAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  if (!isAdminRole(sessionUser.role)) redirect("/dashboard");
  const dbUser = await db.user.findUnique({
    where: { id: sessionUser.id },
  });
  if (!dbUser) redirect("/login");
  return dbUser;
}

/**
 * Requires a super admin. Redirects customer admins and regular users to
 * /dashboard, unauthenticated to /login.
 */
export async function requireSuperAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  if (!isSuperAdminRole(sessionUser.role)) redirect("/dashboard");
  const dbUser = await db.user.findUnique({
    where: { id: sessionUser.id },
  });
  if (!dbUser) redirect("/login");
  return dbUser;
}
