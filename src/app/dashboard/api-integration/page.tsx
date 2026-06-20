import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ApiAdminClient } from "@/components/admin/api-admin-client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ApiIntegrationPage() {
  const user = await requireUser();

  const apiKeys = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });

  const serialized = apiKeys.map((k) => ({
    ...k,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/dashboard">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>
      <ApiAdminClient initialKeys={serialized} />
    </div>
  );
}
