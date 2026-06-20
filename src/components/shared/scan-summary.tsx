"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCw,
  Download,
  FileText,
  Shield,
  Target,
  Swords,
  Gavel,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Scan } from "@/lib/types";
import { getRiskStyle } from "@/lib/risk-utils";

interface ScanSummaryProps {
  scan: Scan;
}

export function ScanSummary({ scan }: ScanSummaryProps) {
  const defended = scan.totalTrials - scan.breaches;
  const defenseRate =
    scan.totalTrials > 0 ? Math.round((defended / scan.totalTrials) * 100) : 0;
  const isWeak = defenseRate < 50;
  const riskStyle = getRiskStyle(scan.riskLevel);

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

  const [downloadingHarden, setDownloadingHarden] = useState(false);
  const [rescanningHarden, setRescanningHarden] = useState(false);
  const router = useRouter();

  const handleDownloadHarden = async () => {
    setDownloadingHarden(true);
    const toastId = toast.loading("Generating hardened prompt...");
    try {
      const res = await fetch(`/api/scan/${scan.id}/harden`);
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      
      const blob = new Blob([data.hardenedPrompt], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hardened-prompt-${scan.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Hardened prompt downloaded!", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate hardened prompt", { id: toastId });
    } finally {
      setDownloadingHarden(false);
    }
  };

  const handleRescanHarden = async () => {
    setRescanningHarden(true);
    const toastId = toast.loading("Generating hardened prompt...");
    try {
      const res = await fetch(`/api/scan/${scan.id}/harden`);
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();

      // Store configuration preset in localStorage
      const preset = {
        targetModels: [scan.targetModel],
        attackerModel: scan.attackerModel,
        judgeModel: scan.judgeModel,
        prompts: [
          {
            systemPrompt: data.hardenedPrompt,
            forbiddenTask: scan.forbiddenTask,
            tools: JSON.stringify(scan.tools),
            mockResponses: JSON.stringify(scan.mockToolResponses),
            judgeInstructions: scan.judgeInstructions,
          }
        ]
      };
      
      localStorage.setItem("sentinelprompt_scan_preset", JSON.stringify(preset));
      toast.success("Hardened prompt generated. Redirecting to scanner...", { id: toastId });
      router.push("/dashboard/scan");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate hardened prompt for rescan", { id: toastId });
    } finally {
      setRescanningHarden(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          className="bg-blue-600 text-white shadow-[0_4px_18px_rgba(59,130,246,0.4)] hover:bg-blue-700"
          onClick={handleRescanHarden}
          disabled={rescanningHarden || downloadingHarden}
        >
          {rescanningHarden ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="mr-2 h-4 w-4" />
          )}
          Re-scan with hardened prompt
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-blue-500/40 text-blue-400 hover:bg-blue-600/10"
          onClick={handleDownloadHarden}
          disabled={rescanningHarden || downloadingHarden}
        >
          {downloadingHarden ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Hardened prompt (.txt)
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
          asChild
        >
          <a
            href={`/api/scan/${scan.id}/export`}
            download
            className="flex items-center text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Full report (.docx)
          </a>
        </Button>
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
                  forbidden_task_1
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-red-400">
                    {scan.breachRate}% breach rate
                  </span>{" "}
                  · {scan.breaches} of {scan.totalTrials} attacks succeeded
                </p>
              </div>
              <div className="rounded-md border border-white/5 bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Target Phrase
                </p>
                <p className="mt-1 truncate text-sm text-foreground">
                  {scan.forbiddenTask.slice(0, 80)}
                  {scan.forbiddenTask.length > 80 ? "…" : ""}
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
              <div className="flex items-center justify-between rounded-md border border-white/5 bg-background/40 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <div>
                    <p className="font-mono text-xs text-foreground">
                      forbidden_task_1
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Target: {scan.forbiddenTask.slice(0, 40)}
                      {scan.forbiddenTask.length > 40 ? "…" : ""}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-red-500/30 bg-red-500/10 text-red-400"
                >
                  {scan.breaches}/{scan.totalTrials}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
