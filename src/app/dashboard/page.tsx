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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard, PageHeader } from "@/components/dashboard/dashboard-parts";
import { RiskDonut } from "@/components/shared/risk-donut";
import { ScoreTrendChart } from "@/components/shared/score-trend";
import { ModelAnalyticsChart } from "@/components/dashboard/model-analytics-chart";
import { AttackSuccessChart } from "@/components/dashboard/attack-success-chart";
import { computeDashboardStats, getUserScans } from "@/lib/scan-db";
import { requireUser } from "@/lib/auth-helpers";
import { getRiskStyle } from "@/lib/risk-utils";
import { ScanSummary } from "@/lib/types";

export default async function OverviewPage() {
  const user = await requireUser();
  const scans = await getUserScans(user.id);
  const stats = computeDashboardStats(scans);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-1.5rem)] overflow-hidden p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex-none">
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
      </div>

      {/* Stat cards */}
      {statCards(stats)}

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        
        {/* Left Column: Risk Distribution and Score Trend stacked */}
        <div className="flex flex-col gap-4 min-h-0">
          {riskDistribution(stats)}

          {scoreTrend(stats)}
        </div>

        {/* Right Column: Model/Success Rate Tabs and Recent Activity stacked */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Top half: Model Usage and Defense Rate */}
          {analytics(stats)}

          {/* Bottom half: Recent Activity */}
          {recentActivity(scans)}
        </div>

      </div>
    </div>
  );
}
function statCards(stats: any) {
  return <div className="flex-none grid grid-cols-2 gap-4 lg:grid-cols-4">
    <StatCard
      label="Total Scans"
      value={stats.totalScans}
      icon={ScanLine}
      accent="blue" />
    <StatCard
      label="Total Breaches"
      value={stats.totalBreaches}
      icon={AlertTriangle}
      accent="red" />
    <StatCard
      label="Avg. Score"
      value={`${stats.avgScore}/100`}
      icon={Gauge}
      accent="amber" />
    <StatCard
      label="API Scans"
      value={stats.apiScans}
      icon={Plug}
      accent="default" />
  </div>;
}

function scoreTrend(stats: any) {
  return <Card className="flex-1 min-h-0 flex flex-col">
    <CardHeader className="py-2.5 px-4 flex-none">
      <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="h-4 w-4 text-blue-400" />
        Score Trend Over Time
      </CardTitle>
    </CardHeader>
    <CardContent className="flex-1 min-h-0 p-4 pt-1">
      {stats.scoreTrend.length > 0 ? (
        <ScoreTrendChart data={stats.scoreTrend} />
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No scans yet.
        </p>
      )}
    </CardContent>
  </Card>;
}

function riskDistribution(stats: any) {
  return <Card className="flex-1 min-h-0 flex flex-col">
    <CardHeader className="py-2.5 px-4 flex-none">
      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Risk Distribution</CardTitle>
    </CardHeader>
    <CardContent className="flex-1 min-h-0 flex items-center justify-center p-2">
      {stats.riskDistribution.length > 0 ? (
        <div className="w-full h-full flex items-center justify-center scale-90">
          <RiskDonut data={stats.riskDistribution} />
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No scans yet.
        </p>
      )}
    </CardContent>
  </Card>;
}

function analytics(stats: any) {
  return <Card className="h-[45%] min-h-0 flex flex-col">
    <Tabs defaultValue="models" className="flex-1 flex flex-col min-h-0">
      <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between space-y-0 flex-none">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Analytics</CardTitle>
        <TabsList className="h-8 p-0.5 bg-muted/65 border border-white/5">
          <TabsTrigger value="models" className="text-[10px] px-2.5 py-1">Model Usage</TabsTrigger>
          <TabsTrigger value="attacks" className="text-[10px] px-2.5 py-1">Attack Success</TabsTrigger>
        </TabsList>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-4 pt-1">
        <TabsContent value="models" className="h-full mt-0">
          <ModelAnalyticsChart data={stats.modelUsage} />
        </TabsContent>
        <TabsContent value="attacks" className="h-full mt-0">
          <AttackSuccessChart data={stats.attackSuccessRate} />
        </TabsContent>
      </CardContent>
    </Tabs>
  </Card>;
}

function recentActivity(scans: ScanSummary[]) {
  return <Card className="h-[55%] min-h-0 flex flex-col">
    <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between space-y-0 flex-none">
      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</CardTitle>
      <span className="text-xs text-muted-foreground">
        {scans.length} scans
      </span>
    </CardHeader>
    <CardContent className="flex-1 min-h-0 p-0">
      <div className="h-full overflow-y-auto scrollbar-thin divide-y divide-border/20">
        {scans.length > 0 ? (
          scans.map((scan) => {
            const style = getRiskStyle(scan.riskLevel);
            return (
              <Link
                key={scan.id}
                href={`/dashboard/reports/${scan.id}`}
                className="flex items-center gap-4 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">
                    {scan.promptExcerpt}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
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
                    <p className={`text-base font-bold ${style.textClass}`}>
                      {scan.score}
                      <span className="text-[10px] text-muted-foreground">
                        /100
                      </span>
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.bgClass} ${style.textClass} ${style.borderClass}`}
                  >
                    <span className={`h-1 w-1 rounded-full ${style.dotClass}`} />
                    {style.label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
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
  </Card>;
}

