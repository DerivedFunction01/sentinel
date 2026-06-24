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
      <DialogContent className="min-w-4xl max-w-6xl h-[95vh] flex flex-col p-6 overflow-hidden bg-background text-foreground">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Settings className="w-5 h-5 text-primary animate-spin-slow" />
            Hardening & Extraction Execution Trace
          </DialogTitle>
          <DialogDescription>
            Inspect the exact prompts, parameters, and outputs generated at each
            step of the pipeline.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Buttons */}
        <div className="flex border-b border-border mb-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
          {activeTab === "step0" && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg border border-border space-y-2">
                <h4 className="font-semibold text-sm text-foreground">
                  Generated Search Criteria
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground block">
                      Keyword Query:
                    </span>
                    <span className="text-primary font-semibold">
                      {trace.step0?.query || "None generated (using fallback)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">
                      Search Tags:
                    </span>
                    <span className="text-primary font-semibold">
                      {trace.step0?.tags && trace.step0.tags.length > 0
                        ? trace.step0.tags.join(", ")
                        : "None generated"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-foreground mb-2">
                  Retrieved DB Templates
                </h4>
                {trace.step0?.retrievedExamples &&
                trace.step0.retrievedExamples.length > 0 ? (
                  <div className="space-y-4">
                    {trace.step0.retrievedExamples.map(
                      (ex: any, idx: number) => (
                        <div
                          key={idx}
                          className="border border-border rounded-lg overflow-hidden"
                        >
                          <div className="bg-secondary px-4 py-2 border-b border-border flex justify-between items-center">
                            <span className="font-semibold text-xs text-foreground">
                              {idx + 1}. {ex.name}
                            </span>
                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                              {ex.granularity}
                            </span>
                          </div>
                          <div className="p-4 space-y-3">
                            <p className="text-xs text-muted-foreground">
                              {ex.description}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <span className="text-[10px] text-muted-foreground font-bold block mb-1">
                                  SCHEMA
                                </span>
                                <CodeHighlight
                                  code={JSON.stringify(ex.toolJson, null, 2)}
                                  language="json"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground font-bold block mb-1">
                                  MOCK RESPONSE
                                </span>
                                <CodeHighlight
                                  code={JSON.stringify(
                                    ex.mockResponse,
                                    null,
                                    2,
                                  )}
                                  language="json"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic p-4 text-center border border-dashed border-border rounded-lg">
                    No relevant template examples retrieved for this task
                    constraint.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "attackSummary" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Attack Summarization Prompt Sent to LLM
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.attackSummary?.promptSent || ""}
                    language="markdown"
                  />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Extracted Attack Patterns & Strategies
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.attackSummary?.output || ""}
                    language="markdown"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "step1" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Step 1 Prompt Sent to LLM
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.step1?.promptSent || ""}
                    language="markdown"
                  />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Step 1 Output: Intermediate System Prompt
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.step1?.outputPrompt || ""}
                    language="markdown"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "compaction" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Step 1.5 Compaction Prompt Sent to LLM
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.compaction?.promptSent || ""}
                    language="markdown"
                  />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Step 1.5 Output: Compacted System Prompt
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.compaction?.outputPrompt || ""}
                    language="markdown"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "step2" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Step 2 Prompt Sent to LLM
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.step2?.promptSent || ""}
                    language="markdown"
                  />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Step 2 Output: Final Hardened System Prompt
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.step2?.outputPrompt || ""}
                    language="markdown"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "extraction" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Extraction Prompt Sent to LLM
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.toolExtraction?.promptSent || ""}
                    language="markdown"
                  />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Raw Recommendation Content Returned
                </h4>
                <div className="max-h-[250px] overflow-y-auto border border-border rounded-lg">
                  <CodeHighlight
                    code={trace.toolExtraction?.rawOutput || ""}
                    language="markdown"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
