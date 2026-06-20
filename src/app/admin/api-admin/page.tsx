import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ApiAdminClient } from "@/components/admin/api-admin-client";

export default async function ApiAdminPage() {
  const admin = await requireAdmin();

  const apiKeys = await db.apiKey.findMany({
    where: { userId: admin.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });

  const serialized = apiKeys.map((k) => ({
    ...k,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return <ApiAdminClient initialKeys={serialized} />;
}
