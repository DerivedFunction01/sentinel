"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  CreditCard,
  BarChart3,
  Save,
  ShoppingBag,
  Lock,
  Coins,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Download,
  Upload,
  Database,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StatCard, PageHeader } from "@/components/dashboard/dashboard-parts";
import { toast } from "sonner";
import { TokenRequestStatus } from "@/lib/enums";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  scanTokens: number;
  role: string;
}

interface TokenRequest {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  [TokenRequestStatus.Pending]: {
    label: "Pending",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  [TokenRequestStatus.Approved]: {
    label: "Approved",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  [TokenRequestStatus.Denied]: {
    label: "Denied",
    cls: "border-red-500/30 bg-red-500/10 text-red-400",
  },
};

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  const [requestAmount, setRequestAmount] = useState(10);
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<TokenRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const scanFileRef = useRef<HTMLInputElement>(null);

  const loadUser = useCallback(async () => {
    const res = await fetch("/api/user");
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      const parts = (data.user.name || "").split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
      setCompany(data.user.company || "");
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    const res = await fetch("/api/token-requests");
    const data = await res.json();
    setRequests(data.requests || []);
    setLoadingRequests(false);
  }, []);

  // Fetch user + requests once on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      const [userRes, reqRes] = await Promise.all([
        fetch("/api/user"),
        fetch("/api/token-requests"),
      ]);
      if (!active) return;
      const userData = await userRes.json();
      const reqData = await reqRes.json();
      if (userData.user) {
        setUser(userData.user);
        const parts = (userData.user.name || "").split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
        setCompany(userData.user.company || "");
      }
      setRequests(reqData.requests || []);
      setLoadingRequests(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${firstName} ${lastName}`.trim(),
        company,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Profile updated", {
        description: "Your changes have been saved.",
      });
      loadUser();
    } else {
      toast.error("Failed to save");
    }
  };

  const handleSubmitRequest = async () => {
    if (requestAmount < 1 || requestAmount > 1000) {
      toast.error("Amount must be between 1 and 1000");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/token-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: requestAmount, reason: requestReason }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Request submitted", {
        description: `Requested ${requestAmount} scan tokens. An admin will review it.`,
      });
      setRequestReason("");
      setRequestAmount(10);
      loadRequests();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to submit request");
    }
  };

  /** Download all scans as a gzipped JSONL file. */
  const handleExportScans = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/scans/export");
      if (!res.ok) {
        toast.error("Export failed");
        setExporting(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ToolRegistry-scans-${new Date().toISOString().slice(0, 10)}.jsonl.gz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Scans exported", {
        description: "Downloaded as a gzipped JSONL file.",
      });
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  /** Import scans from a gzipped JSONL file. */
  const handleImportScans = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/scans/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      toast.success("Import complete", {
        description: `${data.imported} scan(s) imported, ${data.skipped} skipped (already exist).`,
      });
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
      if (scanFileRef.current) scanFileRef.current.value = "";
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Settings & Billing"
        description="Manage your profile information and scan tokens."
      />

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="h-4 w-4 text-blue-400" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">First Name</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Last Name</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company Name</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input value={user.email} disabled className="bg-muted/50" />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                Email cannot be changed. Contact an administrator for
                assistance.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-blue-400" />
              Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Scan Tokens
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.scanTokens} scans remaining
                </p>
              </div>
              <p className="text-2xl font-bold text-amber-400">
                {user.scanTokens}
              </p>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Need more scans?
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Choose a pricing plan to get more tokens. Requests are
                    reviewed by an admin — no credit card required during beta.
                  </p>
                  <Button
                    asChild
                    className="mt-3 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Link href="/dashboard/billing">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      View Plans & Purchase
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom request (fallback) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-amber-400" />
              Custom Token Request
            </CardTitle>
            <CardDescription>
              Need a specific amount? Submit a custom request — admins will
              review it on the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label className="text-sm font-medium">Amount</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">Reason (optional)</Label>
                <Input
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="e.g. Running a batch of 26 trials per model"
                />
              </div>
            </div>
            <Button
              onClick={handleSubmitRequest}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Request History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-blue-400" />
              Request History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No token requests yet.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto scrollbar-thin">
                {requests.map((req) => {
                  const style =
                    STATUS_STYLES[req.status] || STATUS_STYLES["PENDING"];
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          +{req.amount} tokens
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {req.reason && ` · ${req.reason}`}
                        </p>
                        {req.adminNote && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            Admin: {req.adminNote}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={style.cls}>
                        {req.status === "APPROVED" && (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {req.status === "DENIED" && (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {req.status === "PENDING" && (
                          <Clock className="mr-1 h-3 w-3" />
                        )}
                        {style.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Scan Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Tokens Remaining"
                value={user.scanTokens}
                icon={Coins}
                accent="amber"
              />
              <StatCard
                label="Dashboard Scans"
                value="—"
                icon={BarChart3}
                accent="blue"
              />
              <StatCard
                label="API Scans"
                value={0}
                icon={BarChart3}
                accent="default"
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Management — export / import scans */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-blue-400" />
              Data Management
            </CardTitle>
            <CardDescription>
              Export your scan history to a file, or import scans from a
              previously exported file. Files are gzipped JSONL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleExportScans}
                disabled={exporting}
                variant="outline"
                className="flex-1"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export All Scans
                  </>
                )}
              </Button>
              <Button
                onClick={() => scanFileRef.current?.click()}
                disabled={importing}
                variant="outline"
                className="flex-1"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Scans
                  </>
                )}
              </Button>
            </div>
            <input
              ref={scanFileRef}
              type="file"
              accept=".gz,.jsonl,.jsonl.gz,application/gzip"
              onChange={handleImportScans}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Export downloads all your scans as a gzipped JSONL file. Import
              reads the same format and creates new scan records (existing
              report IDs are skipped).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
