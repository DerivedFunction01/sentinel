import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { CreditCard, Download, Receipt, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/dashboard-parts";
import { formatTokens } from "@/lib/token-formatter";

export default async function BillingManagementPage() {
  const admin = await requireAdmin();

  // Fetch the org's token requests that have a plan (purchases).
  const purchases = await db.tokenRequest.findMany({
    where: { userId: admin.id, plan: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, plan: true, status: true, createdAt: true, reason: true },
  });

  // Mock invoice data.
  const planPrices: Record<string, number> = { starter: 0, pro: 49, enterprise: 299 };
  const totalSpent = purchases
    .filter((p) => p.status === "APPROVED")
    .reduce((sum, p) => sum + (planPrices[p.plan ?? ""] ?? 0), 0);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Billing Management"
        description="View invoices, manage subscriptions, and track spending."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-400">${totalSpent}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Current Plan</p>
            <CreditCard className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {purchases[0]?.plan ?? "Free"}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">USD Baseline Balance</p>
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-400">{formatTokens(admin.scanTokens)}</p>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-blue-400" />
            Invoice History
          </CardTitle>
          <CardDescription>
            Download invoices for your purchases. During beta, all transactions are
            admin-approved requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No purchases yet.{" "}
              <a href="/dashboard/billing" className="text-blue-400 hover:underline">
                View plans
              </a>
            </p>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground capitalize">
                        {p.plan} plan
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          p.status === "APPROVED"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : p.status === "DENIED"
                              ? "border-red-500/30 bg-red-500/10 text-red-400"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        }
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()} · {formatTokens(p.amount)} ·
                      ${planPrices[p.plan ?? ""] ?? 0}
                    </p>
                  </div>
                  {p.status === "APPROVED" && (
                    <Button size="sm" variant="outline" className="h-8">
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Invoice
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
