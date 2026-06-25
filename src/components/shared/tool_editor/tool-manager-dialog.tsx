"use client";

import { useState, useMemo, useEffect } from "react";
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
  Database,
  Info,
  Plus,
  Sliders,
  Wrench,
  AlertCircle,
} from "lucide-react";
import { Granularity } from "@/lib/enums";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ParameterNode,
  RecursiveParameterEditor,
} from "./recursive-parameter-editor";
import {
  parseSchemaToNodes,
  compileParametersToSchema,
  validateNodes,
} from "./recursive-parameter-compiler";

interface ToolManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (toolsToAdd: any[], toolsToRemove: string[]) => void;
  recommendedTools: any[];
  existingTools: any[];
  existingMockKeys: string[];
  existingMocks?: Record<string, any>;
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

interface ToolEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: any | null;
  mockResponse: any | null;
  onSave: (updatedToolJson: any, updatedMockResponse: any) => void;
}

export function ToolEditorDialog({
  open,
  onOpenChange,
  tool,
  mockResponse,
  onSave,
}: ToolEditorDialogProps) {
  // Core state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parameterNodes, setParameterNodes] = useState<ParameterNode[]>([]);
  const [mockString, setMockString] = useState("{}");
  const [mockError, setMockError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Initialize from tool when dialog opens
  useEffect(() => {
    if (open && tool) {
      const func = tool.function || {};
      setName(func.name || "");
      setDescription(func.description || "");

      // Parse schema into recursive nodes
      const props = func.parameters?.properties || {};
      const requiredList = func.parameters?.required || [];
      const nodes = parseSchemaToNodes(props, requiredList);
      setParameterNodes(nodes);

      console.log("[ToolEditorDialog] init mockResponse:", mockResponse);
      setMockString(JSON.stringify(mockResponse || {}, null, 2));
      setMockError(null);
      setValidationErrors([]);
    }
  }, [open, tool]);

  // Sanitize tool name
  const handleNameChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    setName(sanitized);
  };

  // Validate mock JSON
  const handleMockChange = (val: string) => {
    setMockString(val);
    try {
      if (val.trim() === "") {
        setMockError(null);
        return;
      }
      JSON.parse(val);
      setMockError(null);
    } catch (e: any) {
      setMockError(e.message);
    }
  };

  // Compile recursive nodes to OpenAI schema
  const generatedToolJson = useMemo(() => {
    return compileParametersToSchema(parameterNodes, name, description);
  }, [name, description, parameterNodes]);

  // Validate nodes on change
  useEffect(() => {
    const errors = validateNodes(parameterNodes);
    setValidationErrors(errors);
  }, [parameterNodes]);

  const handleSave = () => {
    if (mockError || validationErrors.length > 0) return;

    let parsedMock = {};
    try {
      parsedMock = mockString.trim() ? JSON.parse(mockString) : {};
    } catch {
      return;
    }

    onSave(generatedToolJson, parsedMock);
    onOpenChange(false);
  };

  const canSave = !mockError && validationErrors.length === 0 && name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark min-3xl  md:min-w-4xl lg:min-w-6xl h-[90vh] flex flex-col p-6 border-border bg-slate-900 text-slate-100 overflow-hidden">
        <DialogHeader className="pb-2 border-b border-slate-800">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-400" />
            Recursive Tool Schema Editor
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Build complex nested schemas with recursive add/remove at each
            level. Full information preservation during nested editing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 py-4 overflow-hidden min-h-0">
          {/* LEFT: EDITOR */}
          <div className="space-y-4 overflow-y-auto pr-2 max-h-full">
            {/* Tool Metadata */}
            <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-blue-400" /> Tool Name
                </label>
                <Input
                  className="h-9 font-mono text-xs bg-slate-900 border-slate-800 text-blue-400 focus-visible:ring-blue-500/30"
                  placeholder="e.g. fetch_system_logs"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-400" /> Description
                </label>
                <Textarea
                  className="text-xs bg-slate-900 border-slate-800 leading-relaxed text-slate-200 focus-visible:ring-blue-500/30 min-h-16"
                  placeholder="Tell the model when and why to use this tool..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Validation Errors
                </div>
                <div className="space-y-1 text-xs text-red-300">
                  {validationErrors.map((error, idx) => (
                    <div key={idx}>• {error}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Recursive Parameter Editor */}
            <RecursiveParameterEditor
              nodes={parameterNodes}
              onChange={setParameterNodes}
              maxDepth={10}
            />
          </div>

          {/* RIGHT: PREVIEW & MOCK */}
          <div className="space-y-4 overflow-y-auto pr-2 max-h-full">
            <Tabs defaultValue="schema" className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border-b border-slate-800">
                <TabsTrigger value="schema" className="text-xs">
                  JSON Schema
                </TabsTrigger>
                <TabsTrigger value="mock" className="text-xs">
                  Mock Response
                </TabsTrigger>
              </TabsList>

              {/* Schema Preview */}
              <TabsContent value="schema" className="flex-1 overflow-hidden">
                <div className="space-y-2 h-full flex flex-col">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-semibold text-slate-400">
                      Generated OpenAI Schema
                    </span>
                    {parameterNodes.length > 0 &&
                      validationErrors.length === 0 && (
                        <div className="flex items-center gap-1 text-green-400 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Valid
                        </div>
                      )}
                  </div>
                  <div className="flex-1 overflow-hidden border border-white/5 rounded">
                    <CodeHighlight
                      code={JSON.stringify(generatedToolJson, null, 2)}
                      language="json"
                      className="text-[9px] h-full overflow-y-auto"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Mock Response */}
              <TabsContent value="mock" className="flex-1 overflow-hidden">
                <div className="space-y-2 h-full flex flex-col">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-semibold text-slate-400">
                      Mock Response (JSON)
                    </span>
                    {mockError && (
                      <div className="flex items-center gap-1 text-red-400 text-[10px]">
                        <AlertCircle className="w-3 h-3" />
                        Invalid JSON
                      </div>
                    )}
                  </div>
                  <Textarea
                    className="flex-1 text-xs font-mono bg-slate-900 border-slate-800 text-slate-200 focus-visible:ring-blue-500/30 resize-none"
                    placeholder='{"key": "value"}'
                    value={mockString}
                    onChange={(e) => handleMockChange(e.target.value)}
                  />
                  {mockError && (
                    <div className="text-[10px] text-red-400 px-2">
                      {mockError}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-slate-800 pt-3 flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs border-slate-700 text-slate-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Save Tool
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  existingMocks = {},
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
  const [editingTool, setEditingTool] = useState<any | null>(null);
  const [editingMock, setEditingMock] = useState<any | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<"recommended" | "current">(
    "recommended",
  );

  // Add localized proxy states to allow edits to mutate the dialog list before applying globally
  const [localRecommended, setLocalRecommended] = useState<any[]>([]);
  const [localExisting, setLocalExisting] = useState<any[]>([]);
  const [localMocks, setLocalMocks] = useState<Record<string, any>>({});

  // Initialize localized copy values when dialog state changes:
  useEffect(() => {
    if (open) {
      setLocalRecommended([...recommendedTools]);
      setLocalExisting([...existingTools]);
      // Synthesize active mock objects list payload maps
      setLocalMocks({});
    }
  }, [open, recommendedTools, existingTools]);

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
    // Filter out only the tools the user checked "Add" on from your editable local state
    const activeToolsToAdd = localRecommended
      .filter((t) => selectedToAdd.has(t.name))
      .map((t) => t.toolJson);

    onConfirm(activeToolsToAdd, toolsToRemove);
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
  const handleToolFormSave = (
    updatedToolJson: any,
    updatedMockResponse: any,
  ) => {
    const targetName = updatedToolJson.function?.name;
    console.log("[ToolManagerDialog] handleToolFormSave:", {
      targetName,
      editingSource,
      editingIndex,
      updatedMockResponse,
    });

    if (editingSource === "recommended") {
      setLocalRecommended((prev) =>
        prev.map((item, idx) =>
          idx === editingIndex
            ? {
                ...item,
                name: targetName,
                toolJson: updatedToolJson,
                mockResponse: updatedMockResponse,
              }
            : item,
        ),
      );
    } else {
      setLocalExisting((prev) =>
        prev.map((item, idx) =>
          idx === editingIndex ? updatedToolJson : item,
        ),
      );
    }

    // Update internal mock dictionary index mapping references
    setLocalMocks((prev) => ({ ...prev, [targetName]: updatedMockResponse }));
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
            setEditingTool,
            setEditingMock,
            setEditingIndex,
            setEditingSource,
            setIsEditorOpen,
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
            existingMocks,
            toggleRemove,
            toggleExpandedRemove,
            setEditingTool,
            setEditingMock,
            setEditingIndex,
            setEditingSource,
            setIsEditorOpen,
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
        <ToolEditorDialog
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          tool={editingTool}
          mockResponse={editingMock}
          onSave={handleToolFormSave}
        />
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
  existingMocks: Record<string, any>,
  toggleRemove: (name: string) => void,
  toggleExpandedRemove: (idx: number) => void,
  setEditingTool: (tool: any) => void,
  setEditingMock: (mock: any) => void,
  setEditingIndex: (index: number) => void,
  setEditingSource: (source: "current" | "recommended") => void,
  setIsEditorOpen: (open: boolean) => void,
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log(
                              "[CurrentTools] opening editor for:",
                              tool.function?.name,
                              "mockResponse:",
                              tool.mockResponse,
                            );
                            setEditingTool(tool.toolJson || tool);
                            setEditingMock(
                              existingMocks[name] || tool.mockResponse || {},
                            );
                            setEditingIndex(idx);
                            setEditingSource("current"); // or "current"
                            setIsEditorOpen(true);
                          }}
                          className="h-7 text-[11px] border-slate-800 text-blue-400 hover:bg-slate-800 px-2 flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3" /> Visual Form Edit
                        </Button>
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
  setEditingTool: (tool: any) => void,
  setEditingMock: (mock: any) => void,
  setEditingIndex: (index: number) => void,
  setEditingSource: (source: "current" | "recommended") => void,
  setIsEditorOpen: (open: boolean) => void,
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              console.log(
                                "[Recommended] opening editor for:",
                                tool.name,
                                "mockResponse:",
                                tool.mockResponse,
                              );
                              setEditingTool(tool.toolJson || tool);
                              setEditingMock(tool.mockResponse || {});
                              setEditingIndex(idx);
                              setEditingSource("recommended"); // or "current"
                              setIsEditorOpen(true);
                            }}
                            className="h-7 text-[11px] border-slate-800 text-blue-400 hover:bg-slate-800 px-2 flex items-center gap-1"
                          >
                            <Wrench className="w-3 h-3" /> Visual Form Edit
                          </Button>
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
