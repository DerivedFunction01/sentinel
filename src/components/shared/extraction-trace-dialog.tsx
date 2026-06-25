"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CodeHighlight } from "@/components/shared/code-highlight";
import {
  Terminal,
  Database,
  FileText,
  Settings,
  ShieldCheck,
  Sparkles,
  Scissors,
} from "lucide-react";
import type { HardeningTrace } from "@/lib/types";

interface ExtractionTraceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trace: HardeningTrace | null;
}

type TabType =
  | "step0"
  | "attackSummary"
  | "step1"
  | "compaction"
  | "step2"
  | "extraction";

export function ExtractionTraceDialog({
  open,
  onOpenChange,
  trace,
}: ExtractionTraceDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("step0");

  if (!trace) return null;

  const tabs = [
    { id: "step0", name: "Step 0: Inspiration", icon: Database },
    ...(trace.attackSummary
      ? [
          {
            id: "attackSummary",
            name: "Step 0.5: Attack Patterns",
            icon: Sparkles,
          },
        ]
      : []),
    { id: "step1", name: "Step 1: Delegation", icon: FileText },
    ...(trace.compaction
      ? [{ id: "compaction", name: "Step 1.5: Compaction", icon: Scissors }]
      : []),
    { id: "step2", name: "Step 2: Guardrails", icon: ShieldCheck },
    { id: "extraction", name: "Tool Extraction", icon: Terminal },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark min-w-4xl lg:min-w-6xl h-[95vh] flex flex-col p-6 overflow-hidden border-border bg-slate-900 text-slate-100">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Settings className="w-5 h-5 text-blue-400" />
            Hardening & Extraction Execution Trace
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            Inspect the exact prompts, parameters, and outputs generated at each
            step of the pipeline.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Buttons styled like ToolManagerTabs */}
        <div className="flex bg-slate-950/60 border border-slate-800 p-1 rounded-lg mb-4 overflow-x-auto gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 py-1.5 px-3 rounded font-medium text-xs transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? "text-blue-400" : "text-slate-400"}`}
                />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels styled dynamically */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
          {activeTab === "step0" && (
            <div className="space-y-4">
              <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 space-y-2">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Generated Search Criteria
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">Keyword Query:</span>
                    <span className="text-blue-400 font-bold">
                      {trace.step0?.query || "None generated (using fallback)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Search Tags:</span>
                    <span className="text-blue-400 font-bold">
                      {trace.step0?.tags && trace.step0.tags.length > 0
                        ? trace.step0.tags.join(", ")
                        : "None generated"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Retrieved DB Templates
                </h4>
                {trace.step0?.retrievedExamples &&
                trace.step0.retrievedExamples.length > 0 ? (
                  <div className="space-y-4">
                    {trace.step0.retrievedExamples.map(
                      (ex: any, idx: number) => (
                        <div
                          key={idx}
                          className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/20"
                        >
                          <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                            <span className="font-mono text-sm font-bold text-purple-400">
                              {idx + 1}. {ex.name}
                            </span>
                            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 uppercase font-medium border border-white/5">
                              {ex.granularity}
                            </span>
                          </div>
                          <div className="p-4 space-y-3">
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {ex.description}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 font-bold block">
                                  JSON SCHEMA
                                </span>
                                <CodeHighlight
                                  code={JSON.stringify(ex.toolJson, null, 2)}
                                  language="json"
                                  className="text-[9px] p-2.5 max-h-48 overflow-y-auto border border-white/5 rounded"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 font-bold block">
                                  MOCK RESPONSE
                                </span>
                                <CodeHighlight
                                  code={JSON.stringify(
                                    ex.mockResponse,
                                    null,
                                    2,
                                  )}
                                  language="json"
                                  className="text-[9px] p-2.5 max-h-48 overflow-y-auto border border-white/5 rounded"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-6 text-center border border-dashed border-slate-800 bg-slate-950/5 rounded-lg">
                    No relevant template examples retrieved for this task
                    constraint.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "attackSummary" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Attack Summarization Prompt Sent to LLM
                </h4>
                <CodeHighlight
                  code={trace.attackSummary?.promptSent || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Extracted Attack Patterns & Strategies
                </h4>
                <CodeHighlight
                  code={trace.attackSummary?.output || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
            </div>
          )}

          {activeTab === "step1" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Step 1 Prompt Sent to LLM
                </h4>
                <CodeHighlight
                  code={trace.step1?.promptSent || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Step 1 Output: Intermediate System Prompt
                </h4>
                <CodeHighlight
                  code={trace.step1?.outputPrompt || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
            </div>
          )}

          {activeTab === "compaction" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Step 1.5 Compaction Prompt Sent to LLM
                </h4>
                <CodeHighlight
                  code={trace.compaction?.promptSent || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Step 1.5 Output: Compacted System Prompt
                </h4>
                <CodeHighlight
                  code={trace.compaction?.outputPrompt || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
            </div>
          )}

          {activeTab === "step2" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Step 2 Prompt Sent to LLM
                </h4>
                <CodeHighlight
                  code={trace.step2?.promptSent || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Step 2 Output: Final Hardened System Prompt
                </h4>
                <CodeHighlight
                  code={trace.step2?.outputPrompt || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
            </div>
          )}

          {activeTab === "extraction" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Extraction Prompt Sent to LLM
                </h4>
                <CodeHighlight
                  code={trace.toolExtraction?.promptSent || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Raw Recommendation Content Returned
                </h4>
                <CodeHighlight
                  code={trace.toolExtraction?.rawOutput || ""}
                  language="markdown"
                  className="text-[10px] p-2.5 max-h-[250px] overflow-y-auto border border-white/5 rounded"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
