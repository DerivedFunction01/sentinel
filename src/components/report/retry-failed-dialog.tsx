"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TrialVerdict } from "@/lib/enums";
import type { Trial, Scan } from "@/lib/types";
import {
  CostPreviewWidget,
  type CostEstimationItem,
} from "@/components/shared/cost-preview-widget";
import { TOKEN_CONSTANTS } from "@/lib/token-constants";

interface RetryFailedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scan: Scan;
  scanTokens: number;
  onConfirm: (trialNumbers: number[]) => Promise<void>;
}

export function RetryFailedDialog({
  open,
  onOpenChange,
  scan,
  scanTokens,
  onConfirm,
}: RetryFailedDialogProps) {
  const [selectedTrials, setSelectedTrials] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [templateTokens, setTemplateTokens] = useState<Record<
    string,
    number
  > | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedTrials([]);
      setConfirming(false);

      fetch("/api/scan/template-tokens")
        .then((r) => r.json())
        .then(setTemplateTokens)
        .catch(() => {});
    }
  }, [open]);

  const unknownTrials = useMemo(
    () =>
      scan.trials.filter(
        (t: Trial) => t.verdict === TrialVerdict.Unknown && t.attack?.trim(),
      ),
    [scan.trials],
  );

  const toggleTrial = (num: number) => {
    setSelectedTrials((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num],
    );
  };

  const selectAllTrials = () =>
    setSelectedTrials(unknownTrials.map((t) => t.number));
  const deselectAllTrials = () => setSelectedTrials([]);

  const handleConfirm = async () => {
    if (selectedTrials.length === 0) {
      toast.error("No trials selected.");
      return;
    }
    setConfirming(true);
    try {
      await onConfirm(selectedTrials);
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  };

  const judgeModelId = scan.judgeModel;
  const targetModelId = scan.targetModel;
  const overhead =
    templateTokens?.judgeReEvalOverhead ??
    TOKEN_CONSTANTS.REEVAL_SYSTEM_PROMPT_OVERHEAD;
  const judgeCompletionBuffer =
    templateTokens?.reEvalCompletionBuffer ??
    TOKEN_CONSTANTS.REEVAL_COMPLETION_BUFFER;
  const targetCompletionBuffer =
    templateTokens?.targetCompletionBuffer ??
    TOKEN_CONSTANTS.TARGET_SIM_COMPLETION_BUFFER;

  const selectedUnknownTrials = useMemo(
    () =>
      selectedTrials
        .map((num) => unknownTrials.find((t) => t.number === num))
        .filter((t): t is Trial => !!t),
    [selectedTrials, unknownTrials],
  );

  const costItems = useMemo<CostEstimationItem[]>(() => {
    if (selectedTrials.length === 0) return [];

    const items: CostEstimationItem[] = [];

    const trialsNeedingTarget = selectedUnknownTrials.filter(
      (t) => !t.response?.trim(),
    );

    for (const trial of trialsNeedingTarget) {
      const promptText = [scan.systemPrompt || "", trial.attack || ""]
        .filter(Boolean)
        .join("\n");
      items.push({
        modelId: targetModelId,
        type: "prompt",
        text: promptText,
      });
      items.push({
        modelId: targetModelId,
        type: "completion",
        tokensCount: targetCompletionBuffer,
      });
    }

    for (const trial of selectedUnknownTrials) {
      const transcriptStr =
        typeof trial.transcript === "string"
          ? trial.transcript
          : JSON.stringify(trial.transcript || "");
      const toolCallsStr =
        typeof trial.toolCalls === "string"
          ? trial.toolCalls
          : JSON.stringify(trial.toolCalls || []);

      const dynamicContent = [
        scan.forbiddenTask || "",
        trial.attack || "",
        trial.response || "",
        transcriptStr,
        toolCallsStr,
        scan.systemPrompt || "",
      ]
        .filter(Boolean)
        .join("\n");

      items.push({
        modelId: judgeModelId,
        type: "prompt",
        text: dynamicContent,
        additionalTokens: overhead,
      });
      items.push({
        modelId: judgeModelId,
        type: "completion",
        tokensCount: judgeCompletionBuffer,
      });
    }

    return items;
  }, [
    selectedUnknownTrials,
    scan,
    targetModelId,
    targetCompletionBuffer,
    judgeModelId,
    overhead,
    judgeCompletionBuffer,
  ]);

  const trialsNeedingTargetCount = selectedUnknownTrials.filter(
    (t) => !t.response?.trim(),
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-500/20 bg-slate-900 text-slate-100 lg:min-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <RefreshCw className="h-5 w-5 text-amber-400" />
            Retry Unknown Trials
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Select which indeterminate trials to retry. Each retry re-runs the
            target model (if no response exists) and re-evaluates the judge
            verdict.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Unknown Trials ({unknownTrials.length})
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAllTrials}
                className="text-xs text-amber-400 hover:underline"
              >
                All ({unknownTrials.length})
              </button>
              <span className="text-xs text-slate-600">·</span>
              <button
                type="button"
                onClick={deselectAllTrials}
                className="text-xs text-slate-400 hover:underline"
              >
                None
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {unknownTrials.length === 0 ? (
              <p className="text-sm text-slate-400">
                No unknown trials available for retry.
              </p>
            ) : (
              unknownTrials.map((trial) => {
                const checked = selectedTrials.includes(trial.number);
                return (
                  <label
                    key={trial.number}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors",
                      checked
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-black/20 border-white/5 hover:border-amber-500/20",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleTrial(trial.number)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-amber-400">
                          Trial #{trial.number}
                        </span>
                        <span className="text-[10px] rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 uppercase tracking-wide">
                          Unknown
                        </span>
                        {!trial.response?.trim() && (
                          <span className="text-[10px] rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 uppercase tracking-wide">
                            No response
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap line-clamp-2 break-all">
                        {trial.attack}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {selectedTrials.length > 0 && (
            <div className="shrink-0">
              <CostPreviewWidget
                items={costItems}
                tokens={scanTokens}
                label={`${selectedTrials.length} trial${selectedTrials.length === 1 ? "" : "s"} selected · ${trialsNeedingTargetCount} need target re-run · all need judge re-evaluation`}
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 flex gap-2 justify-end shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirming || selectedTrials.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            {confirming && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-black" />
            )}
            Retry {selectedTrials.length}{" "}
            {selectedTrials.length === 1 ? "Trial" : "Trials"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
