"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Scan, Trial } from "@/lib/types";
import { ScanSummary } from "@/components/shared/scan-summary";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { GranularityPickerDialog } from "@/components/shared/granularity-picker-dialog";
import { ModelSelector } from "@/components/shared/model-selector";

interface ReportViewProps {
  scan: Scan;
}

export function ReportView({ scan }: ReportViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<TrialFilter>(TrialFilter.All);

  const [selectedHardenedModel, setSelectedHardenedModel] = useState<string>(
    () => {
      const active = scan.hardenedPrompts.find(
        (hp) =>
          hp.modelId === (scan.hardenerModel || "google/gemini-2.5-flash"),
      );
      return (
        active?.modelId ||
        scan.hardenedPrompts[0]?.modelId ||
        "google/gemini-2.5-flash"
      );
    },
  );

  const [currentHardenedPrompt, setCurrentHardenedPrompt] = useState<any>(
    () => {
      const active = scan.hardenedPrompts.find(
        (hp) =>
          hp.modelId === (scan.hardenerModel || "google/gemini-2.5-flash"),
      );
      return active || scan.hardenedPrompts[0] || null;
    },
  );

  const [historyModels, setHistoryModels] = useState<any[]>(
    () => scan.hardenedPrompts || [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const handleModelChange = (modelId: string) => {
    setSelectedHardenedModel(modelId);
    const cached = historyModels.find((hm) => hm.modelId === modelId);
    setCurrentHardenedPrompt(cached || null);
  };

  const handleExtractTools = async (
    granularity: "compact" | "detailed",
    extractorModel: string,
  ) => {
    if (!selectedHardenedModel) return;

    setExtracting(true);
    const toastId = toast.loading(
      "Analyzing prompt for tool recommendations...",
    );
    try {
      const res = await fetch(`/api/scan/${scan.id}/harden`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedHardenedModel,
          granularity,
          extractorModel,
        }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      const newPrompt = {
        modelId: data.modelId,
        modelName: data.modelName,
        prompt: data.hardenedPrompt,
        toolRecommendation: data.toolRecommendation,
        compatibilityScore: data.compatibilityScore,
        granularity: data.granularity,
        extractorModel: data.extractorModel,
      };

      setCurrentHardenedPrompt(newPrompt);
      setSelectedHardenedModel(data.modelId);

      // Update historyModels
      setHistoryModels((prev) => {
        const exists = prev.some((hp) => hp.modelId === data.modelId);
        if (exists) {
          return prev.map((hp) =>
            hp.modelId === data.modelId ? newPrompt : hp,
          );
        } else {
          return [...prev, newPrompt];
        }
      });

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
    localStorage.setItem("sentinelprompt_scan_preset", JSON.stringify(preset));
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

  return (
    <div className="min-h-screen bg-background">
      {/* Report header bar */}
      {ReportHeader(scan)}

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── Summary hero ── */}
        {summaryHero(scan)}

        <Separator />

        {/* ── Scan Summary (defense rate, top vulnerability, agent models) ── */}
        <ScanSummary scan={scan} activeHardenedPrompt={currentHardenedPrompt} />

        <Separator />

        {/* ── 01 Scan Configuration ── */}
        {scanConfiguration(scan)}

        <Separator />

        {/* ── 02 Hardened Prompt & Tool Recommendations ── */}
        {hardenedPrompt(
          selectedHardenedModel,
          handleModelChange,
          currentHardenedPrompt,
          setPickerOpen,
          extracting,
          handleApplyToConfig,
          pickerOpen,
          handleExtractTools,
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
        )}

        {/* Report footer */}
        <Separator />
        <div className="flex items-center justify-between pb-8 text-xs text-muted-foreground">
          <span>SentinelPrompt · Security Insights Report · Confidential</span>
        </div>
      </div>
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
  );
}

function hardenedPrompt(
  selectedHardenedModel: string,
  handleModelChange: (modelId: string) => void,
  currentHardenedPrompt: any,
  setPickerOpen,
  extracting: boolean,
  handleApplyToConfig: () => void,
  pickerOpen: boolean,
  handleExtractTools: (
    granularity: "compact" | "detailed",
    extractorModel: string,
  ) => Promise<void>,
) {
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
                Model:
              </span>
              <ModelSelector
                value={selectedHardenedModel}
                onChange={handleModelChange}
              />
            </div>
          </div>

          {currentHardenedPrompt ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={extracting}
              className="border-blue-500/40 text-blue-400 hover:bg-blue-600/10 text-xs shrink-0 self-start md:self-auto"
            >
              {currentHardenedPrompt.toolRecommendation
                ? "Re-extract Tools"
                : "Extract Tools to Schema"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={extracting}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs shrink-0 self-start md:self-auto"
            >
              Harden Model
            </Button>
          )}
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
                className="!p-4 max-h-[300px] overflow-y-auto border border-white/5 rounded-lg"
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
                    {currentHardenedPrompt.toolRecommendation.tools?.map(
                      (recTool: any, idx: number) => {
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
                          `Tool ${idx + 1}`;
                        const toolGranularity =
                          recTool.granularity ||
                          currentHardenedPrompt.granularity ||
                          "compact";
                        const toolRationale =
                          recTool.rationale || "No rationale provided.";

                        const toolJson = recTool.toolJson || recTool;
                        const mockVal =
                          recTool.mockResponse ||
                          currentHardenedPrompt.toolRecommendation
                            .mockToolResponses?.[toolName] ||
                          {};

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-lg bg-slate-950/45 border border-white/5 space-y-3"
                          >
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
                              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/30 p-2.5 rounded border border-white/5 whitespace-pre-wrap">
                                {toolRationale}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-400">
                                  JSON Schema
                                </span>
                                <CodeHighlight
                                  code={JSON.stringify(toolJson, null, 2)}
                                  language="json"
                                  className="text-[10px] p-2.5 max-h-[160px] overflow-y-auto border border-white/5 rounded"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Mock Response
                                </span>
                                <CodeHighlight
                                  code={JSON.stringify(mockVal, null, 2)}
                                  language="json"
                                  className="text-[10px] p-2.5 max-h-[160px] overflow-y-auto border border-white/5 rounded"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  {currentHardenedPrompt.toolRecommendation.tools?.length >
                    0 && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleApplyToConfig}
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
                  Harden Model
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
        defaultGranularity={
          (currentHardenedPrompt?.granularity as any) || "compact"
        }
        defaultExtractorModel={
          currentHardenedPrompt?.extractorModel || "google/gemini-2.5-flash"
        }
      />
    </section>
  );
}

function scanConfiguration(scan: Scan) {
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
          className="!p-4"
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
              className="mt-3 !p-4 max-h-96 overflow-auto"
            />
          </CollapsibleContent>
        </Collapsible>
      </ConfigBlock>

      {/* Forbidden Task */}
      <ConfigBlock label="Forbidden Task" icon={Ban}>
        <CodeHighlight
          code={scan.forbiddenTask}
          language="plaintext"
          className="!p-4"
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
          className="!p-4"
        />
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
          <Badge variant="outline" className="border-red-500/30 text-red-400">
            {scan.breaches} / {scan.totalTrials} breached
          </Badge>
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
  );
}

function ReportHeader(scan: Scan) {
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
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            asChild
          >
            <a
              href={`/api/scan/${scan.id}/export`}
              download
              className="flex items-center text-slate-200 hover:text-white"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </a>
          </Button>
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
