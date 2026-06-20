"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  ShieldCheck,
  Wrench,
  Code2,
  Gavel,
  Ban,
  Swords,
  Filter,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { TrialCard } from "@/components/shared/trial-card";
import { toast } from "sonner";
import { TrialFilter, TrialVerdict } from "@/lib/enums";
import type { Scan } from "@/lib/types";
import { ScanSummary } from "@/components/shared/scan-summary";
import { CodeHighlight } from "@/components/shared/code-highlight";

interface ReportViewProps {
  scan: Scan;
}

export function ReportView({ scan }: ReportViewProps) {
  const [filter, setFilter] = useState<TrialFilter>(TrialFilter.All);

  const filteredTrials = scan.trials.filter((t) => {
    if (filter === TrialFilter.All) return true;
    if (filter === TrialFilter.Breached) return t.verdict === TrialVerdict.Breached;
    return t.verdict === TrialVerdict.Defended;
  });

  const breachedCount = scan.trials.filter(
    (t) => t.verdict === TrialVerdict.Breached,
  ).length;
  const defendedCount = scan.totalTrials - breachedCount;

  return (
    <div className="min-h-screen bg-background">
      {/* Report header bar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/reports">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                Security Insights Report
              </p>
              <p className="text-xs text-muted-foreground">
                Scan #{scan.id} · {scan.issuedDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden border-amber-500/30 text-amber-400 sm:inline-flex">
              CONFIDENTIAL
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
              asChild
            >
              <a href={`/api/scan/${scan.id}/export`} download className="flex items-center text-slate-200 hover:text-white">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── Summary hero ── */}
        <section id="summary" className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
            Report · Pentest Scan
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {scan.summary}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {scan.summaryDetail}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6">
              <ScoreGauge score={scan.score} riskLevel={scan.riskLevel} />
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Target Model", value: scan.modelName },
              { label: "Total Trials", value: scan.totalTrials },
              { label: "Breaches", value: scan.breaches },
              { label: "Breach Rate", value: `${scan.breachRate}%` },
            ].map((stat) => (
              <Card key={stat.label} className="p-4">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {stat.value}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* ── Scan Summary (defense rate, top vulnerability, agent models) ── */}
        <ScanSummary scan={scan} />

        <Separator />

        {/* ── 01 Scan Configuration ── */}
        <section id="scan-configuration" className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              01 — Scan Configuration
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              What the assistant was asked to protect.
            </p>
          </div>

          {/* System Prompt */}
          <ConfigBlock label="System Prompt" icon={ShieldCheck}>
            <CodeHighlight code={scan.systemPrompt} language="plaintext" className="!p-4" />
          </ConfigBlock>

          {/* Tools (NEW) */}
          <ConfigBlock
            label="Tools"
            icon={Wrench}
            badge="NEW"
            description="Appended as the tools payload on every Target call via OpenRouter."
          >
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55">
                  <span className="flex items-center gap-2">
                    <Code2 className="h-3.5 w-3.5 text-blue-400" />
                    {scan.tools.length} tool definitions
                  </span>
                  <span className="text-xs text-muted-foreground">Click to expand</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CodeHighlight
                  code={JSON.stringify(scan.tools, null, 2)}
                  language="json"
                  className="mt-3 !p-4 max-h-96 overflow-auto"
                />
              </CollapsibleContent>
            </Collapsible>
          </ConfigBlock>

          {/* Mock Tool Responses (NEW) */}
          <ConfigBlock
            label="Mock Tool Responses"
            icon={Code2}
            badge="NEW"
            description="Returned to the Target when it calls a tool, so the adversarial loop continues realistically."
          >
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55">
                  <span className="flex items-center gap-2">
                    <Code2 className="h-3.5 w-3.5 text-purple-400" />
                    {Object.keys(scan.mockToolResponses).length} mock responses
                  </span>
                  <span className="text-xs text-muted-foreground">Click to expand</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CodeHighlight
                  code={JSON.stringify(scan.mockToolResponses, null, 2)}
                  language="json"
                  className="mt-3 !p-4 max-h-96 overflow-auto"
                />
              </CollapsibleContent>
            </Collapsible>
          </ConfigBlock>

          {/* Forbidden Task */}
          <ConfigBlock label="Forbidden Task" icon={Ban}>
            <CodeHighlight code={scan.forbiddenTask} language="plaintext" className="!p-4" />
          </ConfigBlock>

          {/* Judge Instructions (NEW) */}
          <ConfigBlock
            label="Judge Instructions"
            icon={Gavel}
            badge="NEW"
            description="Tells the Judge exactly how to evaluate each response — separate from the forbidden task."
          >
            <CodeHighlight code={scan.judgeInstructions} language="plaintext" className="!p-4" />
          </ConfigBlock>

          {/* Adversarial Coverage */}
          <ConfigBlock label="Adversarial Coverage" icon={Swords}>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  forbidden_task_1
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  STEM-adjacent, math, latex, json, code tasks…
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-red-500/30 text-red-400"
              >
                {scan.breaches} / {scan.totalTrials} breached
              </Badge>
            </div>
          </ConfigBlock>
        </section>

        <Separator />

        {/* ── 02 Trial-by-Trial Breakdown ── */}
        <section id="trial-breakdown" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                02 — Trial-by-Trial Breakdown
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {scan.totalTrials} Trials
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {breachedCount} Breached
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {defendedCount} Defended
                </span>
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {Object.values(TrialFilter).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                className={filter === f ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"}
                onClick={() => setFilter(f)}
              >
                {f === TrialFilter.All
                  ? `All (${scan.totalTrials})`
                  : f === TrialFilter.Breached
                    ? `Breached (${breachedCount})`
                    : `Defended (${defendedCount})`}
              </Button>
            ))}
          </div>

          {/* Trial cards */}
          <div className="space-y-3">
            {filteredTrials.map((trial) => (
              <TrialCard key={trial.number} trial={trial} />
            ))}
          </div>

          {filteredTrials.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No trials match this filter.
              </CardContent>
            </Card>
          )}
        </section>

        {/* Report footer */}
        <Separator />
        <div className="flex items-center justify-between pb-8 text-xs text-muted-foreground">
          <span>
            SentinelPrompt · Security Insights Report · Confidential
          </span>
          <span>Page 1 of 27</span>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function ConfigBlock({
  label,
  icon: Icon,
  badge,
  description,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          {badge && (
            <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
