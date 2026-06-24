"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeHighlight } from "@/components/shared/code-highlight";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Layers,
  Code2,
} from "lucide-react";
import { Granularity } from "@/lib/enums";

interface ToolManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (toolsToAdd: any[], toolsToRemove: string[]) => void;
  recommendedTools: any[];
  existingTools: any[];
  existingMockKeys: string[];
}

interface RecommendedTool {
  name: string;
  toolJson: any;
  mockResponse: any;
  rationale?: string;
  granularity?: Granularity;
  replaces?: string;
  compatibilityScore?: number;
}

function parseRecommendedTools(raw: any[]): RecommendedTool[] {
  return raw.map((t) => {
    const name = t.name || t.toolJson?.function?.name || "Unnamed Tool";
    const toolJson = t.toolJson || t;
    const mockResponse = t.mockResponse || {};
    return {
      name,
      toolJson,
      mockResponse,
      rationale: t.rationale,
      granularity: t.granularity,
      replaces: t.replaces,
      compatibilityScore: t.compatibilityScore,
    };
  });
}

export function ToolManagerDialog({
  open,
  onOpenChange,
  onConfirm,
  recommendedTools,
  existingTools,
  existingMockKeys,
}: ToolManagerDialogProps) {
  const parsedRecommended = useMemo(
    () => parseRecommendedTools(recommendedTools),
    [recommendedTools],
  );

  const existingToolNames = useMemo(
    () => existingTools.map((t) => t.function?.name).filter(Boolean),
    [existingTools],
  );

  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(
    new Set(parsedRecommended.map((t) => t.name)),
  );
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(
    new Set(),
  );
  const [expandedAdd, setExpandedAdd] = useState<Set<number>>(new Set());
  const [expandedRemove, setExpandedRemove] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("recommended");

  const toggleAdd = (name: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleRemove = (name: string) => {
    setSelectedToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleExpandedAdd = (idx: number) => {
    setExpandedAdd((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleExpandedRemove = (idx: number) => {
    setExpandedRemove((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAllAdd = () =>
    setSelectedToAdd(new Set(parsedRecommended.map((t) => t.name)));
  const deselectAllAdd = () => setSelectedToAdd(new Set());
  const selectAllRemove = () => setSelectedToRemove(new Set(existingToolNames));
  const deselectAllRemove = () => setSelectedToRemove(new Set());

  const toolsToAdd = parsedRecommended.filter((t) => selectedToAdd.has(t.name));
  const toolsToRemove = Array.from(selectedToRemove);

  const handleConfirm = () => {
    const addPayload = toolsToAdd.map((t) => t.toolJson);
    onConfirm(addPayload, toolsToRemove);
    onOpenChange(false);
  };

  const resetState = () => {
    setSelectedToAdd(new Set(parsedRecommended.map((t) => t.name)));
    setSelectedToRemove(new Set());
    setExpandedAdd(new Set());
    setExpandedRemove(new Set());
    setActiveTab("recommended");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  };

  const scoreColor = (score?: number) => {
    if (score === undefined)
      return "bg-slate-500/15 text-slate-400 border-slate-500/20";
    if (score <= 20)
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    if (score <= 60)
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    return "bg-red-500/15 text-red-400 border-red-500/20";
  };

  const scoreLabel = (score?: number) => {
    if (score === undefined) return "Unknown";
    if (score <= 20) return "Low-risk";
    if (score <= 60) return "Moderate";
    return "High-priority";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dark md:min-w-3xl lg:min-w-5xl border-border bg-slate-900 text-slate-100 p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-400" />
            Manage Tools
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            Choose which recommended tools to add, and which existing tools to
            keep. Removing a tool also removes its mock response.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-4 space-y-4"
        >
          <TabsList className="bg-slate-950/60 border border-slate-800">
            <TabsTrigger
              value="recommended"
              className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white"
            >
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Recommended
              {parsedRecommended.length > 0 && (
                <span className="ml-1.5 rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">
                  {parsedRecommended.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="current"
              className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white"
            >
              <Code2 className="mr-1.5 h-3.5 w-3.5" />
              Current Tools
              {existingToolNames.length > 0 && (
                <span className="ml-1.5 rounded bg-purple-600/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-400">
                  {existingToolNames.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── RECOMMENDED TAB ── */}
          {Recommended(
            parsedRecommended,
            selectedToAdd,
            selectAllAdd,
            deselectAllAdd,
            expandedAdd,
            toggleAdd,
            scoreColor,
            scoreLabel,
            toggleExpandedAdd,
          )}

          {/* ── CURRENT TOOLS TAB ── */}
          {CurrentTools(
            existingToolNames,
            selectedToRemove,
            selectAllRemove,
            deselectAllRemove,
            existingTools,
            expandedRemove,
            existingMockKeys,
            toggleRemove,
            toggleExpandedRemove,
          )}
        </Tabs>

        <DialogFooter className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              Add{" "}
              <span className="font-bold text-foreground">
                {toolsToAdd.length}
              </span>{" "}
              tool
              {toolsToAdd.length !== 1 ? "s" : ""}
              {toolsToRemove.length > 0 && (
                <>
                  {" "}
                  · Remove{" "}
                  <span className="font-bold text-red-400">
                    {toolsToRemove.length}
                  </span>
                </>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CurrentTools(
  existingToolNames: any[],
  selectedToRemove: Set<string>,
  selectAllRemove: () => void,
  deselectAllRemove: () => void,
  existingTools: any[],
  expandedRemove: Set<number>,
  existingMockKeys: string[],
  toggleRemove: (name: string) => void,
  toggleExpandedRemove: (idx: number) => void,
) {
  return (
    <TabsContent value="current" className="space-y-3 mt-0">
      {existingToolNames.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/5 p-6 text-center">
          <p className="text-xs text-slate-400">
            No existing tools in this scan configuration.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {existingToolNames.length - selectedToRemove.size} of{" "}
              {existingToolNames.length} will be kept
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllRemove}
                className="h-7 text-[11px] text-red-400 hover:text-red-300"
              >
                Deselect all (remove all)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAllRemove}
                className="h-7 text-[11px] text-slate-400 hover:text-white"
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {existingTools.map((tool, idx) => {
              const name = tool.function?.name || `tool-${idx}`;
              const isChecked = !selectedToRemove.has(name);
              const isExpanded = expandedRemove.has(idx);
              const hasMock = existingMockKeys.includes(name);
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleRemove(name)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-purple-400 truncate">
                          {name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hasMock && (
                            <span className="rounded bg-purple-600/15 px-1.5 py-0.5 text-[9px] font-medium text-purple-300 border border-purple-600/20">
                              has mock
                            </span>
                          )}
                          {!isChecked && (
                            <span className="rounded bg-red-600/15 px-1.5 py-0.5 text-[9px] font-medium text-red-300 border border-red-600/20 flex items-center gap-1">
                              <Trash2 className="h-3 w-3" />
                              removing
                            </span>
                          )}
                        </div>
                      </div>
                      {tool.function?.description && (
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-400 line-clamp-2">
                          {tool.function.description}
                        </p>
                      )}
                      <div className="mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpandedRemove(idx)}
                          className="h-7 text-[11px] text-slate-400 hover:text-white px-2"
                        >
                          {isExpanded ? (
                            <ChevronDown className="mr-1 h-3 w-3" />
                          ) : (
                            <ChevronRight className="mr-1 h-3 w-3" />
                          )}
                          {isExpanded ? "Hide" : "Show"} definition
                        </Button>
                        {isExpanded && (
                          <div className="mt-2">
                            <CodeHighlight
                              code={JSON.stringify(tool, null, 2)}
                              language="json"
                              className="text-[9px] p-2 max-h-48 overflow-y-auto border border-white/5 rounded"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </TabsContent>
  );
}

function Recommended(
  parsedRecommended: RecommendedTool[],
  selectedToAdd: Set<string>,
  selectAllAdd: () => void,
  deselectAllAdd: () => void,
  expandedAdd: Set<number>,
  toggleAdd: (name: string) => void,
  scoreColor: (
    score?: number,
  ) =>
    | "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
    | "bg-amber-500/15 text-amber-400 border-amber-500/20"
    | "bg-red-500/15 text-red-400 border-red-500/20"
    | "bg-slate-500/15 text-slate-400 border-slate-500/20",
  scoreLabel: (
    score?: number,
  ) => "Unknown" | "Low-risk" | "Moderate" | "High-priority",
  toggleExpandedAdd: (idx: number) => void,
) {
  return (
    <TabsContent value="recommended" className="space-y-3 mt-0">
      {parsedRecommended.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/5 p-6 text-center">
          <p className="text-xs text-slate-400">
            No new tool recommendations to add.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {selectedToAdd.size} of {parsedRecommended.length} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllAdd}
                className="h-7 text-[11px] text-slate-400 hover:text-white"
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAllAdd}
                className="h-7 text-[11px] text-slate-400 hover:text-white"
              >
                Deselect all
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {parsedRecommended.map((tool, idx) => {
              const isChecked = selectedToAdd.has(tool.name);
              const isExpanded = expandedAdd.has(idx);
              const score = tool.compatibilityScore ?? 0;
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleAdd(tool.name)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-blue-400 truncate">
                          {tool.name}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${scoreColor(score)}`}
                        >
                          {scoreLabel(score)} · {score}
                        </span>
                      </div>
                      {tool.rationale && (
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-400 line-clamp-2">
                          {tool.rationale}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpandedAdd(idx)}
                          className="h-7 text-[11px] text-slate-400 hover:text-white px-2"
                        >
                          {isExpanded ? (
                            <ChevronDown className="mr-1 h-3 w-3" />
                          ) : (
                            <ChevronRight className="mr-1 h-3 w-3" />
                          )}
                          {isExpanded ? "Hide" : "Show"} schema & mock
                        </Button>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400">
                              JSON Schema
                            </span>
                            <CodeHighlight
                              code={JSON.stringify(tool.toolJson, null, 2)}
                              language="json"
                              className="text-[9px] p-2 max-h-40 overflow-y-auto border border-white/5 rounded"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400">
                              Mock Response
                            </span>
                            <CodeHighlight
                              code={JSON.stringify(tool.mockResponse, null, 2)}
                              language="json"
                              className="text-[9px] p-2 max-h-40 overflow-y-auto border border-white/5 rounded"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </TabsContent>
  );
}

function Wrench({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
