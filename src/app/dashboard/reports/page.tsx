"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, Shield, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/dashboard-parts";
import { getRiskStyle, truncate } from "@/lib/risk-utils";
import { getCachedScansList, setCachedScansList } from "@/lib/indexed-db";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>("");

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
              return (
                <Link key={report.id} href={`/dashboard/reports/${report.id}`}>
                  <Card className="h-full transition-all hover:border-blue-500/40 hover:shadow-lg">
                    <div className="flex flex-row items-start justify-between gap-2 border-b border-border p-4 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/15">
                          <FileText className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Scan #{report.id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {report.issuedDate}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.bgClass} ${style.textClass} ${style.borderClass}`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${style.dotClass}`}
                        />
                        {style.label}
                      </span>
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
                      <div className="flex items-center gap-1 text-xs font-medium text-blue-400">
                        View report
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
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
        </>
      )}
    </div>
  );
}
