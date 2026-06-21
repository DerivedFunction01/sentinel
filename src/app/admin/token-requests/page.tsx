import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { TokenRequestsClient } from "@/components/admin/token-requests-client";
import { UserRole } from "@/lib/enums";

export default async function TokenRequestsPage() {
  const currentUser = await requireAdmin();
  const isSuper = currentUser.role === UserRole.SuperAdmin;

  const requests = await db.tokenRequest.findMany({
    where: isSuper ? {} : { user: { company: currentUser.company } },
    include: {
      user: {
        select: { id: true, name: true, email: true, company: true, scanTokens: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = requests.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));

  const clientUser = {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    role: currentUser.role,
    company: currentUser.company,
    scanTokens: currentUser.scanTokens,
  };

  return <TokenRequestsClient requests={serialized} currentUser={clientUser} />;
}
