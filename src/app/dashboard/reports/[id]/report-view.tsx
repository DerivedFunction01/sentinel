"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Shield,
  Wrench,
  Code2,
  Gavel,
  Ban,
  Swords,
  Filter,
  Sparkles,
  Layers,
  HelpCircle,
  ChevronDown,
  Zap,
  RefreshCw,
  Loader2,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { TrialCard } from "@/components/shared/trial-card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { TrialFilter, TrialVerdict, formatModelName } from "@/lib/enums";
import { Scan, Trial, HardeningTrace } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import { ScanSummary } from "@/components/shared/scan-summary";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { GranularityPickerDialog } from "@/components/shared/granularity-picker-dialog";
import { ExtractionTraceDialog } from "@/components/shared/extraction-trace-dialog";
import { ModelSelector } from "@/components/shared/model-selector";
import { DEFAULT_MODEL } from "@/lib/model-utils";
import { ToolManagerDialog } from "@/components/shared/tool_editor/tool-manager-dialog";

interface ReportViewProps {
  scan: Scan;
  refreshing?: boolean;
  onRefresh?: () => Promise<void>;
}

export function ReportView({ scan, refreshing, onRefresh }: ReportViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<TrialFilter>(TrialFilter.All);
  const [toolManagerOpen, setToolManagerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isAutoReevaluating, setIsAutoReevaluating] = useState(false);
  const [proposalsPreview, setProposalsPreview] = useState<any[] | null>(null);
  const [deselectedProposals, setDeselectedProposals] = useState<number[]>([]);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const handleAutoReevaluate = async () => {
    setIsAutoReevaluating(true);
    const toastId = toast.loading("Auto re-evaluating all breached trials...");
    try {
      const res = await fetch(`/api/scan/${scan.id}/auto-re-evaluate`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 402) {
          toast.error(err.message || "Insufficient reevaluation tokens.", {
            id: toastId,
            duration: 6000,
          });
          setConvertTarget("reevaluation");
          setConvertOpen(true);
          return;
        }
        throw new Error(err.error || "Failed to auto re-evaluate");
      }
      const data = await res.json();
      if (data.proposals && data.proposals.length > 0) {
        toast.dismiss(toastId);
        setDeselectedProposals([]);
        setProposalsPreview(data.proposals);
      } else {
        toast.info("Re-evaluation completed. No corrections were proposed.", {
          id: toastId,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "An error occurred", { id: toastId });
    } finally {
      setIsAutoReevaluating(false);
    }
  };

  const handleConfirmBatch = async () => {
    if (!proposalsPreview || proposalsPreview.length === 0) return;
    const confirmed = proposalsPreview.filter(
      (p) => !deselectedProposals.includes(p.trialNumber),
    );
    if (confirmed.length === 0) {
      toast.error("No proposals selected for confirmation.");
      return;
    }
    setIsSavingBatch(true);
    const toastId = toast.loading("Saving re-evaluated verdicts...");
    try {
      const res = await fetch(
        `/api/scan/${scan.id}/confirm-batch-re-evaluation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposals: confirmed }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to confirm batch re-evaluation");
      }
      const data = await res.json();
      toast.success(
        `Successfully corrected ${data.updatedCount} false-positive breaches!`,
        { id: toastId },
      );
      setProposalsPreview(null);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (e: any) {
      toast.error(e.message || "An error occurred", { id: toastId });
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const toastId = toast.loading("Deleting scan report...");
    try {
      const res = await fetch(`/api/scan/${scan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete scan report");
      }

      // Invalidate cache
      const { deleteCachedScanDetail, getCachedScansList, setCachedScansList } =
        await import("@/lib/indexed-db");
      await deleteCachedScanDetail(scan.id);

      // Fetch user & update list cache
      const userRes = await fetch("/api/user");
      const userData = await userRes.json();
      if (userData?.user?.id) {
        const cached = await getCachedScansList(userData.user.id);
        if (cached) {
          const updated = cached.filter((r: any) => r.id !== scan.id);
          await setCachedScansList(userData.user.id, updated);
        }
      }

      toast.success("Scan report deleted successfully", { id: toastId });
      router.push("/dashboard/reports");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete report", { id: toastId });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const [selectedHardenedId, setSelectedHardenedId] = useState<string>(() => {
    const active = [...scan.hardenedPrompts]
      .reverse()
      .find((hp) => hp.modelId === (scan.hardenerModel || DEFAULT_MODEL));
    return (
      active?.id ||
      scan.hardenedPrompts[scan.hardenedPrompts.length - 1]?.id ||
      ""
    );
  });

  const [currentHardenedPrompt, setCurrentHardenedPrompt] = useState<any>(
    () => {
      const active = [...scan.hardenedPrompts]
        .reverse()
        .find((hp) => hp.modelId === (scan.hardenerModel || DEFAULT_MODEL));
      return (
        active || scan.hardenedPrompts[scan.hardenedPrompts.length - 1] || null
      );
    },
  );

  const [historyModels, setHistoryModels] = useState<any[]>(
    () => scan.hardenedPrompts || [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [trace, setTrace] = useState<HardeningTrace | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeToolIdx, setActiveToolIdx] = useState(0);
  const [hardeningTokens, setHardeningTokens] = useState<number | null>(null);
  const [reevaluationTokens, setReevaluationTokens] = useState<number | null>(
    null,
  );
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertTarget, setConvertTarget] = useState<
    "hardening" | "reevaluation"
  >("hardening");

  const [summarizedPatterns, setSummarizedPatterns] = useState<
    string | undefined
  >(() => scan.metadata?.attackSummary?.summarizedPatterns);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Fetch token balances
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        setHardeningTokens(d.user?.hardeningTokens ?? 0);
        setReevaluationTokens(d.user?.reevaluationTokens ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSummarizedPatterns(scan.metadata?.attackSummary?.summarizedPatterns);
  }, [scan.metadata?.attackSummary?.summarizedPatterns]);

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    const toastId = toast.loading("Summarizing attack patterns...");
    try {
      const res = await fetch(`/api/scan/${scan.id}/summarize`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to generate summary");
      }
      const data = await res.json();
      setSummarizedPatterns(data.summary);
      toast.success("Attack patterns summarized successfully!", {
        id: toastId,
      });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate summary", { id: toastId });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleConvertTokens = async (
    scanTokensToConvert: number,
    target: "hardening" | "reevaluation" = "hardening",
  ) => {
    setConverting(true);
    try {
      const res = await fetch("/api/tokens/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanTokens: scanTokensToConvert, target }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Conversion failed");
      } else {
        if (target === "hardening") {
          setHardeningTokens(data.hardeningTokensRemaining);
        }
        setReevaluationTokens(data.reevaluationTokensRemaining);
        toast.success(
          `Converted ${scanTokensToConvert} scan token${scanTokensToConvert > 1 ? "s" : ""} → ${data.tokensGained} ${target} tokens`,
        );
        setConvertOpen(false);
      }
    } catch {
      toast.error("Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const handleModelChange = (id: string) => {
    setSelectedHardenedId(id);
    const cached = historyModels.find((hm) => hm.id === id);
    setCurrentHardenedPrompt(cached || null);
    setTrace(null);
    setActiveToolIdx(0);
  };

  const handleExtractTools = async (
    hardenerModel: string,
    granularity: Granularity,
    extractorModel: string,
    includeToolRecommendation: boolean = true,
  ) => {
    setExtracting(true);
    const toastId = toast.loading(
      includeToolRecommendation
        ? "Analyzing prompt for tool recommendations..."
        : "Generating hardened instruction defense...",
    );
    try {
      const res = await fetch(`/api/scan/${scan.id}/harden`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: hardenerModel,
          granularity,
          extractorModel,
          includeToolRecommendation,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 402) {
          toast.error(errData.message || "Insufficient hardening tokens.", {
            id: toastId,
            duration: 6000,
          });
          setConvertOpen(true); // auto-open conversion dialog
          return;
        }
        throw new Error(errData.message || "Extraction failed");
      }
      const data = await res.json();
      // Update local token balance from response
      if (typeof data.hardeningTokensRemaining === "number") {
        setHardeningTokens(data.hardeningTokensRemaining);
        if (data.tokensRefunded > 0) {
          toast.info(`1 hardening token refunded (fast path used)`);
        }
      }
      const newPrompt = {
        id: data.id,
        modelId: data.modelId,
        modelName: data.modelName,
        prompt: data.hardenedPrompt,
        toolRecommendation: data.toolRecommendation,
        compatibilityScore: data.compatibilityScore,
        granularity: data.granularity,
        extractorModel: data.extractorModel,
      };

      setCurrentHardenedPrompt(newPrompt);
      setSelectedHardenedId(newPrompt.id);
      setActiveToolIdx(0);
      if (data.trace) {
        setTrace(data.trace);
        setTraceOpen(true);
      }

      // Update historyModels — always append since each hardening creates a new record
      setHistoryModels((prev) => [...prev, newPrompt]);

      toast.success("Tool recommendation generated!", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Failed to extract tools from prompt", { id: toastId });
    } finally {
      setExtracting(false);
    }
  };

  const handleApplyToConfig = () => {
    if (!currentHardenedPrompt?.toolRecommendation) return;
    const rec = currentHardenedPrompt.toolRecommendation;

    let recommendedTools: any[] = [];
    let recommendedMocks: any = {};
    const replacements = new Map<string, string>(); // newName -> oldName

    if (Array.isArray(rec.tools)) {
      recommendedTools = rec.tools.map((t: any) => {
        const name = t.name || t.toolJson?.function?.name;
        if (name && t.replaces && t.replaces !== "none") {
          replacements.set(name, t.replaces);
        }
        return t.toolJson || t;
      });
      recommendedMocks = rec.tools.reduce((acc: any, t: any) => {
        const name = t.name || t.toolJson?.function?.name;
        if (name) {
          acc[name] = t.mockResponse || {};
        }
        return acc;
      }, {});
    } else {
      recommendedTools = rec.tools || [];
      recommendedMocks = rec.mockToolResponses || {};
    }

    // Parse existing tools
    let existingTools: any[] = [];
    if (Array.isArray(scan.tools)) {
      existingTools = [...scan.tools];
    } else if (typeof scan.tools === "string") {
      try {
        existingTools = JSON.parse(scan.tools);
      } catch {}
    }

    // Parse existing mocks
    let existingMocks: any = {};
    if (scan.mockToolResponses && typeof scan.mockToolResponses === "object") {
      existingMocks = { ...scan.mockToolResponses };
    } else if (typeof scan.mockToolResponses === "string") {
      try {
        existingMocks = JSON.parse(scan.mockToolResponses);
      } catch {}
    }

    // Merge by tool name
    const mergedToolsMap = new Map<string, any>();
    for (const tool of existingTools) {
      const name = tool.function?.name;
      if (name) {
        mergedToolsMap.set(name, tool);
      }
    }

    // Delete tools/mocks replaced under different names
    for (const [newName, oldName] of Array.from(replacements.entries())) {
      if (oldName && oldName !== newName) {
        mergedToolsMap.delete(oldName);
        delete existingMocks[oldName];
      }
    }

    for (const tool of recommendedTools) {
      const name = tool.function?.name;
      if (name) {
        mergedToolsMap.set(name, tool);
      }
    }
    const toolsList = Array.from(mergedToolsMap.values());

    // Merge mocks
    const mockResponsesDict = {
      ...existingMocks,
      ...recommendedMocks,
    };

    const preset = {
      targetModels: [scan.targetModel],
      attackerModel: scan.attackerModel,
      judgeModel: scan.judgeModel,
      hardenerModel: scan.hardenerModel,
      prompts: [
        {
          systemPrompt: currentHardenedPrompt.prompt,
          forbiddenTask: scan.forbiddenTask,
          tools: JSON.stringify(toolsList),
          mockResponses: JSON.stringify(mockResponsesDict),
          judgeInstructions: scan.judgeInstructions,
        },
      ],
    };
    localStorage.setItem("ToolRegistry_scan_preset", JSON.stringify(preset));
    toast.success("Applied to scan configuration. Redirecting...");
    router.push("/dashboard/scan");
  };

  const filteredTrials = scan.trials.filter((t) => {
    if (filter === TrialFilter.All) return true;
    if (filter === TrialFilter.Breached)
      return t.verdict === TrialVerdict.Breached;
    return t.verdict === TrialVerdict.Defended;
  });

  const breachedCount = scan.trials.filter(
    (t) => t.verdict === TrialVerdict.Breached,
  ).length;
  const defendedCount = scan.totalTrials - breachedCount;
  const handleOpenToolManager = () => {
    setToolManagerOpen(true);
  };

  const handleApplyFromDialog = (
    toolsToAdd: any[],
    toolsToRemove: string[],
    localMocks: Record<string, any>,
  ) => {
    if (!currentHardenedPrompt?.toolRecommendation) return;
    const rec = currentHardenedPrompt.toolRecommendation;

    let existingTools: any[] = [];
    if (Array.isArray(scan.tools)) {
      existingTools = [...scan.tools];
    } else if (typeof scan.tools === "string") {
      try {
        existingTools = JSON.parse(scan.tools);
      } catch {}
    }

    let existingMocks: any = {};
    if (scan.mockToolResponses && typeof scan.mockToolResponses === "object") {
      existingMocks = { ...scan.mockToolResponses };
    } else if (typeof scan.mockToolResponses === "string") {
      try {
        existingMocks = JSON.parse(scan.mockToolResponses);
      } catch {}
    }

    const mergedToolsMap = new Map<string, any>();
    for (const tool of existingTools) {
      const name = tool.function?.name;
      if (name) mergedToolsMap.set(name, tool);
    }

    for (const name of toolsToRemove) {
      mergedToolsMap.delete(name);
      delete existingMocks[name];
    }

    for (const tool of toolsToAdd) {
      const name = tool.function?.name;
      if (name) mergedToolsMap.set(name, tool);
    }
    const toolsList = Array.from(mergedToolsMap.values());

    const keepNames = new Set(
      toolsList.map((t) => t.function?.name).filter(Boolean),
    );
    const mockResponsesDict: any = {};
    for (const [key, val] of Object.entries(existingMocks)) {
      if (keepNames.has(key)) mockResponsesDict[key] = val;
    }
    // Use localMocks (edited in dialog) for added/recommended tools, fallback to original rec mocks
    for (const tool of toolsToAdd) {
      const name = tool.function?.name;
      if (name && localMocks[name]) mockResponsesDict[name] = localMocks[name];
    }

    const preset = {
      targetModels: [scan.targetModel],
      attackerModel: scan.attackerModel,
      judgeModel: scan.judgeModel,
      hardenerModel: scan.hardenerModel,
      prompts: [
        {
          systemPrompt: currentHardenedPrompt.prompt,
          forbiddenTask: scan.forbiddenTask,
          tools: JSON.stringify(toolsList),
          mockResponses: JSON.stringify(mockResponsesDict),
          judgeInstructions: scan.judgeInstructions,
        },
      ],
    };
    localStorage.setItem("ToolRegistry_scan_preset", JSON.stringify(preset));
    toast.success("Tools applied to scan configuration. Redirecting...");
    router.push("/dashboard/scan");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Report header bar */}
      {ReportHeader(
        scan,
        refreshing,
        onRefresh,
        () => setDeleteDialogOpen(true),
        isAutoReevaluating,
        handleAutoReevaluate,
        setConvertTarget,
        setConvertOpen,
        reevaluationTokens,
      )}

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── Summary hero ── */}
        {summaryHero(scan)}

        <Separator />

        {/* ── Scan Summary (defense rate, top vulnerability, agent models) ── */}
        <ScanSummary scan={scan} activeHardenedPrompt={currentHardenedPrompt} />

        <Separator />

        {/* ── 01 Scan Configuration ── */}
        {scanConfiguration(
          scan,
          mounted,
          summarizedPatterns,
          generatingSummary,
          handleGenerateSummary,
        )}

        <Separator />

        {/* ── 02 Hardened Prompt & Tool Recommendations ── */}
        {hardenedPrompt(
          selectedHardenedId,
          handleModelChange,
          currentHardenedPrompt,
          setPickerOpen,
          extracting,
          handleOpenToolManager,
          pickerOpen,
          handleExtractTools,
          trace,
          setTraceOpen,
          activeToolIdx,
          setActiveToolIdx,
          historyModels,
          hardeningTokens,
          reevaluationTokens,
          setConvertOpen,
          convertOpen,
          converting,
          handleConvertTokens,
        )}

        <Separator />

        {/* ── 03 Trial-by-Trial Breakdown ── */}
        {trialBreakdown(
          scan,
          breachedCount,
          defendedCount,
          filter,
          setFilter,
          filteredTrials,
          onRefresh,
        )}

        {/* Report footer */}
        <Separator />
        <div className="flex items-center justify-between pb-8 text-xs text-muted-foreground">
          <span>ToolRegistry · Security Insights Report · Confidential</span>
        </div>
      </div>

      <ExtractionTraceDialog
        open={traceOpen}
        onOpenChange={setTraceOpen}
        trace={trace}
      />
      <ToolManagerDialog
        open={toolManagerOpen}
        onOpenChange={setToolManagerOpen}
        onConfirm={handleApplyFromDialog}
        recommendedTools={
          currentHardenedPrompt?.toolRecommendation?.tools || []
        }
        existingTools={
          Array.isArray(scan.tools)
            ? scan.tools
            : typeof scan.tools === "string"
              ? (() => {
                  try {
                    return JSON.parse(scan.tools);
                  } catch {
                    return [];
                  }
                })()
              : []
        }
        existingMockKeys={
          typeof scan.mockToolResponses === "object" &&
          scan.mockToolResponses !== null
            ? Object.keys(scan.mockToolResponses)
            : typeof scan.mockToolResponses === "string"
              ? (() => {
                  try {
                    return Object.keys(JSON.parse(scan.mockToolResponses));
                  } catch {
                    return [];
                  }
                })()
              : []
        }
        existingMocks={
          typeof scan.mockToolResponses === "object" &&
          scan.mockToolResponses !== null
            ? scan.mockToolResponses
            : typeof scan.mockToolResponses === "string"
              ? (() => {
                  try {
                    return JSON.parse(scan.mockToolResponses);
                  } catch {
                    return {};
                  }
                })()
              : {}
        }
      />
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-red-500/20 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5 text-red-400" />
              Delete Scan Report
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete Scan #{scan.id}? This action is
              permanent and cannot be undone. All associated data, including
              hardened prompts, will be permanently deleted from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={proposalsPreview !== null}
        onOpenChange={(open) => {
          if (!open) setProposalsPreview(null);
        }}
      >
        <DialogContent className="border-yellow-500/20 bg-slate-900 text-slate-100 max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-400">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              Confirm Auto Re-evaluation Proposals
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              The AI judge has proposed the following corrections. Uncheck any
              proposals you wish to ignore.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-1">
            {proposalsPreview?.map((prop) => {
              const isChecked = !deselectedProposals.includes(prop.trialNumber);
              return (
                <div
                  key={prop.trialNumber}
                  className={cn(
                    "p-3 rounded border transition-colors space-y-3",
                    isChecked
                      ? "bg-yellow-500/[0.03] border-yellow-500/20"
                      : "bg-black/25 border-white/5 opacity-55",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-yellow-400">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          setDeselectedProposals((prev) =>
                            prev.includes(prop.trialNumber)
                              ? prev.filter((n) => n !== prop.trialNumber)
                              : [...prev, prop.trialNumber],
                          );
                        }}
                      />
                      <span>Trial #{prop.trialNumber}</span>
                    </label>
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded">
                      Proposed: {prop.verdict}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Adversarial Attack
                      </span>
                      <p className="text-slate-300 font-mono text-[11px] p-2 rounded bg-black/20 mt-0.5 whitespace-pre-wrap">
                        {prop.attack}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Model's Response
                      </span>
                      <p className="text-slate-300 font-serif italic p-2 rounded bg-black/20 mt-0.5 whitespace-pre-wrap">
                        "{prop.response}"
                      </p>
                    </div>
                    {prop.originalReasoning && (
                      <div>
                        <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider block">
                          Original Judge Reasoning
                        </span>
                        <p className="text-slate-400 p-2 rounded bg-black/20 mt-0.5 leading-relaxed">
                          {prop.originalReasoning}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                        New Proposed Reasoning
                      </span>
                      <p className="text-slate-200 p-2 rounded bg-emerald-500/[0.04] border border-emerald-500/10 mt-0.5 leading-relaxed">
                        {prop.reasoning}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="mt-4 flex gap-2 justify-end shrink-0">
            <Button
              variant="outline"
              onClick={() => setProposalsPreview(null)}
              disabled={isSavingBatch}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Discard All
            </Button>
            <Button
              onClick={handleConfirmBatch}
              disabled={isSavingBatch}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              {isSavingBatch && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-black" />
              )}
              Confirm & Save{" "}
              {proposalsPreview
                ? proposalsPreview.length - deselectedProposals.length
                : 0}{" "}
              Updates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function trialBreakdown(
  scan: Scan,
  breachedCount: number,
  defendedCount: number,
  filter: TrialFilter,
  setFilter,
  filteredTrials: Trial[],
  onRefresh?: () => void,
) {
  return (
    <section id="trial-breakdown" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            03 — Trial-by-Trial Breakdown
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
            className={
              filter === f
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            }
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
          <TrialCard
            key={trial.number}
            trial={trial}
            scan={scan}
            onRefresh={onRefresh}
          />
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
  );
}

function hardenedPrompt(
  selectedHardenedId: string,
  handleModelChange: (id: string) => void,
  currentHardenedPrompt: any,
  setPickerOpen,
  extracting: boolean,
  handleOpenToolManager: () => void,
  pickerOpen: boolean,
  handleExtractTools: (
    hardenerModel: string,
    granularity: Granularity,
    extractorModel: string,
    includeToolRecommendation: boolean,
  ) => Promise<void>,
  trace: HardeningTrace | null,
  setTraceOpen: (open: boolean) => void,
  activeToolIdx: number,
  setActiveToolIdx: React.Dispatch<React.SetStateAction<number>>,
  historyModels: any[],
  hardeningTokens: number | null,
  reevaluationTokens: number | null,
  setConvertOpen: (open: boolean) => void,
  convertOpen: boolean,
  converting: boolean,
  handleConvertTokens: (
    n: number,
    target?: "hardening" | "reevaluation",
  ) => Promise<void>,
) {
  // Build version map: modelId -> count of entries with that modelId
  const modelVersionCounts = new Map<string, number>();
  for (const hm of historyModels) {
    const key = hm.modelId;
    modelVersionCounts.set(key, (modelVersionCounts.get(key) || 0) + 1);
  }

  // Track current version index per modelId as we iterate
  const modelVersionIndex = new Map<string, number>();

  const formatDropdownName = (hp: any) => {
    const hardener = hp.modelName || formatModelName(hp.modelId);
    const base =
      !hp.extractorModel || !hp.toolRecommendation
        ? `${hardener} (No Tools)`
        : `${hardener} + ${formatModelName(hp.extractorModel)}`;

    const key = hp.modelId;
    const total = modelVersionCounts.get(key) || 1;
    if (total <= 1) return base; // no version suffix needed

    const idx = (modelVersionIndex.get(key) || 0) + 1;
    modelVersionIndex.set(key, idx);
    return `${base} (v${idx})`;
  };

  return (
    <section id="hardened-prompt" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          02 — Hardened System Prompt & Tool Recommendations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyze the hardened system prompt and extract conditional gatekeeper
          rules into structured tool APIs.
        </p>
      </div>

      <Card className="border-border bg-card/60 backdrop-blur-md overflow-hidden">
        <div className="border-b border-border bg-muted/20 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recommendation:
              </span>
              {historyModels.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedHardenedId}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="h-8 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-md pl-2.5 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    {historyModels.map((hm) => (
                      <option key={hm.id} value={hm.id}>
                        {formatDropdownName(hm)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  None generated yet
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            {trace && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTraceOpen(true)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                View Step Traces
              </Button>
            )}
            {/* Hardening token balance badge — opens conversion dialog */}
            <button
              type="button"
              onClick={() => setConvertOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-600/10 px-2 py-1 text-[11px] font-semibold text-purple-300 hover:bg-purple-600/20 transition-colors"
              title="Convert scan tokens to hardening tokens"
            >
              <Zap className="h-3 w-3" />
              {hardeningTokens === null ? "…" : hardeningTokens} hardening
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={extracting}
              className="border-blue-500/40 text-blue-400 hover:bg-blue-600/10 text-xs"
            >
              Harden Prompt
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Hardened System Prompt Text
              </label>
              <CodeHighlight
                code={
                  currentHardenedPrompt?.prompt ||
                  "No hardened prompt generated for this model yet."
                }
                language="plaintext"
                className="p-4! max-h-75 overflow-y-auto border border-white/5 rounded-lg"
              />
            </div>

            {currentHardenedPrompt ? (
              currentHardenedPrompt.toolRecommendation ? (
                <div className="mt-6 rounded-xl border border-white/5 bg-slate-950/25 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <span className="text-sm font-bold text-foreground">
                      Tool Migration Recommendation
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-white/5">
                        Extractor:{" "}
                        {currentHardenedPrompt.extractorModel
                          ?.split("/")
                          .pop() || "gemini-2.5-flash"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {currentHardenedPrompt.toolRecommendation.tools &&
                      currentHardenedPrompt.toolRecommendation.tools.length >
                        1 && (
                        <div className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-white/5 mb-3">
                          <button
                            onClick={() =>
                              setActiveToolIdx(
                                (prev) =>
                                  (prev -
                                    1 +
                                    currentHardenedPrompt.toolRecommendation
                                      .tools.length) %
                                  currentHardenedPrompt.toolRecommendation.tools
                                    .length,
                              )
                            }
                            className="px-3 py-1 text-xs font-semibold rounded bg-muted hover:bg-muted/80 text-slate-300 transition-colors border border-white/5"
                          >
                            ← Previous
                          </button>
                          <div className="flex items-center gap-1.5">
                            {currentHardenedPrompt.toolRecommendation.tools.map(
                              (_: any, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={() => setActiveToolIdx(idx)}
                                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                                    idx === activeToolIdx
                                      ? "bg-blue-500 scale-110"
                                      : "bg-slate-600 hover:bg-slate-500"
                                  }`}
                                  title={`Go to Tool ${idx + 1}`}
                                />
                              ),
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setActiveToolIdx(
                                (prev) =>
                                  (prev + 1) %
                                  currentHardenedPrompt.toolRecommendation.tools
                                    .length,
                              )
                            }
                            className="px-3 py-1 text-xs font-semibold rounded bg-muted hover:bg-muted/80 text-slate-300 transition-colors border border-white/5"
                          >
                            Next →
                          </button>
                        </div>
                      )}

                    {(() => {
                      const toolsList =
                        currentHardenedPrompt.toolRecommendation.tools || [];
                      if (toolsList.length === 0) return null;
                      const activeIdx = Math.max(
                        0,
                        Math.min(activeToolIdx, toolsList.length - 1),
                      );
                      const recTool = toolsList[activeIdx];

                      const score =
                        recTool.compatibilityScore ??
                        currentHardenedPrompt.compatibilityScore ??
                        0;
                      const color =
                        score <= 20
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                          : score <= 60
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                            : "bg-red-500/15 text-red-400 border-red-500/20";
                      const label =
                        score <= 20
                          ? "Low-risk constraint"
                          : score <= 60
                            ? "Moderate candidate"
                            : "High-priority tooling candidate";

                      const toolName =
                        recTool.name ||
                        recTool.toolJson?.function?.name ||
                        `Tool ${activeIdx + 1}`;
                      const toolGranularity =
                        recTool.granularity ||
                        currentHardenedPrompt.granularity ||
                        Granularity.Compact;
                      const toolRationale =
                        recTool.rationale || "No rationale provided.";

                      const toolJson = recTool.toolJson || recTool;
                      const mockVal =
                        recTool.mockResponse ||
                        currentHardenedPrompt.toolRecommendation
                          .mockToolResponses?.[toolName] ||
                        {};

                      return (
                        <div className="p-4 rounded-lg bg-slate-950/45 border border-white/5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-blue-400">
                                {toolName}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-medium px-2 py-0.5 ${color}`}
                              >
                                Score: {score} · {label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-slate-300 border border-white/5 uppercase">
                                {toolGranularity}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-slate-400">
                              Tool Logic & Rationale
                            </span>
                            <MarkdownRenderer
                              content={toolRationale}
                              className="text-xs text-slate-300 leading-relaxed bg-slate-900/30 p-2.5 rounded border border-white/5 whitespace-pre-wrap"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-slate-400">
                                JSON Schema
                              </span>
                              <CodeHighlight
                                code={JSON.stringify(toolJson, null, 2)}
                                language="json"
                                className="text-[10px] p-2.5 max-h-40 overflow-y-auto border border-white/5 rounded"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-slate-400">
                                Mock Response
                              </span>
                              <CodeHighlight
                                code={JSON.stringify(mockVal, null, 2)}
                                language="json"
                                className="text-[10px] p-2.5 max-h-40 overflow-y-auto border border-white/5 rounded"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {currentHardenedPrompt.toolRecommendation.tools?.length >
                    0 && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleOpenToolManager}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-[0_4px_12px_rgba(59,130,246,0.3)] transition-all"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Apply to Scan Configuration
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/5 p-6 text-center space-y-3">
                  <HelpCircle className="mx-auto h-8 w-8 text-slate-500" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-300">
                      No tool recommendation extracted
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Offload complex conditional policy rules in this prompt to
                      a structured JSON tool API. Extract them to increase
                      prompt efficiency.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPickerOpen(true)}
                    disabled={extracting}
                    className="border-slate-800 text-slate-400 hover:text-slate-200 text-xs px-3 py-1"
                  >
                    Analyze Prompt for Tools
                  </Button>
                </div>
              )
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/5 p-6 text-center space-y-3">
                <Sparkles className="mx-auto h-8 w-8 text-purple-400" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-300">
                    No hardened prompt generated yet
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Generate instructions specifically optimized to defend this
                    model against adversarial attacks.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  disabled={extracting}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1"
                >
                  Harden Prompt
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <GranularityPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={handleExtractTools}
        defaultHardenerModel={selectedHardenedId}
        defaultGranularity={
          (currentHardenedPrompt?.granularity as any) || Granularity.Compact
        }
        defaultExtractorModel={
          currentHardenedPrompt?.extractorModel || DEFAULT_MODEL
        }
      />

      {/* Token Conversion Dialog */}
      <TokenConversionDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        hardeningTokens={hardeningTokens}
        reevaluationTokens={reevaluationTokens}
        converting={converting}
        onConvert={handleConvertTokens}
      />
    </section>
  );
}

interface TokenConversionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hardeningTokens: number | null;
  reevaluationTokens: number | null;
  converting: boolean;
  onConvert: (n: number, target: "hardening" | "reevaluation") => Promise<void>;
}

function TokenConversionDialog({
  open,
  onOpenChange,
  hardeningTokens,
  reevaluationTokens,
  converting,
  onConvert,
}: TokenConversionDialogProps) {
  const [target, setTarget] = useState<"hardening" | "reevaluation">(
    "hardening",
  );
  const [customAmount, setCustomAmount] = useState("1");
  const parsed = parseInt(customAmount, 10);
  const isValid = !isNaN(parsed) && parsed >= 1;
  const conversionRate = target === "hardening" ? 10 : 30;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark max-w-sm border-border bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Zap className="h-4 w-4 text-purple-400" />
            Convert Scan Tokens
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            Convert your scan tokens into{" "}
            {target === "hardening" ? "hardening" : "re-evaluation"} tokens at a
            rate of{" "}
            <span className="font-semibold text-purple-300">
              1&nbsp;scan&nbsp;→&nbsp;{conversionRate}&nbsp;
              {target === "hardening" ? "hardening" : "re-evaluation"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target toggle */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-1">
            <button
              type="button"
              onClick={() => setTarget("hardening")}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                target === "hardening"
                  ? "bg-purple-600/20 text-purple-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Hardening
            </button>
            <button
              type="button"
              onClick={() => setTarget("reevaluation")}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                target === "reevaluation"
                  ? "bg-emerald-600/20 text-emerald-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Re-evaluation
            </button>
          </div>

          {/* Current balances */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2.5">
              <span className="text-xs text-slate-400">Hardening</span>
              <span className="text-sm font-bold text-purple-300">
                {hardeningTokens === null ? "…" : hardeningTokens}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2.5">
              <span className="text-xs text-slate-400">Re-evaluation</span>
              <span className="text-sm font-bold text-emerald-300">
                {reevaluationTokens === null ? "…" : reevaluationTokens}
              </span>
            </div>
          </div>

          {/* Quick-select buttons */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Quick select
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onConvert(n, target)}
                  disabled={converting}
                  className={`flex flex-col items-center rounded-lg border py-2.5 disabled:opacity-50 transition-colors ${
                    target === "hardening"
                      ? "border-purple-500/30 bg-purple-600/10 text-purple-200 hover:bg-purple-600/25"
                      : "border-emerald-500/30 bg-emerald-600/10 text-emerald-200 hover:bg-emerald-600/25"
                  }`}
                >
                  <span className="text-sm font-bold">{n}</span>
                  <span className="text-[10px] text-slate-400">
                    → {n * conversionRate}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Custom amount
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="bg-slate-950/50 border-slate-700 text-slate-100 h-9 text-sm"
                placeholder="e.g. 3"
              />
              <Button
                size="sm"
                onClick={() => isValid && onConvert(parsed, target)}
                disabled={!isValid || converting}
                className={
                  target === "hardening"
                    ? "bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                }
              >
                {converting
                  ? "Converting…"
                  : `→ ${isValid ? parsed * conversionRate : "?"}`}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-800/80 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-200 w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function scanConfiguration(
  scan: Scan,
  mounted: boolean,
  summarizedPatterns?: string,
  generatingSummary?: boolean,
  handleGenerateSummary?: () => void,
) {
  return (
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
      <ConfigBlock label="System Prompt" icon={Shield}>
        <CodeHighlight
          code={scan.systemPrompt}
          language="plaintext"
          className="p-4!"
        />
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
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            >
              <span className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-blue-400" />
                {scan.tools.length} tool definitions
              </span>
              <span className="text-xs text-muted-foreground">
                Click to expand
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CodeHighlight
              code={JSON.stringify(scan.tools, null, 2)}
              language="json"
              className="mt-3 p-4! max-h-96 overflow-auto"
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
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            >
              <span className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-purple-400" />
                {Object.keys(scan.mockToolResponses).length} mock responses
              </span>
              <span className="text-xs text-muted-foreground">
                Click to expand
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CodeHighlight
              code={JSON.stringify(scan.mockToolResponses, null, 2)}
              language="json"
              className="mt-3 p-4! max-h-96 overflow-auto"
            />
          </CollapsibleContent>
        </Collapsible>
      </ConfigBlock>

      {/* Forbidden Task */}
      <ConfigBlock label="Forbidden Task" icon={Ban}>
        <CodeHighlight
          code={scan.forbiddenTask}
          language="plaintext"
          className="p-4!"
        />
      </ConfigBlock>

      {/* Judge Instructions (NEW) */}
      <ConfigBlock
        label="Judge Instructions"
        icon={Gavel}
        badge="NEW"
        description="Tells the Judge exactly how to evaluate each response — separate from the forbidden task."
      >
        <CodeHighlight
          code={scan.judgeInstructions}
          language="plaintext"
          className="p-4!"
        />
      </ConfigBlock>

      {/* Adversarial Coverage */}
      <ConfigBlock label="Adversarial Coverage" icon={Swords}>
        <div className="space-y-3">
          {/* Forbidden Task */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {scan.forbiddenTask || "Forbidden Task"}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-red-500/30 text-red-400 shrink-0 ml-3"
              >
                {scan.breaches} / {scan.totalTrials} breached
              </Badge>
            </div>
          </div>

          {/* Seed extraction details from metadata */}
          {mounted &&
            scan.metadata?.seedExtraction &&
            (() => {
              const seed = scan.metadata.seedExtraction!;
              return (
                <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Seed Extraction
                  </p>
                  <div className="flex flex-col gap-3 text-xs">
                    {seed.personaDescription && (
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Persona</span>
                        <span className="text-foreground font-medium">
                          {seed.personaDescription}
                        </span>
                      </div>
                    )}
                    {seed.businessCategories &&
                      seed.businessCategories.length > 0 && (
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-muted-foreground">
                            Categories
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {seed.businessCategories.map(
                              (cat: string, i: number) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[10px] border-slate-700 text-slate-300 font-normal px-2 py-0"
                                >
                                  {cat}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    {seed.businessFeatures &&
                      seed.businessFeatures.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-muted-foreground block font-semibold text-[11px] uppercase tracking-wider">
                            Features
                          </span>
                          <ul className="list-disc pl-4 space-y-1 text-foreground text-xs leading-relaxed">
                            {seed.businessFeatures.map(
                              (feat: string, i: number) => (
                                <li key={i}>{feat}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                    {seed.things &&
                      seed.things.map((t: any, idx: number) => (
                        <div
                          key={idx}
                          className="col-span-3 border-t border-white/5 pt-2 mt-2 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-purple-400">
                              Restriction #{idx + 1}: {t.thingName}
                            </p>
                            {t.ontologySection && (
                              <span className="rounded bg-purple-500/25 border border-purple-500/35 px-1.5 py-0.5 text-[9px] font-medium text-purple-300">
                                Section: {t.ontologySection}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <span className="text-muted-foreground">
                              Description
                            </span>
                            <span className="text-foreground col-span-2">
                              {t.thingDescription}
                            </span>

                            {t.thingNameVariants &&
                              t.thingNameVariants.length > 0 && (
                                <>
                                  <span className="text-muted-foreground">
                                    Name Variants
                                  </span>
                                  <div className="flex flex-wrap gap-1 col-span-2">
                                    {t.thingNameVariants.map(
                                      (v: string, i: number) => (
                                        <Badge
                                          key={i}
                                          variant="secondary"
                                          className="text-[10px] bg-slate-900 border-slate-800 text-slate-300 font-normal px-2 py-0"
                                        >
                                          {v}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                </>
                              )}

                            {t.thingDescriptionVariants &&
                              t.thingDescriptionVariants.length > 0 && (
                                <>
                                  <span className="text-muted-foreground">
                                    Description Variants
                                  </span>
                                  <ul className="list-disc pl-4 space-y-1 col-span-2 text-foreground text-xs">
                                    {t.thingDescriptionVariants.map(
                                      (v: string, i: number) => (
                                        <li key={i}>{v}</li>
                                      ),
                                    )}
                                  </ul>
                                </>
                              )}

                            {t.credentials && t.credentials.length > 0 && (
                              <>
                                <span className="text-muted-foreground">
                                  Credentials
                                </span>
                                <div className="flex flex-wrap gap-1 col-span-2">
                                  {t.credentials.map(
                                    (cred: string, i: number) => (
                                      <code
                                        key={i}
                                        className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] text-amber-300 font-mono"
                                      >
                                        {cred}
                                      </code>
                                    ),
                                  )}
                                </div>
                              </>
                            )}

                            {t.businessScenarios &&
                              t.businessScenarios.length > 0 && (
                                <>
                                  <span className="text-muted-foreground">
                                    Scenarios
                                  </span>
                                  <ul className="list-disc pl-4 space-y-1 col-span-2 text-foreground text-xs">
                                    {t.businessScenarios
                                      .slice(0, 3)
                                      .map((v: string, i: number) => (
                                        <li key={i}>{v}</li>
                                      ))}
                                  </ul>
                                </>
                              )}
                          </div>
                        </div>
                      ))}

                    {seed.coreSystemPrompt && (
                      <div className="col-span-3 border-t border-white/5 pt-3 mt-2 space-y-1.5">
                        <span className="text-muted-foreground block font-semibold text-[11px] uppercase tracking-wider">
                          Sanitized Core System Prompt (Judge's View)
                        </span>
                        <pre className="bg-slate-950/70 border border-slate-800/80 p-2.5 rounded text-[11px] text-slate-300 font-mono overflow-auto max-h-[200px] whitespace-pre-wrap leading-relaxed">
                          {seed.coreSystemPrompt}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Attack summary patterns from state */}
          {summarizedPatterns ? (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
                >
                  <span className="flex items-center gap-2">
                    <Swords className="h-3.5 w-3.5 text-amber-400" />
                    Attack Pattern Summary
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Click to expand
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-lg border border-border bg-muted/5 p-3">
                  <MarkdownRenderer content={summarizedPatterns} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            scan.breaches > 0 && (
              <div className="rounded-lg border border-slate-700/60 bg-slate-800/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <Swords className="h-3.5 w-3.5" />
                    No Attack Pattern Summary
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-lg leading-relaxed">
                    This report has {scan.breaches} successful attacks, but the
                    pattern summary is missing (possibly due to a temporary LLM
                    API failure during scanning).
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0 font-medium text-xs"
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Summary"
                  )}
                </Button>
              </div>
            )
          )}
        </div>
      </ConfigBlock>
    </section>
  );
}

function summaryHero(scan: Scan) {
  return (
    <section id="summary" className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-blue-400" />
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
        {(() => {
          const totalToolCalls = scan.trials.reduce(
            (sum, trial) => sum + (trial.toolCalls?.length || 0),
            0,
          );
          const numericRate =
            scan.totalTrials > 0 ? totalToolCalls / scan.totalTrials : 0;
          const toolCallRate = numericRate.toFixed(1);

          let hasTools = false;
          try {
            const toolsRaw = scan.tools as any;
            if (Array.isArray(toolsRaw)) {
              hasTools = toolsRaw.length > 0;
            } else if (typeof toolsRaw === "string" && toolsRaw.trim()) {
              const parsed = JSON.parse(toolsRaw);
              hasTools = Array.isArray(parsed) && parsed.length > 0;
            }
          } catch {
            // ignore
          }

          const toolTrials = scan.trials.filter(
            (t: any) => t.toolCalls && t.toolCalls.length > 0,
          );
          const noToolTrials = scan.trials.filter(
            (t: any) => !t.toolCalls || t.toolCalls.length === 0,
          );
          const toolBreached = toolTrials.filter(
            (t: any) => t.verdict === TrialVerdict.Breached,
          ).length;
          const noToolBreached = noToolTrials.filter(
            (t: any) => t.verdict === TrialVerdict.Breached,
          ).length;
          const toolDefenseRate =
            toolTrials.length > 0
              ? Math.round(
                  ((toolTrials.length - toolBreached) / toolTrials.length) *
                    100,
                )
              : 0;
          const noToolDefenseRate =
            noToolTrials.length > 0
              ? Math.round(
                  ((noToolTrials.length - noToolBreached) /
                    noToolTrials.length) *
                    100,
                )
              : 0;

          return [
            {
              label: "Target Model",
              value: scan.modelName,
              colorType: "default",
            },
            {
              label: "Total Trials",
              value: scan.totalTrials,
              colorType: "default",
            },
            { label: "Breaches", value: scan.breaches, colorType: "default" },
            {
              label: "Breach Rate",
              value: `${scan.breachRate}%`,
              colorType: "default",
            },
            {
              label: "Tool Call Rate",
              value: `${toolCallRate}/trial`,
              colorType:
                numericRate >= 1.0 && hasTools
                  ? "green"
                  : totalToolCalls > 0 && scan.breaches > 0
                    ? "red"
                    : "default",
            },
            {
              label: "Defense Rate (w/ tools)",
              value: `${toolDefenseRate}%`,
              colorType:
                toolTrials.length === 0
                  ? "default"
                  : toolDefenseRate >= 80
                    ? "green"
                    : toolDefenseRate >= 50
                      ? "amber"
                      : "red",
            },
            {
              label: "Defense Rate (no tools)",
              value: `${noToolDefenseRate}%`,
              colorType:
                noToolTrials.length === 0
                  ? "default"
                  : noToolDefenseRate >= 80
                    ? "green"
                    : noToolDefenseRate >= 50
                      ? "amber"
                      : "red",
            },
          ];
        })().map((stat) => {
          let cardClass = "";
          let textClass = "text-foreground";
          if (stat.colorType === "red") {
            cardClass = "border-red-500/30";
            textClass = "text-red-400";
          } else if (stat.colorType === "green") {
            cardClass = "border-emerald-500/30 bg-emerald-500/5";
            textClass = "text-emerald-400";
          } else if (stat.colorType === "amber") {
            cardClass = "border-amber-500/30 bg-amber-500/5";
            textClass = "text-amber-400";
          }
          return (
            <Card key={stat.label} className={`p-4 ${cardClass}`}>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-sm font-bold ${textClass}`}>
                {stat.value}
              </p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ReportHeader(
  scan: Scan,
  refreshing?: boolean,
  onRefresh?: () => Promise<void>,
  onDelete?: () => void,
  isAutoReevaluating?: boolean,
  onAutoReevaluate?: () => void,
  setConvertTarget?: (target: "hardening" | "reevaluation") => void,
  setConvertOpen?: (open: boolean) => void,
  reevaluationTokens?: number | null,
) {
  return (
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
          <Badge
            variant="outline"
            className="hidden border-amber-500/30 text-amber-400 sm:inline-flex"
          >
            CONFIDENTIAL
          </Badge>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          )}
          {onAutoReevaluate && scan.breaches > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAutoReevaluate}
              disabled={isAutoReevaluating || refreshing}
              className={cn(
                "flex items-center gap-1.5",
                scan.breachRate >= 80
                  ? "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 shadow-[0_0_8px_rgba(234,179,8,0.15)] animate-pulse"
                  : "border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55",
              )}
            >
              {isAutoReevaluating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Auto Re-evaluate</span>
            </Button>
          )}
          {/* Re-evaluation token balance badge — opens conversion dialog */}
          {onAutoReevaluate &&
            scan.breaches > 0 &&
            setConvertTarget &&
            setConvertOpen && (
              <button
                type="button"
                onClick={() => {
                  setConvertTarget("reevaluation");
                  setConvertOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-600/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/20 transition-colors"
                title="Convert scan tokens to re-evaluation tokens"
              >
                <Sparkles className="h-3 w-3" />
                {reevaluationTokens === null ? "…" : reevaluationTokens} re-eval
              </button>
            )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-950/20"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
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
