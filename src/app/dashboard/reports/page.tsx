"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, Shield, RefreshCw, Trash2, CheckSquare, Square, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/dashboard-parts";
import { getRiskStyle, truncate } from "@/lib/risk-utils";
import { getCachedScansList, setCachedScansList } from "@/lib/indexed-db";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'all' | 'selected' | string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === reports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reports.map((r) => r.id));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const toastId = toast.loading("Deleting scan report(s)...");
    try {
      let body: any = {};
      let url = "/api/scans";
      if (deleteTarget === "all") {
        body = { all: true };
      } else if (deleteTarget === "selected") {
        body = { ids: selectedIds };
      } else {
        url = `/api/scan/${deleteTarget}`;
      }

      const fetchOpts: RequestInit = {
        method: "DELETE",
      };
      if (deleteTarget === "all" || deleteTarget === "selected") {
        fetchOpts.headers = { "Content-Type": "application/json" };
        fetchOpts.body = JSON.stringify(body);
      }

      const res = await fetch(url, fetchOpts);
      if (!res.ok) {
        throw new Error("Failed to delete report(s)");
      }

      const { clearCachedReports, deleteCachedScanDetail, setCachedScansList } = await import("@/lib/indexed-db");

      if (deleteTarget === "all") {
        await clearCachedReports();
        setReports([]);
        setSelectedIds([]);
        setIsSelectMode(false);
      } else if (deleteTarget === "selected") {
        for (const id of selectedIds) {
          await deleteCachedScanDetail(id);
        }
        const updated = reports.filter((r) => !selectedIds.includes(r.id));
        setReports(updated);
        if (userId) {
          await setCachedScansList(userId, updated);
        }
        setSelectedIds([]);
        setIsSelectMode(false);
      } else {
        await deleteCachedScanDetail(deleteTarget);
        const updated = reports.filter((r) => r.id !== deleteTarget);
        setReports(updated);
        if (userId) {
          await setCachedScansList(userId, updated);
        }
        setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget));
      }

      toast.success("Successfully deleted scan report(s)", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete reports", { id: toastId });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        const userRes = await fetch("/api/user");
        const userData = await userRes.json();
        if (userData?.user?.id) {
          setUserId(userData.user.id);
          
          // Try loading from IndexedDB cache first
          const cached = await getCachedScansList(userData.user.id);
          if (cached) {
            setReports(cached);
            setLoading(false);
          }
          
          // Background sync
          await syncReports(userData.user.id, cached === null);
        }
      } catch (err) {
        console.error("Failed to load initial scans:", err);
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  async function syncReports(uid: string, forceLoadingState = false) {
    if (forceLoadingState) setLoading(true);
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      if (data.scans) {
        setReports(data.scans);
        await setCachedScansList(uid, data.scans);
      }
    } catch (err) {
      console.error("Failed to sync scans:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (!userId || refreshing) return;
    setRefreshing(true);
    await syncReports(userId);
    setRefreshing(false);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Reports"
        description="Browse and download security insights reports from your past scans."
        action={
          <div className="flex items-center gap-2">
            {reports.length > 0 && (
              <>
                {isSelectMode ? (
                  <>
                    <Button
                      onClick={toggleSelectAll}
                      variant="outline"
                      className="border-white/10 text-slate-200"
                    >
                      {selectedIds.length === reports.length ? "Deselect All" : "Select All"}
                    </Button>
                    <Button
                      onClick={() => {
                        setDeleteTarget("selected");
                        setDeleteDialogOpen(true);
                      }}
                      disabled={selectedIds.length === 0}
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected ({selectedIds.length})
                    </Button>
                    <Button
                      onClick={() => {
                        setIsSelectMode(false);
                        setSelectedIds([]);
                      }}
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => setIsSelectMode(true)}
                      variant="outline"
                      className="border-white/10 text-muted-foreground hover:text-foreground"
                    >
                      Select Reports
                    </Button>
                    <Button
                      onClick={() => {
                        setDeleteTarget("all");
                        setDeleteDialogOpen(true);
                      }}
                      variant="outline"
                      className="border-red-500/20 text-red-400 hover:bg-red-950/20"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete All
                    </Button>
                  </>
                )}
                <div className="h-6 w-px bg-white/10 mx-1" />
              </>
            )}
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing || loading}
              className="border-white/10 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/dashboard/scan">Run New Scan</Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => {
              const style = getRiskStyle(report.riskLevel);
              const isSelected = selectedIds.includes(report.id);

              const CardContentElement = (
                <Card className={`h-full transition-all relative ${
                  isSelectMode
                    ? isSelected
                      ? "border-blue-500 bg-blue-950/10 shadow-md"
                      : "hover:border-slate-700/60"
                    : "hover:border-blue-500/40 hover:shadow-lg"
                }`}>
                  <div className="flex flex-row items-start justify-between gap-2 border-b border-border p-4 pb-3">
                    <div className="flex items-center gap-2">
                      {isSelectMode ? (
                        <div className="mr-1">
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-blue-500 animate-in zoom-in-50" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-500 hover:text-slate-400" />
                          )}
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/15">
                          <FileText className="h-4 w-4 text-blue-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Scan #{report.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {report.issuedDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.bgClass} ${style.textClass} ${style.borderClass}`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${style.dotClass}`}
                        />
                        {style.label}
                      </span>

                      {!isSelectMode && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteTarget(report.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          title="Delete report"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <CardContent className="space-y-3 p-4">
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {truncate(report.promptExcerpt, 80)}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {report.modelName}
                      </span>
                      <span className="text-muted-foreground">
                        {report.relativeTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <div>
                        <p className={`text-2xl font-bold ${style.textClass}`}>
                          {report.score}
                          <span className="text-xs text-muted-foreground">
                            /100
                          </span>
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>
                          <span className="font-semibold text-red-400">
                            {report.breaches}
                          </span>{" "}
                          breaches
                        </p>
                        <p>{report.totalTrials} trials</p>
                      </div>
                    </div>
                    {!isSelectMode && (
                      <div className="flex items-center gap-1 text-xs font-medium text-blue-400">
                        View report
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );

              if (isSelectMode) {
                return (
                  <div key={report.id} onClick={() => toggleSelect(report.id)}>
                    {CardContentElement}
                  </div>
                );
              }

              return (
                <Link key={report.id} href={`/dashboard/reports/${report.id}`}>
                  {CardContentElement}
                </Link>
              );
            })}
          </div>

          {reports.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">
                  No reports yet
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run your first scan to generate a security insights report.
                </p>
                <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Link href="/dashboard/scan">Run New Scan</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="border-red-500/20 bg-slate-900 text-slate-100">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-400">
                  <Trash2 className="h-5 w-5 text-red-400" />
                  {deleteTarget === "all"
                    ? "Delete All Scan Reports"
                    : deleteTarget === "selected"
                    ? "Delete Selected Scan Reports"
                    : "Delete Scan Report"}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {deleteTarget === "all"
                    ? "Are you sure you want to delete ALL scan reports? This action is permanent and cannot be undone."
                    : deleteTarget === "selected"
                    ? `Are you sure you want to delete the ${selectedIds.length} selected scan report(s)? This action is permanent and cannot be undone.`
                    : `Are you sure you want to delete Scan #${deleteTarget}? This action is permanent and cannot be undone.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setDeleteTarget(null);
                  }}
                  disabled={deleting}
                  className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
