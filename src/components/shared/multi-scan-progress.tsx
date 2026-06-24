"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { formatModelName, ScanStatus } from "@/lib/enums";

interface ScanTile {
  reportId: string;
  targetModel: string;
  promptIndex: number;
  status: ScanStatus;
  currentStep: number;
  totalSteps: number;
  score: number;
  breaches: number;
  totalTrials: number;
  breachRate: number;
  summary: string;
  summaryDetail: string;
}

interface BatchProgress {
  batchId: string;
  status: string;
  totalScans: number;
  completedScans: number;
  failedScans: number;
  runningScans: number;
  overallProgress: number;
  scans: ScanTile[];
}

interface MultiScanProgressProps {
  batchId: string | null;
  initialScans: Array<{
    reportId: string;
    targetModel: string;
    promptIndex: number;
  }>;
  onComplete: () => void;
}

export function MultiScanProgress({
  batchId,
  initialScans,
  onComplete,
}: MultiScanProgressProps) {
  const [data, setData] = useState<BatchProgress | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Poll batch progress
  useEffect(() => {
    if (!batchId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/progress/batch/${batchId}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);

          // Check if all complete
          if (
            json.status === "completed" ||
            json.status === "completed_with_failures"
          ) {
            setTimeout(onComplete, 1200);
          }
        }
      } catch {
        /* ignore */
      }
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [batchId, onComplete]);

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  const selected = data.scans[selectedIdx];
  const allDone =
    data.status === "completed" || data.status === "completed_with_failures";

  const statusBadge = (status: string) => {
    if (status === ScanStatus.Completed)
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Done
        </Badge>
      );
    if (status === ScanStatus.Failed)
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30">
          <XCircle className="mr-1 h-3 w-3" /> Failed
        </Badge>
      );
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Running
      </Badge>
    );
  };

  return (
    <Card className={allDone ? "border-emerald-500/30" : "border-blue-500/30"}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>
            Batch Scan Progress
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {data.completedScans}/{data.totalScans} complete
            </span>
          </span>
          {allDone && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={onComplete}
            >
              View Reports <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress bar */}
        <div className="space-y-1.5">
          <Progress value={data.overallProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {data.overallProgress}% complete
          </p>
        </div>

        {/* Scan tiles grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.scans.map((scan, idx) => {
            const isSelected = idx === selectedIdx;
            const isComplete = scan.status === ScanStatus.Completed;
            const isFailed = scan.status === ScanStatus.Failed;
            const scanProgress =
              scan.totalSteps > 0
                ? Math.round((scan.currentStep / scan.totalSteps) * 100)
                : 0;

            return (
              <button
                key={scan.reportId}
                onClick={() => setSelectedIdx(idx)}
                className={`rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                  isSelected ? "border-blue-500 bg-blue-500/5" : "border-border"
                } ${isComplete ? "border-emerald-500/40" : ""} ${
                  isFailed ? "border-red-500/40" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">
                    {formatModelName(scan.targetModel)}
                  </span>
                  {statusBadge(scan.status)}
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Prompt {scan.promptIndex + 1}
                </p>
                {isComplete ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400">
                        {scan.score}/100
                      </span>
                      <span className="text-red-400">
                        {scan.breaches} breached
                      </span>
                    </div>
                    <Progress value={scanProgress} className="h-1" />
                  </div>
                ) : isFailed ? (
                  <p className="text-xs text-red-400">Pipeline error</p>
                ) : (
                  <div className="space-y-1">
                    <Progress value={scanProgress} className="h-1" />
                    <p className="text-[10px] text-muted-foreground">
                      {scan.currentStep}/{scan.totalSteps} steps
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected scan detail */}
        {selected && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {formatModelName(selected.targetModel)} — Prompt{" "}
                  {selected.promptIndex + 1}
                </h4>
                {selected.status === ScanStatus.Completed && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      window.open(
                        `/dashboard/reports/${selected.reportId}`,
                        "_blank",
                      )
                    }
                  >
                    <ExternalLink className="mr-1 h-3 w-3" /> Open Report
                  </Button>
                )}
              </div>

              {selected.status === ScanStatus.Completed ? (
                <div className="space-y-2">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Score</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        {selected.score}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Breach Rate
                      </p>
                      <p className="text-lg font-semibold text-red-400">
                        {selected.breachRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Trials</p>
                      <p className="text-lg font-semibold">
                        {selected.totalTrials}
                      </p>
                    </div>
                  </div>
                  {selected.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {selected.summary}
                    </p>
                  )}
                </div>
              ) : selected.status === ScanStatus.Failed ? (
                <p className="text-xs text-red-400">
                  {selected.summaryDetail || "Pipeline execution failed."}
                </p>
              ) : (
                <div className="space-y-2">
                  <Progress
                    value={
                      selected.totalSteps > 0
                        ? Math.round(
                            (selected.currentStep / selected.totalSteps) * 100,
                          )
                        : 0
                    }
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {selected.currentStep}/{selected.totalSteps} steps completed
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
