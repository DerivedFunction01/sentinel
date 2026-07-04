import { useState } from "react";
import {
  ChevronDown,
  HelpCircle,
  Layers,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { GranularityPickerDialog } from "@/components/shared/granularity-picker-dialog";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { FALLBACK_DEFAULT_MODEL } from "@/lib/model-utils";
import { Granularity, formatModelName } from "@/lib/enums";
import { HardeningTrace } from "@/lib/types";

interface HardenedPromptSectionProps {
  selectedHardenedId: string;
  onModelChange: (id: string) => void;
  currentHardenedPrompt: any;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  extracting: boolean;
  onOpenToolManager: () => void;
  onExtractTools: (
    hardenerModel: string,
    granularity: Granularity,
    extractorModel: string,
    includeToolRecommendation?: boolean,
  ) => Promise<void>;
  trace: HardeningTrace | null;
  onTraceOpenChange: (open: boolean) => void;
  activeToolIdx: number;
  setActiveToolIdx: React.Dispatch<React.SetStateAction<number>>;
  historyModels: any[];
  scanTokens: number | null;
}

export function HardenedPromptSection({
  selectedHardenedId,
  onModelChange,
  currentHardenedPrompt,
  pickerOpen,
  onPickerOpenChange,
  extracting,
  onOpenToolManager,
  onExtractTools,
  trace,
  onTraceOpenChange,
  activeToolIdx,
  setActiveToolIdx,
  historyModels,
  scanTokens,
}: HardenedPromptSectionProps) {
  const modelVersionCounts = new Map<string, number>();
  for (const hm of historyModels) {
    const key = hm.modelId;
    modelVersionCounts.set(key, (modelVersionCounts.get(key) || 0) + 1);
  }

  const modelVersionIndex = new Map<string, number>();

  const formatDropdownName = (hp: any) => {
    const hardener = hp.modelName || formatModelName(hp.modelId);
    const base =
      !hp.extractorModel || !hp.toolRecommendation
        ? `${hardener} (No Tools)`
        : `${hardener} + ${formatModelName(hp.extractorModel)}`;

    const key = hp.modelId;
    const total = modelVersionCounts.get(key) || 1;
    if (total <= 1) return base;

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
                    onChange={(e) => onModelChange(e.target.value)}
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
                onClick={() => onTraceOpenChange(true)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                View Step Traces
              </Button>
            )}
            {scanTokens !== undefined && (
              <div className="flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-600/10 px-2 py-1 text-[11px] font-semibold text-purple-300">
                <Zap className="h-3 w-3" />
                <span>{scanTokens === null ? "…" : scanTokens} tokens</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPickerOpenChange(true)}
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
                        onClick={onOpenToolManager}
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
                    onClick={() => onPickerOpenChange(true)}
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
                  onClick={() => onPickerOpenChange(true)}
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
        onOpenChange={onPickerOpenChange}
        onConfirm={onExtractTools}
        defaultHardenerModel={selectedHardenedId}
        defaultGranularity={
          (currentHardenedPrompt?.granularity as any) || Granularity.Compact
        }
        defaultExtractorModel={
          currentHardenedPrompt?.extractorModel || FALLBACK_DEFAULT_MODEL
        }
      />
    </section>
  );
}
