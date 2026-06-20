import { requireSuperAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ToolExamplesClient } from "@/components/admin/tool-examples-client";

export default async function ToolExamplesPage() {
  await requireSuperAdmin();

  const examples = await db.toolSchemaExample.findMany({
    orderBy: { createdAt: "desc" },
  });

  const serialized = examples.map((ex) => ({
    ...ex,
    createdAt: ex.createdAt.toISOString(),
    updatedAt: ex.updatedAt.toISOString(),
  }));

  return <ToolExamplesClient initialExamples={serialized} />;
}
