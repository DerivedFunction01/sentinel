import { requireSuperAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UserManagementClient } from "@/components/admin/user-management-client";

export default async function UserManagementPage() {
  await requireSuperAdmin();

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      scanTokens: true,
      createdAt: true,
      _count: { select: { scans: true, tokenRequests: true } },
    },
  });

  const serialized = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UserManagementClient users={serialized} />;
}
