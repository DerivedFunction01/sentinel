import { requireSuperAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { TokenRequestsClient } from "@/components/admin/token-requests-client";

export default async function TokenRequestsPage() {
  await requireSuperAdmin();

  const requests = await db.tokenRequest.findMany({
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

  return <TokenRequestsClient requests={serialized} />;
}
