import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ADMIN_ROLES } from "@/lib/enums";
import { AdminSidebar, MobileAdminNav } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) redirect("/login");

  // Only customer admins and super admins can access the admin panel.
  if (!(ADMIN_ROLES as string[]).includes(user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="dark flex min-h-screen bg-background">
      <AdminSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col md:ml-60">
        <MobileAdminNav user={user} />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
