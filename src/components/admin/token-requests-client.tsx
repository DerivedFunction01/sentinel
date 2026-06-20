"use client";

import { useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Coins,
  Mail,
  Building2,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TokenRequestStatus } from "@/lib/enums";

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

interface TokenRequestsClientProps {
  requests: AdminRequest[];
}

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
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

type Filter = "ALL" | typeof TokenRequestStatus[keyof typeof TokenRequestStatus];

export function TokenRequestsClient({ requests: initialRequests }: TokenRequestsClientProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [processing, setProcessing] = useState<string | null>(null);

  const filtered = requests.filter((r) => filter === "ALL" || r.status === filter);
  const pending = requests.filter((r) => r.status === "PENDING").length;
  const approved = requests.filter((r) => r.status === "APPROVED").length;
  const denied = requests.filter((r) => r.status === "DENIED").length;
  const tokensApproved = requests
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, r) => sum + r.amount, 0);

  const handleAction = async (id: string, action: TokenRequestStatus) => {
    setProcessing(id);
    try {
      const res = await fetch("/api/admin/token-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }
      setRequests((prev) => prev.map((r) => (r.id === id ? data.request : r)));
      toast.success(action === TokenRequestStatus.Approved ? "Approved — tokens credited" : "Denied");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Token Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and fulfill scan token requests from all users.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox label="Total" value={requests.length} icon={Clock} />
        <StatBox label="Pending" value={pending} icon={Clock} accent="amber" />
        <StatBox label="Approved" value={approved} icon={CheckCircle2} accent="emerald" />
        <StatBox label="Tokens Granted" value={tokensApproved} icon={Coins} accent="blue" />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "PENDING", "APPROVED", "DENIED"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className={filter === f ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? `All (${requests.length})`
              : f === "PENDING" ? `Pending (${pending})`
              : f === "APPROVED" ? `Approved (${approved})`
              : `Denied (${denied})`}
          </Button>
        ))}
      </div>

      {/* Requests */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No {filter !== "ALL" ? filter.toLowerCase() : ""} requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const style = STATUS_STYLES[req.status] || STATUS_STYLES["PENDING"];
            const StatusIcon = style.icon;
            const isPending = req.status === "PENDING";
            return (
              <Card key={req.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold text-foreground">+{req.amount} tokens</span>
                        <Badge variant="outline" className={style.cls}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {style.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{req.user.email}</span>
                        {req.user.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{req.user.company}</span>}
                        {req.plan && <span className="rounded bg-blue-600/15 px-1.5 py-0.5 font-medium text-blue-400">Plan: {req.plan}</span>}
                        <span>Balance: {req.user.scanTokens}</span>
                        <span>{new Date(req.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                      {req.reason && <p className="text-sm text-muted-foreground">{req.reason}</p>}
                    </div>
                    {isPending && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => handleAction(req.id, TokenRequestStatus.Approved)} disabled={processing === req.id} className="bg-emerald-600 hover:bg-emerald-700">
                          {processing === req.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAction(req.id, TokenRequestStatus.Denied)} disabled={processing === req.id} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
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
  );
}

function StatBox({ label, value, icon: Icon, accent = "default" }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent?: "default" | "amber" | "emerald" | "blue" }) {
  const cls = { default: "text-foreground", amber: "text-amber-400", emerald: "text-emerald-400", blue: "text-blue-400" }[accent];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${cls}`} />
      </div>
      <p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p>
    </Card>
  );
}
