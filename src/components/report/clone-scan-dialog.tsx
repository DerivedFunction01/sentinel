"use client";

import { useState, useEffect, useMemo } from "react";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Scan } from "@/lib/types";
import {
  CostPreviewWidget,
  type CostEstimationItem,
} from "@/components/shared/cost-preview-widget";
import { ChooseModels } from "@/components/shared/choose-models";
import { TOKEN_CONSTANTS } from "@/lib/token-constants";

interface CloneScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scan: Scan;
  scanTokens: number;
  onConfirm: (params: {
    mode: "reset-model" | "reset-judge";
    targetModel: string;
    judgeModel: string;
    seedExtractorModel: string;
    attackerModel: string;
    hardenerModel: string;
  }) => Promise<void>;
}

export function CloneScanDialog({
  open,
  onOpenChange,
  scan,
  scanTokens,
  onConfirm,
}: CloneScanDialogProps) {
  const [mode, setMode] = useState<"reset-model" | "reset-judge">("reset-model");
  const [targetModel, setTargetModel] = useState(scan.targetModel);
  const [judgeModel, setJudgeModel] = useState(scan.judgeModel);
  const [seedExtractorModel, setSeedExtractorModel] = useState(
    scan.metadata?.seedExtraction?.extractorModel || "",
  );
  const [attackerModel, setAttackerModel] = useState(scan.attackerModel);
  const [hardenerModel, setHardenerModel] = useState(scan.hardenerModel);
  const [confirming, setConfirming] = useState(false);
  const [showAdvancedModels, setShowAdvancedModels] = useState(false);
  const [extractorModel, setExtractorModel] = useState("");

  useEffect(() => {
    if (open) {
      setMode("reset-model");
      setTargetModel(scan.targetModel);
      setJudgeModel(scan.judgeModel);
      setSeedExtractorModel(scan.metadata?.seedExtraction?.extractorModel || "");
      setAttackerModel(scan.attackerModel);
      setHardenerModel(scan.hardenerModel);
      setConfirming(false);
    }
  }, [open, scan]);

  const trialCount = scan.trials.length;

  const costItems = useMemo<CostEstimationItem[]>(() => {
    if (trialCount === 0) return [];

    const items: CostEstimationItem[] = [];
    const firstAttack = scan.trials[0]?.attack || "";

    if (mode === "reset-model") {
      const targetPromptParts = [scan.systemPrompt || ""];
      const targetText = targetPromptParts.concat(firstAttack).filter(Boolean).join("\n");

      items.push({
        modelId: targetModel,
        type: "prompt",
        text: targetText,
        multiplier: trialCount,
      });
      items.push({
        modelId: targetModel,
        type: "completion",
        tokensCount: TOKEN_CONSTANTS.TARGET_SIM_COMPLETION_BUFFER,
        multiplier: trialCount,
      });
    }

    const judgePromptParts = [
      scan.forbiddenTask || "",
      firstAttack,
      scan.trials[0]?.response || "",
      typeof scan.trials[0]?.transcript === "string"
        ? scan.trials[0].transcript
        : JSON.stringify(scan.trials[0]?.transcript || ""),
      typeof scan.trials[0]?.toolCalls === "string"
        ? scan.trials[0].toolCalls
        : JSON.stringify(scan.trials[0]?.toolCalls || []),
      scan.systemPrompt || "",
    ].filter(Boolean);

    items.push({
      modelId: judgeModel,
      type: "prompt",
      text: judgePromptParts.join("\n"),
      multiplier: trialCount,
    });
    items.push({
      modelId: judgeModel,
      type: "completion",
      tokensCount: TOKEN_CONSTANTS.JUDGE_EVAL_COMPLETION_BUFFER,
      multiplier: trialCount,
    });

    return items;
  }, [mode, targetModel, judgeModel, scan, trialCount]);

  const handleConfirm = async () => {
    if (mode === "reset-model" && !targetModel) {
      toast.error("Please select a target model.");
      return;
    }
    if (!judgeModel) {
      toast.error("Please select a judge model.");
      return;
    }
    setConfirming(true);
    try {
      await onConfirm({
        mode,
        targetModel,
        judgeModel,
        seedExtractorModel,
        attackerModel,
        hardenerModel,
      });
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark border-amber-500/20 bg-background text-foreground lg:min-w-4xl max-h-[90vh] flex flex-col [--background:oklch(0.16_0.018_264)] [--foreground:oklch(0.93_0.008_264)] [--card:oklch(0.21_0.02_264)] [--card-foreground:oklch(0.93_0.008_264)] [--popover:oklch(0.21_0.02_264)] [--popover-foreground:oklch(0.93_0.008_264)] [--primary:oklch(0.623_0.214_259.815)] [--primary-foreground:oklch(0.985_0_0)] [--secondary:oklch(0.28_0.02_264)] [--secondary-foreground:oklch(0.93_0.008_264)] [--muted:oklch(0.28_0.02_264)] [--muted-foreground:oklch(0.68_0.015_264)] [--accent:oklch(0.28_0.02_264)] [--accent-foreground:oklch(0.93_0.008_264)] [--border:oklch(0.3_0.015_264)] [--input:oklch(0.25_0.018_264)] [--ring:oklch(0.623_0.214_259.815)] [--destructive:oklch(0.704_0.191_22.216)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <Copy className="h-5 w-5 text-amber-400" />
            Clone Scan
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Create a new scan that reuses this scan&apos;s attacks. Pick a mode
            and the model you want to re-evaluate against.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mode
            </Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "reset-model" | "reset-judge")}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={cn(
                  "flex items-center gap-3 rounded border p-3 cursor-pointer transition-colors",
                  mode === "reset-model"
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-white/5 bg-black/20 hover:border-amber-500/20",
                )}
              >
                <RadioGroupItem value="reset-model" />
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Reset Model
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Re-run existing attacks against a new target model.
                  </p>
                </div>
              </label>
              <label
                className={cn(
                  "flex items-center gap-3 rounded border p-3 cursor-pointer transition-colors",
                  mode === "reset-judge"
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-white/5 bg-black/20 hover:border-amber-500/20",
                )}
              >
                <RadioGroupItem value="reset-judge" />
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Reset Judge
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Re-judge existing target responses using a new judge model.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <ChooseModels
            multiple={false}
            targetModel={targetModel}
            setTargetModel={mode === "reset-model" ? setTargetModel : undefined}
            attackerModel={attackerModel}
            setAttackerModel={setAttackerModel}
            judgeModel={judgeModel}
            setJudgeModel={setJudgeModel}
            hardenerModel={hardenerModel}
            setHardenerModel={setHardenerModel}
            seedExtractorModel={seedExtractorModel}
            setSeedExtractorModel={setSeedExtractorModel}
            extractorModel={extractorModel}
            setExtractorModel={setExtractorModel}
            showAdvancedModels={showAdvancedModels}
            setShowAdvancedModels={setShowAdvancedModels}
            hideAttacker={true}
          />

          {trialCount > 0 && (
            <CostPreviewWidget
              items={costItems}
              tokens={scanTokens}
              label={`${trialCount} trial${trialCount === 1 ? "" : "s"} · ${mode === "reset-model" ? "target + judge" : "judge only"}`}
            />
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
            disabled={confirming || trialCount === 0}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            {confirming && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-black" />
            )}
            Clone Scan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
