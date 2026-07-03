"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Crosshair,
  Sparkles,
  FileText,
  CheckCircle2,
  Coins,
  Code2,
  Braces,
  Gavel,
  Swords,
  Loader2,
  Copy,
  Plus,
  Trash2,
  Ban,
  Upload,
  Download,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/dashboard-parts";
import { AgentPipeline } from "@/components/shared/agent-pipeline";
import { MultiScanProgress } from "@/components/shared/multi-scan-progress";
import { MultiModelSelector } from "@/components/shared/multi-model-selector";
import { ModelSelector } from "@/components/shared/model-selector";
import { FieldBlock } from "@/components/shared/field-block";
import { PromptFormSection } from "@/components/shared/prompt-form-section";
import { ToolManagerDialog } from "@/components/shared/tool_editor/tool-manager-dialog";
import { toast } from "sonner";
import { DEFAULT_MOCK_RESPONSE, findDefaultModel } from "@/lib/model-utils";
import {
  sampleForbiddenTask,
  sampleJudgeInstructions,
  sampleMockToolResponses,
  sampleSystemPrompt,
  sampleTools,
} from "@/lib/sample-config";
import {
  validateToolsAgainstMocks,
  type ToolValidationResult,
} from "@/lib/scan-validation";
import type { ToolDef, SeedInfo } from "@/lib/types";

/** One prompt's full configuration. */
interface PromptConfig {
  systemPrompt: string;
  forbiddenTask: string;
  tools: string;
  mockResponses: string;
  judgeInstructions: string;
  allowNoToolsFallback: boolean;
  cachedSeedInfo?: SeedInfo;
}

function makeEmptyPrompt(): PromptConfig {
  return {
    systemPrompt: "",
    forbiddenTask: "",
    tools: "",
    mockResponses: "",
    judgeInstructions: "",
    allowNoToolsFallback: false,
    cachedSeedInfo: undefined,
  };
}

function updatePrompt(
  _prompts: PromptConfig[],
  setPrompts: React.Dispatch<React.SetStateAction<PromptConfig[]>>,
  idx: number,
  field: keyof PromptConfig,
  value: any,
) {
  setPrompts((prev) =>
    prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
  );
}

function prettifyJson(
  prompts: PromptConfig[],
  setPrompts: React.Dispatch<React.SetStateAction<PromptConfig[]>>,
  idx: number,
  field: "tools" | "mockResponses",
) {
  const current = prompts[idx][field];
  try {
    const parsed = JSON.parse(current);
    const formatted = JSON.stringify(parsed, null, 2);
    updatePrompt(prompts, setPrompts, idx, field, formatted);
    toast.success("JSON formatted");
  } catch {
    toast.error("Invalid JSON — cannot format");
  }
}

interface ScanConfigFile {
  targetModels: string[];
  targetModel?: string;
  attackerModel?: string;
  judgeModel?: string;
  hardenerModel?: string;
  prompts: PromptConfig[];
}

export default function PenTestScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetModels, setTargetModels] = useState<string[]>([]);
  const [attackerModel, setAttackerModel] = useState<string>("");
  const [judgeModel, setJudgeModel] = useState<string>("");
  const [hardenerModel, setHardenerModel] = useState<string>("");
  const [seedExtractorModel, setSeedExtractorModel] = useState<string>("");
  const [extractorModel, setExtractorModel] = useState<string>("");
  const [showAdvancedModels, setShowAdvancedModels] = useState<boolean>(false);
  const [enableHardening, setEnableHardening] = useState<boolean>(false);
  const [prompts, setPrompts] = useState<PromptConfig[]>([makeEmptyPrompt()]);
  const [launching, setLaunching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [tokens, setTokens] = useState<number | null>(null);

  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchScans, setBatchScans] = useState<
    Array<{ reportId: string; targetModel: string; promptIndex: number }>
  >([]);
  const [scanComplete, setScanComplete] = useState(false);
  const [toolManagerOpen, setToolManagerOpen] = useState(false);
  const [managedPromptIdx, setManagedPromptIdx] = useState<number>(0);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => d.user && setTokens(d.user.scanTokens));
  }, []);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.models && d.models.length > 0) {
          const defaultModelId = findDefaultModel(d.models);
          setTargetModels((prev) =>
            prev.length === 0 ? [defaultModelId] : prev,
          );
          setAttackerModel((prev) => (prev === "" ? defaultModelId : prev));
          setJudgeModel((prev) => (prev === "" ? defaultModelId : prev));
          setHardenerModel((prev) => (prev === "" ? defaultModelId : prev));
          setSeedExtractorModel((prev) =>
            prev === "" ? defaultModelId : prev,
          );
          setExtractorModel((prev) => (prev === "" ? defaultModelId : prev));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const presetStr = localStorage.getItem("ToolRegistry_scan_preset");
    if (presetStr) {
      try {
        const preset = JSON.parse(presetStr);
        if (preset.targetModels) setTargetModels(preset.targetModels);
        if (preset.attackerModel) setAttackerModel(preset.attackerModel);
        if (preset.judgeModel) setJudgeModel(preset.judgeModel);
        if (preset.hardenerModel) setHardenerModel(preset.hardenerModel);
        if (preset.prompts) setPrompts(preset.prompts);

        localStorage.removeItem("ToolRegistry_scan_preset");
        toast.success("Hardened system prompt preset loaded!", {
          description:
            "Review and click 'Launch Agent Scan' to run the new scan.",
        });
      } catch (e) {
        console.error("Failed to parse scan preset", e);
      }
    }
  }, []);

  const handleLaunch = async () => {
    if (targetModels.length === 0) {
      toast.error("Select at least one model");
      return;
    }
    const totalScans = targetModels.length * prompts.length;
    if (tokens !== null && totalScans > tokens) {
      toast.error("Not enough tokens", {
        description: `${targetModels.length} model(s) × ${prompts.length} prompt(s) = ${totalScans} tokens needed, but you have ${tokens}.`,
        action: {
          label: "Get more tokens",
          onClick: () => router.push("/dashboard/billing"),
        },
      });
      return;
    }
    setLaunching(true);
    toast.info("Launching batch scan…", {
      description: `${targetModels.length} model(s) × ${prompts.length} prompt(s) = ${totalScans} scan(s).`,
    });
    try {
      const res = await fetch("/api/scan/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetModels,
          attackerModel,
          judgeModel,
          hardenerModel,
          seedExtractorModel,
          extractorModel,
          prompts,
          enableHardening,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLaunching(false);
        toast.error(data.error || "Scan failed", {
          description: "Request more tokens in Settings if you're out.",
          action: {
            label: "Go to Settings",
            onClick: () => router.push("/dashboard/settings"),
          },
        });
        return;
      }
      setTokens(data.tokensRemaining);
      setBatchId(data.batchId);
      setBatchScans(data.scans);
      setLaunching(false);
      setScanning(true);
      setScanComplete(false);
    } catch {
      setLaunching(false);
      toast.error("Something went wrong");
    }
  };

  const handleScanComplete = () => {
    setScanComplete(true);
    toast.success("All scans complete!", {
      description: `${batchScans.length} scan(s) finished.`,
    });
  };

  const handleViewReports = () => {
    setScanning(false);
    router.push("/dashboard/reports");
  };

  const handleTemplateAttack = async () => {
    setTemplateLoading(true);
    toast.info("Generating template attacks…", {
      description: "9 framing patterns, no API calls needed.",
    });
    try {
      const first = prompts[0];
      const res = await fetch("/api/scan/template-attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetModel: targetModels[0],
          systemPrompt: first.systemPrompt,
          forbiddenTask: first.forbiddenTask,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Template attack failed");
        setTemplateLoading(false);
        return;
      }
      toast.success("Template attack complete!", {
        description: `${data.trialsCreated} trials generated. No tokens consumed.`,
      });
      router.push(`/dashboard/reports/${data.reportId}`);
    } catch {
      setTemplateLoading(false);
      toast.error("Something went wrong");
    }
  };

  const addPrompt = () => {
    setPrompts([...prompts, makeEmptyPrompt()]);
  };

  const removePrompt = (idx: number) => {
    if (prompts.length === 1) return;
    setPrompts(prompts.filter((_, i) => i !== idx));
  };

  const copyFromPrevious = (idx: number) => {
    if (idx === 0) return;
    setPrompts(
      prompts.map((p, i) => (i === idx ? { ...prompts[idx - 1] } : p)),
    );
    toast.success(`Copied configuration from Prompt ${idx}`);
  };

  const handleExport = () => {
    const config: ScanConfigFile = {
      targetModels,
      attackerModel,
      judgeModel,
      hardenerModel,
      prompts,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ToolRegistry-scan-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Configuration saved", {
      description: `${prompts.length} prompt(s) exported to JSON.`,
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ScanConfigFile;
      if (
        !data.prompts ||
        !Array.isArray(data.prompts) ||
        data.prompts.length === 0
      ) {
        toast.error("Invalid config file", {
          description: "The JSON must contain a non-empty 'prompts' array.",
        });
        return;
      }
      if (data.targetModels && Array.isArray(data.targetModels)) {
        setTargetModels(data.targetModels);
      } else if (data.targetModel) {
        setTargetModels([data.targetModel]);
      }
      if (data.attackerModel) setAttackerModel(data.attackerModel);
      if (data.judgeModel) setJudgeModel(data.judgeModel);
      if (data.hardenerModel) setHardenerModel(data.hardenerModel);
      setPrompts(
        data.prompts.map((p) => ({
          systemPrompt: p.systemPrompt ?? "",
          forbiddenTask: p.forbiddenTask ?? "",
          tools: p.tools ?? "[]",
          mockResponses: p.mockResponses ?? "{}",
          judgeInstructions: p.judgeInstructions ?? "",
          allowNoToolsFallback: p.allowNoToolsFallback ?? false,
        })),
      );
      toast.success("Configuration imported", {
        description: `${data.prompts.length} prompt(s) loaded from ${file.name}.`,
      });
    } catch {
      toast.error("Failed to import", {
        description: "The file is not valid JSON.",
      });
    }
    {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openToolManager = (idx: number) => {
    setManagedPromptIdx(idx);
    setToolManagerOpen(true);
  };

  const applyToolChanges = (
    toolsToAdd: any[],
    toolsToRemove: string[],
    localMocks: Record<string, any>,
  ) => {
    const prompt = prompts[managedPromptIdx];
    let currentTools: any[] = [];
    try {
      currentTools = JSON.parse(prompt.tools);
    } catch {
      currentTools = [];
    }

    let currentMocks: any = {};
    try {
      currentMocks = JSON.parse(prompt.mockResponses);
    } catch {
      currentMocks = {};
    }

    for (const name of toolsToRemove) {
      const idx = currentTools.findIndex((t: any) => t.function?.name === name);
      if (idx !== -1) currentTools.splice(idx, 1);
      delete currentMocks[name];
    }

    const keepNames = new Set<string>();
    for (const tool of toolsToAdd) {
      const name = tool.function?.name;
      if (!name) continue;
      const exists = currentTools.some((t: any) => t.function?.name === name);
      if (!exists) currentTools.push(tool);
      keepNames.add(name);
    }

    for (const name of keepNames) {
      if (localMocks[name]) currentMocks[name] = localMocks[name];
    }

    updatePrompt(
      prompts,
      setPrompts,
      managedPromptIdx,
      "tools",
      JSON.stringify(currentTools, null, 2),
    );
    updatePrompt(
      prompts,
      setPrompts,
      managedPromptIdx,
      "mockResponses",
      JSON.stringify(currentMocks, null, 2),
    );
    toast.success("Tools updated");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="PenTest Scan"
        description="A multi-LLM agent tests your system prompt: an Attacker generates adversarial prompts from seed templates, the Target model responds, and a Judge determines if secrets were leaked."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChooseModels
          targetModels={targetModels}
          setTargetModels={setTargetModels}
          attackerModel={attackerModel}
          setAttackerModel={setAttackerModel}
          judgeModel={judgeModel}
          setJudgeModel={setJudgeModel}
          enableHardening={enableHardening}
          hardenerModel={hardenerModel}
          setHardenerModel={setHardenerModel}
          setEnableHardening={setEnableHardening}
          tokens={tokens}
          seedExtractorModel={seedExtractorModel}
          setSeedExtractorModel={setSeedExtractorModel}
          extractorModel={extractorModel}
          setExtractorModel={setExtractorModel}
          showAdvancedModels={showAdvancedModels}
          setShowAdvancedModels={setShowAdvancedModels}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Diagram</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentPipeline />
          </CardContent>
        </Card>
      </div>

      {/* Renders each item through our extracted stable component */}
      <div className="space-y-6">
        {prompts.map((prompt, idx) => (
          <PromptSectionItem
            key={idx}
            prompt={prompt}
            idx={idx}
            prompts={prompts}
            setPrompts={setPrompts}
            copyFromPrevious={copyFromPrevious}
            removePrompt={removePrompt}
            openToolManager={openToolManager}
            seedExtractorModel={seedExtractorModel}
          />
        ))}

        <PromptActionButtons
          addPrompt={addPrompt}
          handleImportClick={handleImportClick}
          handleExport={handleExport}
          fileInputRef={fileInputRef}
          handleImportFile={handleImportFile}
        />
      </div>

      {scanning && batchId ? (
        <MultiScanProgress
          batchId={batchId}
          initialScans={batchScans}
          onComplete={scanComplete ? handleViewReports : handleScanComplete}
        />
      ) : (
        <SingleScanProgress
          tokens={tokens}
          targetModels={targetModels}
          prompts={prompts}
          handleLaunch={handleLaunch}
          launching={launching}
          scanning={scanning}
          handleTemplateAttack={handleTemplateAttack}
          templateLoading={templateLoading}
        />
      )}

      <ToolManagerDialog
        open={toolManagerOpen}
        onOpenChange={setToolManagerOpen}
        onConfirm={applyToolChanges}
        recommendedTools={[]}
        existingTools={(() => {
          try {
            return JSON.parse(prompts[managedPromptIdx]?.tools || "[]");
          } catch {
            return [];
          }
        })()}
        existingMockKeys={(() => {
          try {
            return Object.keys(
              JSON.parse(prompts[managedPromptIdx]?.mockResponses || "{}"),
            );
          } catch {
            return [];
          }
        })()}
        existingMocks={(() => {
          try {
            return JSON.parse(prompts[managedPromptIdx]?.mockResponses || "{}");
          } catch {
            return {};
          }
        })()}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <FileText className="h-5 w-5 shrink-0 text-blue-400" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Multi-LLM Agent Pipeline
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Paste your system prompt and select target models. The
                ToolRegistry multi-agent workflow uses adversarial attack
                prompts, tests them against the target, and has a Judge
                determine if secrets leaked. Run up as many prompts in parallel
                across multiple models — use "Copy from" to test variations of
                the same prompt.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tool calls are simulated with mock responses
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Extracted item component preventing the Rules of Hooks exception */
function PromptSectionItem({
  prompt,
  idx,
  prompts,
  setPrompts,
  copyFromPrevious,
  removePrompt,
  openToolManager,
  seedExtractorModel,
}: {
  prompt: PromptConfig;
  idx: number;
  prompts: PromptConfig[];
  setPrompts: React.Dispatch<React.SetStateAction<PromptConfig[]>>;
  copyFromPrevious: (idx: number) => void;
  removePrompt: (idx: number) => void;
  openToolManager: (idx: number) => void;
  seedExtractorModel: string;
}) {
  const handleChange = (field: keyof PromptConfig, value: any) => {
    console.log(
      "[scan/page.tsx] handleChange calling updatePrompt:",
      field,
      value,
    );
    updatePrompt(prompts, setPrompts, idx, field, value);
  };

  const handleUseSample = (field: keyof PromptConfig) => {
    const sampleMap: Partial<Record<keyof PromptConfig, string>> = {
      systemPrompt: sampleSystemPrompt,
      forbiddenTask: sampleForbiddenTask,
      judgeInstructions: sampleJudgeInstructions,
      tools: JSON.stringify(sampleTools, null, 2),
      mockResponses: JSON.stringify(sampleMockToolResponses, null, 2),
    };
    const sample = sampleMap[field];
    if (sample) {
      updatePrompt(prompts, setPrompts, idx, field, sample);
      toast.success(`Sample ${field} loaded`);
    }
  };

  const prettifyTools = () => prettifyJson(prompts, setPrompts, idx, "tools");
  const prettifyMocks = () =>
    prettifyJson(prompts, setPrompts, idx, "mockResponses");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              Prompt {idx + 1}
            </CardTitle>
            <CardDescription>
              Configure the system prompt, tools, mock responses, and judge
              instructions for this prompt.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {idx > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => copyFromPrevious(idx)}
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy from {idx}
              </Button>
            )}
            {prompts.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-400 hover:text-red-500"
                onClick={() => removePrompt(idx)}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <PromptFormSection
          values={prompt}
          onChange={handleChange}
          onUseSample={handleUseSample}
          options={{
            showCharCount: true,
            showToolManager: true,
            onOpenToolManager: () => openToolManager(idx),
            showPrettify: true,
            onPrettifyTools: prettifyTools,
            onPrettifyMocks: prettifyMocks,
            extractorModel: seedExtractorModel,
          }}
        />
      </CardContent>
    </Card>
  );
}

function SingleScanProgress({
  tokens,
  targetModels,
  prompts,
  handleLaunch,
  launching,
  scanning,
  handleTemplateAttack,
  templateLoading,
}: {
  tokens: number | null;
  targetModels: string[];
  prompts: PromptConfig[];
  handleLaunch: () => Promise<void>;
  launching: boolean;
  scanning: boolean;
  handleTemplateAttack: () => Promise<void>;
  templateLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
            <Coins className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {tokens ?? "..."} tokens remaining
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {targetModels.length} model
                {targetModels.length !== 1 ? "s" : ""}
              </span>{" "}
              ×{" "}
              <span className="font-semibold text-foreground">
                {prompts.length} prompt{prompts.length !== 1 ? "s" : ""}
              </span>{" "}
              ={" "}
              <span className="font-semibold text-amber-400">
                {targetModels.length * prompts.length} token
                {targetModels.length * prompts.length !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleLaunch}
            disabled={
              launching || scanning || tokens === 0 || targetModels.length === 0
            }
            className="bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {launching || scanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agent Running...
              </>
            ) : (
              <>
                <Crosshair className="mr-2 h-4 w-4" />
                Launch Agent Scan
              </>
            )}
          </Button>
          <Button
            onClick={handleTemplateAttack}
            disabled={templateLoading}
            variant="outline"
            size="lg"
            className="border-blue-500/40 text-blue-400 hover:bg-blue-600/10"
          >
            {templateLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run Template Attack
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PromptActionButtons({
  addPrompt,
  handleImportClick,
  handleExport,
  fileInputRef,
  handleImportFile,
}: {
  addPrompt: () => void;
  handleImportClick: () => void;
  handleExport: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1 border-dashed border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
          onClick={addPrompt}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Prompt
        </Button>
        <Button
          variant="outline"
          className="sm:w-auto border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
          onClick={handleImportClick}
        >
          <Upload className="mr-2 h-4 w-4" />
          Import from File
        </Button>
        <Button
          variant="outline"
          className="sm:w-auto border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
          onClick={handleExport}
        >
          <Download className="mr-2 h-4 w-4" />
          Save to File
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        className="hidden"
      />
    </>
  );
}

function ChooseModels({
  targetModels,
  setTargetModels,
  attackerModel,
  setAttackerModel,
  judgeModel,
  setJudgeModel,
  enableHardening,
  hardenerModel,
  setHardenerModel,
  setEnableHardening,
  tokens,
  seedExtractorModel,
  setSeedExtractorModel,
  extractorModel,
  setExtractorModel,
  showAdvancedModels,
  setShowAdvancedModels,
}: {
  targetModels: string[];
  setTargetModels: (models: string[]) => void;
  attackerModel: string;
  setAttackerModel: (model: string) => void;
  judgeModel: string;
  setJudgeModel: (model: string) => void;
  enableHardening: boolean;
  hardenerModel: string;
  setHardenerModel: (model: string) => void;
  setEnableHardening: (enabled: boolean) => void;
  tokens: number | null;
  seedExtractorModel: string;
  setSeedExtractorModel: (model: string) => void;
  extractorModel: string;
  setExtractorModel: (model: string) => void;
  showAdvancedModels: boolean;
  setShowAdvancedModels: (show: boolean) => void;
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Models & Tokens</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Target AI Model(s)</Label>
          <MultiModelSelector value={targetModels} onChange={setTargetModels} />
          <p className="text-xs text-muted-foreground">
            Select one or more models to test in parallel.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Swords className="h-3.5 w-3.5 text-red-400" />
            Attacker Model
          </Label>
          <ModelSelector value={attackerModel} onChange={setAttackerModel} />
          <p className="text-xs text-muted-foreground">
            Generates adversarial prompts targeting the forbidden task.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Gavel className="h-3.5 w-3.5 text-emerald-400" />
            Judge Model
          </Label>
          <ModelSelector value={judgeModel} onChange={setJudgeModel} />
          <p className="text-xs text-muted-foreground">
            Evaluates whether the target leaked restricted info.
          </p>
        </div>
        {enableHardening && (
          <>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Hardener Model
              </Label>
              <ModelSelector
                value={hardenerModel}
                onChange={setHardenerModel}
              />
              <p className="text-xs text-muted-foreground">
                Generates a hardened system prompt following the scan.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="enable-hardening"
                  className="text-sm font-medium"
                >
                  Enable Prompt Hardening
                </Label>
                <Switch
                  id="enable-hardening"
                  checked={enableHardening}
                  onCheckedChange={setEnableHardening}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, generates a hardened system prompt after the scan
                completes. Disable to skip hardening and save API costs.
              </p>
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            Tokens Remaining
          </Label>
          <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3">
            <span className="text-lg font-bold text-foreground">
              {tokens ?? "..."}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              scans remaining
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Each scan consumes 1 token. Request more in Settings.
          </p>
        </div>

        {/* Advanced Options Toggle */}
        <div className="col-span-full border-t border-white/5 pt-4 mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 h-7"
            onClick={() => setShowAdvancedModels(!showAdvancedModels)}
          >
            {showAdvancedModels
              ? "Hide Advanced Options"
              : "Show Advanced Options"}
          </Button>

          {showAdvancedModels && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4 pt-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  Seed Extractor Model
                </Label>
                <ModelSelector
                  value={seedExtractorModel}
                  onChange={setSeedExtractorModel}
                />
                <p className="text-[10px] text-muted-foreground">
                  Custom model used to auto-suggest forbidden tasks and analyze
                  prompt ontologies.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Braces className="h-3.5 w-3.5 text-purple-400" />
                  Tool Extractor Model
                </Label>
                <ModelSelector
                  value={extractorModel}
                  onChange={setExtractorModel}
                />
                <p className="text-[10px] text-muted-foreground">
                  Custom model used to extract tools and analyze mock responses
                  during hardening.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
