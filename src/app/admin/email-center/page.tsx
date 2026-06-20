import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { EmailCenterClient } from "@/components/admin/email-center-client";

export default async function EmailCenterPage() {
  const admin = await requireAdmin();

  const emails = await db.emailLog.findMany({
    where: { userId: admin.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, to: true, subject: true, status: true, createdAt: true, body: true },
    take: 50,
  });

  const serialized = emails.map((e) => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
  }));

  return <EmailCenterClient initialEmails={serialized} />;
}
