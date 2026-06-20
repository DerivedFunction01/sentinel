import Link from "next/link";
import { Coins, Users, Shield, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";
import { getRiskStyle } from "@/lib/risk-utils";

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === UserRole.SuperAdmin;

  // Fetch stats based on role.
  const [totalUsers, pendingRequests, totalScans, totalTokensGranted] =
    await Promise.all([
      db.user.count(),
      db.tokenRequest.count({ where: { status: "PENDING" } }),
      db.scan.count(),
      db.tokenRequest.aggregate({
        where: { status: "APPROVED" },
        _sum: { amount: true },
      }),
    ]);

  const recentRequests = await db.tokenRequest.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true, company: true } } },
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isSuperAdmin ? "Super Admin Overview" : "Customer Admin Overview"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuperAdmin
            ? "Platform-wide statistics and management."
            : "Manage your organization's API, users, billing, and system settings."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox
          label="Total Users"
          value={totalUsers}
          icon={Users}
          accent="blue"
        />
        <StatBox
          label="Pending Requests"
          value={pendingRequests}
          icon={Coins}
          accent="amber"
        />
        <StatBox
          label="Total Scans"
          value={totalScans}
          icon={TrendingUp}
          accent="emerald"
        />
        <StatBox
          label="Tokens Granted"
          value={totalTokensGranted._sum.amount ?? 0}
          icon={Shield}
          accent="default"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isSuperAdmin ? (
          <>
            <QuickLink
              href="/admin/token-requests"
              title="Token Requests"
              description="Review and approve scan token requests from all users."
              icon={Coins}
            />
            <QuickLink
              href="/admin/user-management"
              title="User Management"
              description="View all users, change roles, adjust token balances."
              icon={Users}
            />
          </>
        ) : (
          <>
            <QuickLink
              href="/admin/api-admin"
              title="API Admin"
              description="Manage API keys and access."
              icon={Shield}
            />
            <QuickLink
              href="/admin/user-management"
              title="User Management"
              description="Manage org users and permissions."
              icon={Users}
            />
            <QuickLink
              href="/admin/billing-management"
              title="Billing Management"
              description="View invoices and manage subscriptions."
              icon={Coins}
            />
            <QuickLink
              href="/admin/email-center"
              title="Email Center"
              description="Send and review email notifications."
              icon={TrendingUp}
            />
            <QuickLink
              href="/admin/system-management"
              title="System Management"
              description="Configure system settings and integrations."
              icon={Shield}
            />
          </>
        )}
      </div>

      {/* Recent token requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Recent Token Requests</span>
            {isSuperAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/token-requests">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No token requests yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      +{req.amount} tokens
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.user.email} · {req.user.company || "—"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      req.status === "APPROVED"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : req.status === "DENIED"
                          ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "default" | "blue" | "amber" | "emerald";
}) {
  const accentCls = {
    default: "text-foreground",
    blue: "text-blue-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
  }[accent];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${accentCls}`} />
      </div>
      <p className={`mt-1 text-2xl font-bold ${accentCls}`}>{value}</p>
    </Card>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-all hover:border-blue-500/40 hover:shadow-lg">
        <CardContent className="p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15">
            <Icon className="h-5 w-5 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
