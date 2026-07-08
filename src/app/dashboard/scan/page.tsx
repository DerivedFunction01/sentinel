"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Crosshair,
  Sparkles,
  FileText,
  CheckCircle2,
  Coins,
  Loader2,
  Plus,
  Upload,
  Download,
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
import { PageHeader } from "@/components/dashboard/dashboard-parts";
import { AgentPipeline } from "@/components/shared/agent-pipeline";
import { MultiScanProgress } from "@/components/shared/multi-scan-progress";
import { ChooseModels } from "@/components/shared/choose-models";
import { PromptSectionCard } from "@/components/shared/prompt-section-card";
import { ToolManagerDialog } from "@/components/shared/tool_editor/tool-manager-dialog";
import { CostPreviewWidget } from "@/components/shared/cost-preview-widget";
import type { CostEstimationItem } from "@/components/shared/cost-preview-widget";
import { toast } from "sonner";
import {
  DEFAULT_MOCK_RESPONSE,
  findDefaultModel,
  getMostUsedModelForRole,
  ModelSelectorRole,
} from "@/lib/model-utils";
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

  /** Static template token counts fetched once from the server */
  const [templateTokens, setTemplateTokens] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => d.user && setTokens(d.user.scanTokens));
  }, []);

  useEffect(() => {
    fetch("/api/scan/template-tokens")
      .then((r) => r.json())
      .then(setTemplateTokens)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.models && d.models.length > 0) {
          const fallbackModelId = findDefaultModel(d.models);
          // Use most frequently used model for each role, falling back to system default
          setTargetModels((prev) =>
            prev.length === 0
              ? [
                  getMostUsedModelForRole(
                    ModelSelectorRole.Target,
                    fallbackModelId,
                  ),
                ]
              : prev,
          );
          setAttackerModel((prev) =>
            prev === ""
              ? getMostUsedModelForRole(
                  ModelSelectorRole.Attack,
                  fallbackModelId,
                )
              : prev,
          );
          setJudgeModel((prev) =>
            prev === ""
              ? getMostUsedModelForRole(
                  ModelSelectorRole.Judge,
                  fallbackModelId,
                )
              : prev,
          );
          setHardenerModel((prev) =>
            prev === ""
              ? getMostUsedModelForRole(
                  ModelSelectorRole.Hardener,
                  fallbackModelId,
                )
              : prev,
          );
          setSeedExtractorModel((prev) =>
            prev === ""
              ? getMostUsedModelForRole(
                  ModelSelectorRole.SeedExtractor,
                  fallbackModelId,
                )
              : prev,
          );
          setExtractorModel((prev) =>
            prev === ""
              ? getMostUsedModelForRole(
                  ModelSelectorRole.ToolExtractor,
                  fallbackModelId,
                )
              : prev,
          );
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

/**
    * Build the cost estimation items array for the CostPreviewWidget.
    * Mirrors the logic in calculateUpfrontScanHold but encodes it as
    * generic items so the server does only rate-lookup and multiplication.
    */
   const costItems = useMemo<CostEstimationItem[]>(() => {
     if (!templateTokens || targetModels.length === 0) return [];
     const t = templateTokens;
     const items: CostEstimationItem[] = [];

     // Ontology content is always included: main_agent + general_business + avg domain files
     const ontologyContentTokens =
       (t.mainAgentTokens || 100) +
       (t.generalBusinessTokens || 2000) +
       (t.avgDomainTokens || 1000);

     for (const prompt of prompts) {
        const userContent =
          (prompt.systemPrompt || "") +
          "\n" +
          (prompt.forbiddenTask || "") +
          "\n" +
          (prompt.judgeInstructions || "") +
          "\n" +
          (prompt.tools || "") +
          "\n" +
          (prompt.mockResponses || "");

       // Estimate trial count from forbidden task paragraphs
       // Default to 4 when forbiddenTask is empty (matches the 4-item cap in suggestForbiddenTasks.md)
       let numThings = 4;
       if (prompt.forbiddenTask?.trim()) {
         numThings =
           prompt.forbiddenTask
             .split(/\n\s*\n/)
             .map((s: string) => s.trim())
             .filter(Boolean).length || 1;
       }
       const patternsCount: number = t.patternsCount ?? 20;
       const totalTargetCount = patternsCount * 3;
       const countPerThing = Math.max(
         patternsCount,
         Math.ceil(totalTargetCount / numThings),
       );
       const estimatedTrials = numThings * countPerThing;

       // 1. Seed extraction (prompt input + template overhead + ontology content)
       items.push({
         modelId: seedExtractorModel,
         type: "prompt",
         text: userContent,
         additionalTokens: t.seedTemplate + ontologyContentTokens,
       });
       items.push({
         modelId: seedExtractorModel,
         type: "completion",
         tokensCount: t.seedCompletionBuffer,
       });

       // 2. Attack generation (prompt input + template overhead)
       items.push({
         modelId: attackerModel,
         type: "prompt",
         text: userContent,
         additionalTokens: t.attackGenerator,
       });
       items.push({
         modelId: attackerModel,
         type: "completion",
         tokensCount: t.attackCompletionBuffer,
       });

       // 3. Per target model: target sim + judge eval + re-eval budget
       for (const targetId of targetModels) {
         // Target simulation (estimatedTrials runs)
         items.push({
           modelId: targetId,
           type: "prompt",
           text: userContent,
           additionalTokens: t.targetSimBuffer,
           multiplier: estimatedTrials,
         });
         items.push({
           modelId: targetId,
           type: "completion",
           tokensCount: t.targetCompletionBuffer,
           multiplier: estimatedTrials,
         });

         // Judge evaluation
         items.push({
           modelId: judgeModel,
           type: "prompt",
           text: userContent,
           additionalTokens: t.judge,
           multiplier: estimatedTrials,
         });
         items.push({
           modelId: judgeModel,
           type: "completion",
           tokensCount: t.judgeCompletionBuffer,
           multiplier: estimatedTrials,
         });

         // Re-evaluation budget (5 borderline trials)
         items.push({
           modelId: judgeModel,
           type: "prompt",
           text: userContent,
           additionalTokens: t.judge,
           multiplier: t.reEvalCount ?? 5,
         });
         items.push({
           modelId: judgeModel,
           type: "completion",
           tokensCount: t.reEvalCompletionBuffer,
           multiplier: t.reEvalCount ?? 5,
         });
       }

       // 4. Hardening (if enabled)
       if (enableHardening) {
         items.push({
           modelId: hardenerModel,
           type: "prompt",
           text: userContent,
           additionalTokens: t.optimizationPrompt,
         });
         items.push({
           modelId: hardenerModel,
           type: "completion",
           tokensCount: t.hardenCompletionBuffer,
         });
         items.push({
           modelId: extractorModel,
           type: "prompt",
           text: userContent,
           additionalTokens: t.extractSeedInfo,
         });
         items.push({
           modelId: extractorModel,
           type: "completion",
           tokensCount: t.extractorCompletionBuffer,
         });
       }
     }

     return items;
   }, [
     templateTokens,
     targetModels,
     prompts,
     seedExtractorModel,
     attackerModel,
     judgeModel,
     hardenerModel,
     extractorModel,
     enableHardening,
   ]);

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
      <div className="space-y-6">
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
      </div>
      <div className="space-y-6">
        {prompts.map((prompt, idx) => (
          <PromptSectionCard
            key={idx}
            title={`Prompt ${idx + 1}`}
            description="Configure the system prompt, tools, mock responses, and judge instructions for this prompt."
            values={prompt}
            onChange={(field, value) =>
              updatePrompt(prompts, setPrompts, idx, field, value)
            }
            onUseSample={(field) => {
              if (field === "tools" || field === "mockResponses") {
                updatePrompt(prompts, setPrompts, idx, "tools", JSON.stringify(sampleTools, null, 2));
                updatePrompt(prompts, setPrompts, idx, "mockResponses", JSON.stringify(sampleMockToolResponses, null, 2));
                toast.success("Sample tools & mock responses loaded");
              } else {
                const sampleMap: Partial<Record<keyof PromptConfig, string>> = {
                  systemPrompt: sampleSystemPrompt,
                  forbiddenTask: sampleForbiddenTask,
                  judgeInstructions: sampleJudgeInstructions,
                };
                const sample = sampleMap[field];
                if (sample) {
                  updatePrompt(prompts, setPrompts, idx, field, sample);
                  toast.success(`Sample ${field} loaded`);
                }
              }
            }}
            formOptions={{
              showCharCount: true,
              showToolManager: true,
              onOpenToolManager: () => openToolManager(idx),
              showPrettify: true,
              onPrettifyTools: () =>
                prettifyJson(prompts, setPrompts, idx, "tools"),
              onPrettifyMocks: () =>
                prettifyJson(prompts, setPrompts, idx, "mockResponses"),
              extractorModel: seedExtractorModel,
            }}
            showCopyFromPrevious={idx > 0}
            onCopyFromPrevious={() => copyFromPrevious(idx)}
            copyLabel={`Copy from ${idx}`}
            showRemove={prompts.length > 1}
            onRemove={() => removePrompt(idx)}
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
      <div className="grid grid-cols-2 gap-2">
        <CostPreviewWidget
          items={costItems}
          tokens={tokens}
          label={`${targetModels.length} model${targetModels.length === 1 ? "" : "s"} × ${prompts.length} prompt${prompts.length === 1 ? "" : "s"}`}
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
    </div>
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
