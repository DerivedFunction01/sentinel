"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SummaryHero } from "@/components/report/summary-hero";
import { ScanConfigurationSection } from "@/components/report/scan-configuration-section";
import { ReportFooter } from "@/components/report/report-footer";
import { TrialBreakdownSection } from "@/components/report/trial-breakdown-section";
import { HardenedPromptSection } from "@/components/report/hardened-prompt-section";
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
import { Checkbox } from "@/components/ui/checkbox";
import { TrialFilter, TrialVerdict } from "@/lib/enums";
import { Scan, HardeningTrace } from "@/lib/types";
import { Granularity } from "@/lib/enums";
import { ScanSummary } from "@/components/shared/scan-summary";
import { ExtractionTraceDialog } from "@/components/shared/extraction-trace-dialog";
import { FALLBACK_DEFAULT_MODEL } from "@/lib/model-utils";
import { ToolManagerDialog } from "@/components/shared/tool_editor/tool-manager-dialog";
import { ReportHeader } from "@/components/report/report-header";
import { TagSelectedDialog } from "@/components/shared/tag-selected-dialog";
import { getCachedUserTags } from "@/lib/indexed-db";
import { AutoReevalDialog } from "@/components/report/auto-reeval-dialog";

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
  const [autoReevalDialogOpen, setAutoReevalDialogOpen] = useState(false);

  const handleAutoReevaluate = async (
    trialNumbers?: number[],
    referenceExamples?: Array<{
      attack: string;
      response: string;
      reasoning: string;
    }>,
  ) => {
    setIsAutoReevaluating(true);
    const toastId = toast.loading(
      trialNumbers
        ? `Auto re-evaluating ${trialNumbers.length} selected trial(s)...`
        : "Auto re-evaluating all breached trials...",
    );
    try {
      const bodyObj: Record<string, unknown> = {};
      if (trialNumbers) bodyObj.trialNumbers = trialNumbers;
      if (referenceExamples && referenceExamples.length > 0) {
        bodyObj.referenceExamples = referenceExamples;
      }
      const res = await fetch(`/api/scan/${scan.id}/auto-re-evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 402) {
          toast.error(err.message || "Insufficient scan tokens.", {
            id: toastId,
            duration: 6000,
          });
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
      .find(
        (hp) => hp.modelId === (scan.hardenerModel || FALLBACK_DEFAULT_MODEL),
      );
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
        .find(
          (hp) => hp.modelId === (scan.hardenerModel || FALLBACK_DEFAULT_MODEL),
        );
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
  const [scanTokens, setScanTokens] = useState<number | null>(null);

  const [summarizedPatterns, setSummarizedPatterns] = useState<
    string | undefined
  >(() => scan.metadata?.attackSummary?.summarizedPatterns);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [vocabulary, setVocabulary] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        setScanTokens(d.user?.scanTokens ?? 0);
      })
      .catch(() => {});
    // Load vocabulary from IndexedDB cache first
    (async () => {
      try {
        const userRes = await fetch("/api/user");
        const userData = await userRes.json();
        const uid = userData?.user?.id;
        if (uid) {
          const cached = await getCachedUserTags(uid);
          if (cached) {
            setVocabulary(cached);
          }
          // Fallback to API if no cache
          if (!cached) {
            const tagsRes = await fetch("/api/user/tags");
            const tagsData = await tagsRes.json();
            if (tagsData.tags) {
              setVocabulary(tagsData.tags);
            }
          }
        }
      } catch {
        // ignore
      }
    })();
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

  const handleTagConfirm = async (
    addingTagIds: string[],
    removingTagIds: string[],
  ) => {
    const toastId = toast.loading("Updating tags...");
    try {
      const res = await fetch("/api/scans/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanIds: [scan.id],
          tagIds: addingTagIds,
          removeTagIds: removingTagIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update tags");
      }
      toast.success("Tags updated successfully!", { id: toastId });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update tags", { id: toastId });
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
          toast.error(errData.message || "Insufficient scan tokens.", {
            id: toastId,
            duration: 6000,
          });
          return;
        }
        throw new Error(errData.message || "Extraction failed");
      }
      const data = await res.json();
      if (typeof data.scanTokensRemaining === "number") {
        setScanTokens(data.scanTokensRemaining);
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
      <ReportHeader
        scan={scan}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onDelete={() => setDeleteDialogOpen(true)}
        isAutoReevaluating={isAutoReevaluating}
        onOpenAutoReeval={() => setAutoReevalDialogOpen(true)}
        onTag={() => setTagDialogOpen(true)}
      />

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── Summary hero ── */}
        <SummaryHero scan={scan} vocabulary={vocabulary} />

        <Separator />

        {/* ── Scan Summary (defense rate, top vulnerability, agent models) ── */}
        <ScanSummary scan={scan} activeHardenedPrompt={currentHardenedPrompt} />

        <Separator />

        {/* ── 01 Scan Configuration ── */}
        <ScanConfigurationSection
          scan={scan}
          mounted={mounted}
          summarizedPatterns={summarizedPatterns}
          generatingSummary={generatingSummary}
          onGenerateSummary={handleGenerateSummary}
        />

        <Separator />

        {/* ── 02 Hardened Prompt & Tool Recommendations ── */}
        <HardenedPromptSection
          scan={scan}
          selectedHardenedId={selectedHardenedId}
          onModelChange={handleModelChange}
          currentHardenedPrompt={currentHardenedPrompt}
          pickerOpen={pickerOpen}
          onPickerOpenChange={setPickerOpen}
          extracting={extracting}
          onOpenToolManager={handleOpenToolManager}
          onExtractTools={handleExtractTools}
          trace={trace}
          onTraceOpenChange={setTraceOpen}
          activeToolIdx={activeToolIdx}
          setActiveToolIdx={setActiveToolIdx}
          historyModels={historyModels}
        />

        <Separator />

        {/* ── 03 Trial-by-Trial Breakdown ── */}
        <TrialBreakdownSection
          scan={scan}
          breachedCount={breachedCount}
          defendedCount={defendedCount}
          filter={filter}
          onFilterChange={setFilter}
          filteredTrials={filteredTrials}
          onRefresh={onRefresh}
        />

        {/* Report footer */}
        <Separator />
        <ReportFooter />
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
      <TagSelectedDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        vocabulary={vocabulary}
        selectedScanCount={1}
        existingTagIdsPerScan={[
          (scan.tags || []).map((t) => t.split("~")[0]).filter(Boolean),
        ]}
        onConfirm={handleTagConfirm}
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
                      ? "bg-yellow-500/3 border-yellow-500/20"
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
                      <p className="text-slate-200 p-2 rounded bg-emerald-500/4 border border-emerald-500/10 mt-0.5 leading-relaxed">
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

      <AutoReevalDialog
        open={autoReevalDialogOpen}
        onOpenChange={setAutoReevalDialogOpen}
        scan={scan}
        scanTokens={scanTokens ?? 0}
        onConfirm={handleAutoReevaluate}
      />
    </div>
  );
}
