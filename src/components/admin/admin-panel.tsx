"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Shield,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Coins,
  Loader2,
  Mail,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { TokenRequestStatus } from "@/lib/enums";
import { LogoIcon } from "@/components/shared/logo";

interface AdminRequest {
  id: string;
  amount: number;
  reason: string | null;
  plan: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    scanTokens: number;
  };
}

interface AdminStats {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  tokensApproved: number;
  users: number;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface AdminPanelProps {
  requests: AdminRequest[];
  stats: AdminStats;
  admin: AdminUser;
}

const STATUS_STYLES: Record<
  string,
  {
    label: string;
    cls: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  [TokenRequestStatus.Pending]: {
    label: "Pending",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    icon: Clock,
  },
  [TokenRequestStatus.Approved]: {
    label: "Approved",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    icon: CheckCircle2,
  },
  [TokenRequestStatus.Denied]: {
    label: "Denied",
    cls: "border-red-500/30 bg-red-500/10 text-red-400",
    icon: XCircle,
  },
};

type Filter = "ALL" | TokenRequestStatus;

export function AdminPanel({
  requests: initialRequests,
  stats,
  admin,
}: AdminPanelProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [processing, setProcessing] = useState<string | null>(null);

  const filtered = requests.filter(
    (r) => filter === "ALL" || r.status === filter,
  );

  const handleAction = async (
    id: string,
    action: TokenRequestStatus,
    adminNote?: string,
  ) => {
    setProcessing(id);
    try {
      const res = await fetch("/api/admin/token-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }
      setRequests((prev) => prev.map((r) => (r.id === id ? data.request : r)));
      toast.success(
        action === TokenRequestStatus.Approved
          ? "Request approved — tokens credited"
          : "Request denied",
      );
    } catch {
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon size="sm" />
            <span className="text-base font-bold text-sidebar-foreground">
              SentinelPrompt
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-blue-600/15 px-3 py-2.5 text-sm font-medium text-blue-400">
            <ShieldAlert className="h-4 w-4" />
            Admin Panel
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </nav>
        <Separator className="bg-sidebar-border" />
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600/20 text-xs font-semibold text-blue-400">
              {(admin.name?.[0] ?? "A").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {admin.name || "Admin"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/50">
                {admin.email}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-1 w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
          <Link href="/dashboard" className="text-sidebar-foreground/60">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="flex items-center gap-1.5 text-sm font-medium text-blue-400">
            <ShieldAlert className="h-4 w-4" />
            Admin Panel
          </span>
        </div>

        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Admin Panel
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review and fulfill scan token requests. This is the only place
              tokens can be refilled.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatBox label="Total Requests" value={stats.total} icon={Clock} />
            <StatBox
              label="Pending"
              value={stats.pending}
              icon={Clock}
              accent="amber"
            />
            <StatBox
              label="Approved"
              value={stats.approved}
              icon={CheckCircle2}
              accent="emerald"
            />
            <StatBox
              label="Tokens Granted"
              value={stats.tokensApproved}
              icon={Coins}
              accent="blue"
            />
            <StatBox
              label="Total Users"
              value={stats.users}
              icon={Users}
              accent="default"
            />
          </div>

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", TokenRequestStatus.Pending, TokenRequestStatus.Approved, TokenRequestStatus.Denied] as Filter[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                className={filter === f ? "bg-blue-600 hover:bg-blue-700" : ""}
                onClick={() => setFilter(f)}
              >
                {f === "ALL"
                  ? `All (${stats.total})`
                  : f === "PENDING"
                    ? `Pending (${stats.pending})`
                    : f === "APPROVED"
                      ? `Approved (${stats.approved})`
                      : `Denied (${stats.denied})`}
              </Button>
            ))}
          </div>

          {/* Requests list */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No {filter !== "ALL" ? filter.toLowerCase() : ""} requests.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((req) => {
                const style =
                  STATUS_STYLES[req.status] || STATUS_STYLES["PENDING"];
                const StatusIcon = style.icon;
                const isPending = req.status === "PENDING";
                return (
                  <Card key={req.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* User + request info */}
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-bold text-foreground">
                              +{req.amount} tokens
                            </span>
                            <Badge variant="outline" className={style.cls}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {style.label}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {req.user.email}
                            </span>
                            {req.user.company && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {req.user.company}
                              </span>
                            )}
                            {req.plan && (
                              <span className="rounded bg-blue-600/15 px-1.5 py-0.5 font-medium text-blue-400">
                                Plan: {req.plan}
                              </span>
                            )}
                            <span>
                              Current balance: {req.user.scanTokens} tokens
                            </span>
                            <span>
                              {new Date(req.createdAt).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {req.reason && (
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium text-foreground/80">
                                Reason:
                              </span>{" "}
                              {req.reason}
                            </p>
                          )}
                          {req.adminNote && (
                            <p className="text-sm italic text-muted-foreground">
                              Admin note: {req.adminNote}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        {isPending && (
                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleAction(
                                  req.id,
                                  TokenRequestStatus.Approved,
                                )
                              }
                              disabled={processing === req.id}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              {processing === req.id ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleAction(req.id, TokenRequestStatus.Denied)
                              }
                              disabled={processing === req.id}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Deny
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  accent = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "default" | "amber" | "emerald" | "blue";
}) {
  const accentCls = {
    default: "text-foreground",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
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
