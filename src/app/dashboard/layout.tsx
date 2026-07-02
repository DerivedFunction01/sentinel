import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardSidebar, MobileDashboardNav } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      scanTokens: true,
      hardeningTokens: true,
      reevaluationTokens: true,
      role: true,
    },
  });
  if (!user) redirect("/login");

  return (
    <div className="dark flex min-h-screen bg-background">
      <DashboardSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileDashboardNav user={user} />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
