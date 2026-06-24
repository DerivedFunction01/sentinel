"use client";

import { useEffect, useState } from "react";
import { Brain, Target, Gavel, Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScanStatus } from "@/lib/enums";

/**
 * The three pipeline stages, in execution order. Each trial cycles through
 * all three, so the active stage rotates as steps advance.
 */
type Stage = "attacker" | "target" | "judge";

interface ScanProgressPanelProps {
  /** Total number of steps (trials × 3 stages). Can be externally controlled or simulated. */
  totalSteps?: number;
  /** Current step - if provided, uses real progress instead of simulation */
  currentStep?: number;
  /** Scan status - "running", "completed", "failed", etc. */
  scanStatus?: ScanStatus;
  /** Called when the simulated scan reaches the final step. */
  onComplete: () => void;
}

const STAGE_INFO: Record<
  Stage,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
  }
> = {
  attacker: {
    label: "Attacker generating attack",
    icon: Target,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  target: {
    label: "Target responding",
    icon: Shield,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  judge: {
    label: "Judge evaluating response",
    icon: Gavel,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
};

export function ScanProgressPanel({
  totalSteps: externalTotalSteps,
  currentStep: externalCurrentStep,
  scanStatus,
  onComplete,
}: ScanProgressPanelProps) {
  // Use external values if provided, otherwise use internal simulation
  const useExternalProgress =
    externalCurrentStep !== undefined && externalTotalSteps !== undefined;

  const [internalCurrentStep, setInternalCurrentStep] = useState(0);
  const [internalTotalSteps, setInternalTotalSteps] = useState(78); // default fallback

  const currentStep = useExternalProgress
    ? externalCurrentStep
    : internalCurrentStep;
  const totalSteps = useExternalProgress
    ? externalTotalSteps
    : internalTotalSteps;

  // Internal simulation mode when no external progress is provided
  useEffect(() => {
    if (useExternalProgress) {
      // Only consider scan complete when:
      // 1. The backend explicitly reports "completed" status, OR
      // 2. totalSteps > 0 and we've reached the final step (backup detection)
      if (
        scanStatus === ScanStatus.Completed ||
        (totalSteps > 0 && currentStep >= totalSteps)
      ) {
        const t = setTimeout(onComplete, 400);
        return () => clearTimeout(t);
      }
      return;
    }

    // Simulated progress mode
    if (currentStep >= totalSteps) {
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
    // Accelerating then easing pace — early steps slightly slower to show
    // the attacker warmup, then steady.
    const delay = currentStep < 3 ? 700 : currentStep < 10 ? 220 : 90;
    const t = setTimeout(() => setInternalCurrentStep((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [currentStep, totalSteps, onComplete, useExternalProgress, scanStatus]);

  // Set default total steps for simulation mode
  useEffect(() => {
    if (!useExternalProgress && !externalTotalSteps) {
      setInternalTotalSteps(78);
    }
  }, [useExternalProgress, externalTotalSteps]);

  // Show a loading state when no progress data has been received yet
  const noProgressData = totalSteps === 0;

  const progress = noProgressData
    ? 0
    : Math.min((currentStep / totalSteps) * 100, 100);
  const stage: Stage =
    noProgressData || currentStep >= totalSteps
      ? "judge"
      : (["attacker", "target", "judge"] as Stage[])[currentStep % 3];
  const stageInfo = STAGE_INFO[stage];
  const StageIcon = stageInfo.icon;
  const isDone = !noProgressData && currentStep >= totalSteps;

  if (noProgressData) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            {/* Spinning ring */}
            <svg
              className="absolute inset-0 h-full w-full animate-spin"
              viewBox="0 0 48 48"
            >
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="40 126"
                className="text-blue-500"
                strokeLinecap="round"
              />
            </svg>
            {/* Brain icon center */}
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <Brain className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              Agent Scan Starting
            </h3>
            <p className="text-xs text-muted-foreground">
              Initializing pipeline…
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          The scan has been launched and is starting up. Progress will appear
          here once the pipeline begins executing trials.
        </p>

        {/* Indeterminate progress bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full w-1/3 rounded-full bg-blue-600 animate-pulse"
              style={{ animationDuration: "2s" }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Starting…</span>
            <span>Preparing trials</span>
          </div>
        </div>

        {/* Waiting indicator */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">
              Waiting for pipeline to start
            </p>
            <p className="text-xs text-muted-foreground">
              Extracting seed info & generating attack templates…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          {/* Spinning ring */}
          <svg
            className="absolute inset-0 h-full w-full animate-spin"
            viewBox="0 0 48 48"
          >
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="40 126"
              className="text-blue-500"
              strokeLinecap="round"
            />
          </svg>
          {/* Brain icon center */}
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <Brain className="h-4 w-4 text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">
            Agent Scan In Progress
          </h3>
          <p className="text-xs text-muted-foreground">
            Scanning prompt 1 of 1
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        The Attacker is generating adversarial prompts, the Target is
        responding, and the Judge is evaluating each response for leaks.
      </p>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}% complete</span>
          <span>
            {currentStep} / {totalSteps} steps
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-lg border p-3",
          isDone
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-border bg-muted/30",
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isDone ? "bg-emerald-500/15" : stageInfo.bg,
          )}
        >
          {isDone ? (
            <Shield className="h-4 w-4 text-emerald-400" />
          ) : (
            <StageIcon
              className={cn("h-4 w-4 animate-pulse", stageInfo.color)}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">
            Step {currentStep} / {totalSteps}
          </p>
          <p
            className={cn(
              "text-xs",
              isDone ? "text-emerald-400" : stageInfo.color,
            )}
          >
            {isDone ? "Scan complete — generating report…" : stageInfo.label}
            {!isDone && (
              <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />
            )}
          </p>
        </div>
      </div>

      {/* Stage pipeline mini-view */}
      <div className="grid grid-cols-3 gap-2">
        {(["attacker", "target", "judge"] as Stage[]).map((s, i) => {
          const info = STAGE_INFO[s];
          const Icon = info.icon;
          const isActive = !isDone && stage === s;
          const isPast =
            isDone || i < ["attacker", "target", "judge"].indexOf(stage);
          return (
            <div
              key={s}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all",
                isActive
                  ? `${info.bg} border-current ${info.color}`
                  : isPast
                    ? "border-border bg-muted/20 opacity-60"
                    : "border-border opacity-30",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive && "animate-pulse")} />
              <span className="text-[10px] font-medium capitalize">{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
