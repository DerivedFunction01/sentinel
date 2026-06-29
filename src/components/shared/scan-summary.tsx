"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCw,
  Download,
  Shield,
  Target,
  Swords,
  Gavel,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Scan } from "@/lib/types";
import { getRiskStyle } from "@/lib/risk-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScanSummaryProps {
  scan: Scan;
  activeHardenedPrompt?: {
    modelId: string;
    modelName: string;
    prompt: string;
  } | null;
}

export function ScanSummary({ scan, activeHardenedPrompt }: ScanSummaryProps) {
  const defended = scan.totalTrials - scan.breaches;
  const defenseRate =
    scan.totalTrials > 0 ? Math.round((defended / scan.totalTrials) * 100) : 0;
  const isWeak = defenseRate < 50;
  const riskStyle = getRiskStyle(scan.riskLevel);

  const metadata = useMemo(() => {
    if (!scan.metadata) return null;
    if (typeof scan.metadata === "object") return scan.metadata as any;
    try {
      return JSON.parse(scan.metadata);
    } catch {
      return null;
    }
  }, [scan.metadata]);

  const things = useMemo(() => {
    return metadata?.seedExtraction?.things || [];
  }, [metadata]);

  const trials = useMemo(() => {
    if (!scan.trials) return [];
    try {
      return typeof scan.trials === "string" ? JSON.parse(scan.trials) : scan.trials;
    } catch {
      return [];
    }
  }, [scan.trials]);

  const thingsWithStats = useMemo(() => {
    if (things.length === 0) {
      return [{
        name: "Confidential Info",
        description: scan.forbiddenTask,
        breaches: scan.breaches,
        totalTrials: scan.totalTrials,
        breachRate: scan.breachRate,
      }];
    }

    const list = things.map((thing: any) => {
      const slug = thing.thingName
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "_")
        .trim();
      const thingTrials = trials.filter((t: any) => t.taskTag === slug || t.targetThing === thing.thingName);
      const thingBreaches = thingTrials.filter((t: any) => t.verdict === "BREACHED" || t.verdict === "Breached").length;
      const thingTotal = thingTrials.length || 1;
      const rate = Math.round((thingBreaches / thingTotal) * 100);

      return {
        name: thing.thingName,
        description: thing.forbiddenTask || thing.thingDescription,
        breaches: thingBreaches,
        totalTrials: thingTotal,
        breachRate: rate,
      };
    });

    return list.sort((a, b) => b.breachRate - a.breachRate);
  }, [things, trials, scan.forbiddenTask, scan.breachRate, scan.breaches, scan.totalTrials]);

  const topVulnerability = thingsWithStats[0];

  // Circular gauge calculation
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (defenseRate / 100) * circumference;
  const gaugeColor = isWeak ? "#f87171" : "#34d399";

  const postureMessage = isWeak
    ? "Weak posture — your prompt is vulnerable. Review breached trials and harden your instructions."
    : defenseRate >= 80
      ? "Strong posture — your prompt defends well against adversarial attacks."
      : "Moderate posture — some vulnerabilities detected. Review breached trials.";

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedExportPrompts, setSelectedExportPrompts] = useState<string[]>(
    [],
  );
  const router = useRouter();

  // Initialize selected prompts when dialog opens
  useEffect(() => {
    if (exportDialogOpen && scan.hardenedPrompts) {
      setSelectedExportPrompts(scan.hardenedPrompts.map((hp) => hp.modelId));
    }
  }, [exportDialogOpen, scan.hardenedPrompts]);

  const handleDownloadReportClick = (e: React.MouseEvent) => {
    if (scan.hardenedPrompts && scan.hardenedPrompts.length > 1) {
      e.preventDefault();
      setExportDialogOpen(true);
    }
  };

  const executeExport = () => {
    const query =
      selectedExportPrompts.length > 0
        ? `?prompts=${selectedExportPrompts.map(encodeURIComponent).join(",")}`
        : "";
    window.location.href = `/api/scan/${scan.id}/export${query}`;
    setExportDialogOpen(false);
  };

  const handleDownloadHarden = () => {
    if (!activeHardenedPrompt?.prompt) {
      toast.error("No hardened prompt selected.");
      return;
    }

    const blob = new Blob([activeHardenedPrompt.prompt], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hardened-prompt-${activeHardenedPrompt.modelId.replace(/\//g, "-")}-${scan.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Hardened prompt downloaded!");
  };

  const handleRescanHarden = () => {
    if (!activeHardenedPrompt?.prompt) {
      toast.error("No hardened prompt selected.");
      return;
    }

    const preset = {
      targetModels: [scan.targetModel],
      attackerModel: scan.attackerModel,
      judgeModel: scan.judgeModel,
      hardenerModel: scan.hardenerModel,
      prompts: [
        {
          systemPrompt: activeHardenedPrompt.prompt,
          forbiddenTask: scan.forbiddenTask,
          tools: JSON.stringify(scan.tools),
          mockResponses: JSON.stringify(scan.mockToolResponses),
          judgeInstructions: scan.judgeInstructions,
        },
      ],
    };

    localStorage.setItem("ToolRegistry_scan_preset", JSON.stringify(preset));
    toast.success("Hardened prompt applied. Redirecting to scanner...");
    router.push("/dashboard/scan");
  };

  const hasPrompt = !!activeHardenedPrompt;

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-card/20 p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {hasPrompt
              ? `Active Version: ${activeHardenedPrompt.modelName}`
              : "Harden prompt below to enable actions"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-blue-600 text-white shadow-[0_4px_18px_rgba(59,130,246,0.4)] hover:bg-blue-700 disabled:opacity-50"
            onClick={handleRescanHarden}
            disabled={!hasPrompt}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Re-scan with hardened prompt
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-500/40 text-blue-400 hover:bg-blue-600/10 disabled:opacity-50"
            onClick={handleDownloadHarden}
            disabled={!hasPrompt}
          >
            <Download className="mr-2 h-4 w-4" />
            Hardened prompt (.txt)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={handleDownloadReportClick}
            asChild={!(scan.hardenedPrompts && scan.hardenedPrompts.length > 1)}
          >
            {scan.hardenedPrompts && scan.hardenedPrompts.length > 1 ? (
              <span className="flex items-center text-white cursor-pointer">
                <Download className="mr-2 h-4 w-4" />
                Full report (.docx)
              </span>
            ) : (
              <a
                href={`/api/scan/${scan.id}/export`}
                download
                className="flex items-center text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Full report (.docx)
              </a>
            )}
          </Button>
        </div>
      </div>

      {/* Summary cards grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Defense Rate */}
        <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <Shield className="h-4 w-4" />
              Defense Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-5">
            {/* Circular gauge */}
            <div
              className="relative shrink-0"
              style={{ width: 128, height: 128 }}
            >
              <svg width={128} height={128} className="-rotate-90">
                <circle
                  cx={64}
                  cy={64}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={10}
                />
                <circle
                  cx={64}
                  cy={64}
                  r={radius}
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  style={{ transition: "stroke-dashoffset 800ms ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-3xl font-bold"
                  style={{ color: gaugeColor }}
                >
                  {defenseRate}%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  defended
                </span>
              </div>
            </div>
            {/* Counts */}
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Defended
                </span>
                <span className="font-mono font-medium text-emerald-400">
                  {defended}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  Breached
                </span>
                <span className="font-mono font-medium text-red-400">
                  {scan.breaches}
                </span>
              </div>
              <div className="mt-2 border-t border-white/5 pt-2">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {postureMessage}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Vulnerability */}
        <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <Target className="h-4 w-4" />
              Top Vulnerability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="font-mono text-sm text-foreground">
                  {topVulnerability?.name || "Confidential Info"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-red-400">
                    {topVulnerability?.breachRate || 0}% breach rate
                  </span>{" "}
                  · {topVulnerability?.breaches || 0} of {topVulnerability?.totalTrials || 0} attacks succeeded
                </p>
              </div>
              <div className="rounded-md border border-white/5 bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Target Phrase
                </p>
                <p className="mt-1 truncate text-sm text-foreground">
                  {topVulnerability?.description ? (
                    <>
                      {topVulnerability.description.slice(0, 80)}
                      {topVulnerability.description.length > 80 ? "…" : ""}
                    </>
                  ) : (
                    scan.forbiddenTask.slice(0, 80)
                  )}
                </p>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                This is the weakest area of your prompt. Review the breached
                trials below and add explicit guardrails against this phrase.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Agent Models Used */}
        <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <Swords className="h-4 w-4" />
              Agent Models Used
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Swords className="h-3.5 w-3.5 text-red-400" />
                Attacker
              </span>
              <span
                className="max-w-[55%] truncate text-right font-mono text-xs text-foreground"
                title={scan.attackerModel}
              >
                {scan.attackerModelName || scan.attackerModel || (
                  <span className="italic text-muted-foreground">
                    anonymous
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gavel className="h-3.5 w-3.5 text-emerald-400" />
                Judge
              </span>
              <span
                className="max-w-[55%] truncate text-right font-mono text-xs text-foreground"
                title={scan.judgeModel}
              >
                {scan.judgeModelName || scan.judgeModel || (
                  <span className="italic text-muted-foreground">
                    anonymous
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Hardener
              </span>
              <span
                className="max-w-[55%] truncate text-right font-mono text-xs text-foreground"
                title={scan.hardenerModel}
              >
                {scan.hardenerModelName || scan.hardenerModel || (
                  <span className="italic text-muted-foreground">
                    anonymous
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-blue-400" />
                Target
              </span>
              <span
                className="max-w-[55%] truncate text-right font-mono text-xs text-foreground"
                title={scan.targetModel}
              >
                {scan.modelName || scan.targetModel}
              </span>
            </div>
            {scan.apiCost > 0 && (
              <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">API Cost</span>
                <span className="font-mono text-xs text-amber-400">
                  ${scan.apiCost.toFixed(4)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Adversarial Tasks */}
        <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Adversarial Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {thingsWithStats.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-md border border-white/5 bg-background/40 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${item.breachRate > 0 ? "text-red-400" : "text-emerald-400"}`} />
                    <div>
                      <p className="font-mono text-xs text-foreground">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Target: {item.description.slice(0, 40)}
                        {item.description.length > 40 ? "…" : ""}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={item.breachRate > 0 ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}
                  >
                    {item.breaches}/{item.totalTrials}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="dark max-w-md border-border bg-slate-900 text-slate-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-400" />
              Export Report Options
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Select which hardened prompt versions to include in your document.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Hardened Prompt Versions
            </span>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {scan.hardenedPrompts?.map((hp) => {
                const checked = selectedExportPrompts.includes(hp.modelId);
                return (
                  <label
                    key={hp.modelId}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-950/60 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) {
                          setSelectedExportPrompts(
                            selectedExportPrompts.filter(
                              (id) => id !== hp.modelId,
                            ),
                          );
                        } else {
                          setSelectedExportPrompts([
                            ...selectedExportPrompts,
                            hp.modelId,
                          ]);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-200">
                        {hp.modelName}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {hp.modelId}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-800/80 pt-4 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExportDialogOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={executeExport}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Download Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
