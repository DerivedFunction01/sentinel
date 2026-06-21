import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UserManagementClient } from "@/components/admin/user-management-client";
import { UserRole } from "@/lib/enums";

export default async function UserManagementPage() {
  const currentUser = await requireAdmin();
  const isSuper = currentUser.role === UserRole.SuperAdmin;

  const users = await db.user.findMany({
    where: isSuper ? {} : { company: currentUser.company },
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

  // Clean currentUser for passing to client components securely
  const clientUser = {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    role: currentUser.role,
    company: currentUser.company,
    scanTokens: currentUser.scanTokens,
  };

  return <UserManagementClient users={serialized} currentUser={clientUser} />;
}
