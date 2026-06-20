import Link from "next/link";
import {
  ScanLine,
  AlertTriangle,
  Gauge,
  Plug,
  PlayCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { StatCard, PageHeader } from "@/components/dashboard/dashboard-parts";
import { RiskDonut } from "@/components/shared/risk-donut";
import { ScoreTrendChart } from "@/components/shared/score-trend";
import { computeDashboardStats, getUserScans } from "@/lib/scan-db";
import { requireUser } from "@/lib/auth-helpers";
import { getRiskStyle, truncate } from "@/lib/risk-utils";

export default async function OverviewPage() {
  const user = await requireUser();
  const scans = await getUserScans(user.id);
  const stats = computeDashboardStats(scans);
  const maxModelScans = Math.max(...stats.modelUsage.map((m) => m.scans), 1);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Overview"
        description="Monitor your AI systems' security posture and recent scan results."
        action={
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/dashboard/scan">
              <PlayCircle className="mr-2 h-4 w-4" />
              Run New Scan
            </Link>
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Scans"
          value={stats.totalScans}
          icon={ScanLine}
          accent="blue"
        />
        <StatCard
          label="Total Breaches"
          value={stats.totalBreaches}
          icon={AlertTriangle}
          accent="red"
        />
        <StatCard
          label="Avg. Score"
          value={`${stats.avgScore}/100`}
          icon={Gauge}
          accent="amber"
        />
        <StatCard
          label="API Scans"
          value={stats.apiScans}
          icon={Plug}
          accent="default"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.riskDistribution.length > 0 ? (
              <RiskDonut data={stats.riskDistribution} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No scans yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              Score Trend Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.scoreTrend.length > 0 ? (
              <ScoreTrendChart data={stats.scoreTrend} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No scans yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model Usage + Attack Success Rate */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Model Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.modelUsage.length > 0 ? (
              stats.modelUsage.map((entry) => (
                <div key={entry.model}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {entry.name}
                    </span>
                    <span className="text-muted-foreground">
                      {entry.scans} scans
                    </span>
                  </div>
                  <Progress
                    value={(entry.scans / maxModelScans) * 100}
                    className="h-2"
                  />
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No scans yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attack Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.attackSuccessRate.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 pr-4 font-medium">Breached</th>
                      <th className="pb-2 pr-4 font-medium">Defended</th>
                      <th className="pb-2 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.attackSuccessRate.map((row) => (
                      <tr key={row.category} className="border-b border-border/50">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-foreground">
                            {truncate(row.category.split("—")[0].trim(), 28)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {truncate(
                              row.category.split("—")[1]?.trim() ?? "",
                              40,
                            )}
                          </p>
                        </td>
                        <td className="py-3 pr-4 font-semibold text-red-400">
                          {row.breached}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-emerald-400">
                          {row.defended}
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-semibold text-amber-400">
                              {row.rate}%
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No scans yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <span className="text-sm text-muted-foreground">
            {scans.length} scans
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {scans.length > 0 ? (
              scans.map((scan, idx) => {
                const style = getRiskStyle(scan.riskLevel);
                return (
                  <Link
                    key={scan.id}
                    href={`/dashboard/reports/${scan.id}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-muted-foreground">
                        {scan.promptExcerpt}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          {scan.modelName}
                        </span>
                        {" • "}
                        {scan.breaches} breaches in {scan.totalTrials} trials
                        {" • "}
                        {scan.relativeTime}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className={`text-lg font-bold ${style.textClass}`}>
                          {scan.score}
                          <span className="text-xs text-muted-foreground">
                            /100
                          </span>
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bgClass} ${style.textClass} ${style.borderClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} />
                        {style.label}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {idx < scans.length - 1 && (
                      <Separator className="absolute" />
                    )}
                  </Link>
                );
              })
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No scans yet.{" "}
                <Link
                  href="/dashboard/scan"
                  className="font-medium text-blue-400 hover:underline"
                >
                  Run your first scan
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
