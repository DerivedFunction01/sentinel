"use client";

import { useEffect, useRef, useState } from "react";
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
  Loader2,
  Copy,
  Plus,
  Trash2,
  Ban,
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/dashboard/dashboard-parts";
import { AgentPipeline } from "@/components/shared/agent-pipeline";
import { ScanProgressPanel } from "@/components/shared/scan-progress-panel";
import { MultiModelSelector } from "@/components/shared/multi-model-selector";
import { toast } from "sonner";
import {
  sampleForbiddenTask,
  sampleJudgeInstructions,
  sampleMockToolResponses,
  sampleSystemPrompt,
  sampleTools,
} from "@/lib/sample-config";

const TOTAL_STEPS = 78; // 26 trials × 3 stages

/** One prompt's full configuration. */
interface PromptConfig {
  systemPrompt: string;
  forbiddenTask: string;
  tools: string;
  mockResponses: string;
  judgeInstructions: string;
}

function makeDefaultPrompt(): PromptConfig {
  return {
    systemPrompt: "",
    forbiddenTask: "",
    tools: "",
    mockResponses: "",
    judgeInstructions: "",
  };
}

/** Shape of an exported/imported scan config file. */
interface ScanConfigFile {
  targetModels: string[];
  targetModel?: string;
  prompts: PromptConfig[];
}

export default function PenTestScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetModels, setTargetModels] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<PromptConfig[]>([makeDefaultPrompt()]);
  const [launching, setLaunching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [tokens, setTokens] = useState<number | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  // Load the user's token balance from the API.
  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => d.user && setTokens(d.user.scanTokens));
  }, []);

  // Pick the #1 recommended model as the default selection.
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        const recommended = (d.models || []).find((m: { isRecommended: boolean }) => m.isRecommended);
        if (recommended) setTargetModels([recommended.id]);
      })
      .catch(() => { /* keep empty — user can still select manually */ });
  }, []);

  const handleLaunch = async () => {
    if (targetModels.length === 0) {
      toast.error("Select at least one model");
      return;
    }
    const cost = targetModels.length * prompts.length;
    if (tokens !== null && cost > tokens) {
      toast.error("Not enough tokens", {
        description: `${targetModels.length} model(s) × ${prompts.length} prompt(s) = ${cost} tokens needed, but you have ${tokens}.`,
        action: {
          label: "Get more tokens",
          onClick: () => router.push("/dashboard/billing"),
        },
      });
      return;
    }
    setLaunching(true);
    toast.info("Launching agent scan…", {
      description: `${targetModels.length} model(s) × ${prompts.length} prompt(s) = ${cost} scan(s).`,
    });
    try {
      const first = prompts[0];
      const res = await fetch("/api/scan/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetModels,
          systemPrompt: first.systemPrompt,
          forbiddenTask: first.forbiddenTask,
          judgeInstructions: first.judgeInstructions,
          tools: first.tools,
          mockResponses: first.mockResponses,
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
      setReportId(data.reportId);
      setLaunching(false);
      setScanning(true);
    } catch {
      setLaunching(false);
      toast.error("Something went wrong");
    }
  };

  const handleScanComplete = () => {
    setScanning(false);
    toast.success("Scan complete!", {
      description: `${targetModels.length} scan(s) finished.`,
    });
    if (reportId) {
      router.push(`/dashboard/reports/${reportId}`);
    }
  };

  /** Run a template-only attack (no LLM API calls, free). */
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
    setPrompts([...prompts, makeDefaultPrompt()]);
  };

  const removePrompt = (idx: number) => {
    if (prompts.length === 1) return;
    setPrompts(prompts.filter((_, i) => i !== idx));
  };

  const copyFromPrevious = (idx: number) => {
    if (idx === 0) return;
    setPrompts(prompts.map((p, i) => (i === idx ? { ...prompts[idx - 1] } : p)));
    toast.success(`Copied configuration from Prompt ${idx}`);
  };

  const updatePrompt = (idx: number, field: keyof PromptConfig, value: string) => {
    setPrompts(prompts.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  /** Export the current scan configuration to a JSON file. */
  const handleExport = () => {
    const config: ScanConfigFile = { targetModels, prompts };
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinelprompt-scan-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Configuration saved", {
      description: `${prompts.length} prompt(s) exported to JSON.`,
    });
  };

  /** Trigger the hidden file input for import. */
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  /** Parse an imported JSON file and load it into the form. */
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ScanConfigFile;
      if (!data.prompts || !Array.isArray(data.prompts) || data.prompts.length === 0) {
        toast.error("Invalid config file", {
          description: "The JSON must contain a non-empty 'prompts' array.",
        });
        return;
      }
      if (data.targetModels && Array.isArray(data.targetModels)) {
        setTargetModels(data.targetModels);
      } else if (data.targetModel) {
        // Backward compat with old single-model config files.
        setTargetModels([data.targetModel]);
      }
      setPrompts(
        data.prompts.map((p) => ({
          systemPrompt: p.systemPrompt ?? "",
          forbiddenTask: p.forbiddenTask ?? "",
          tools: p.tools ?? "[]",
          mockResponses: p.mockResponses ?? "{}",
          judgeInstructions: p.judgeInstructions ?? "",
        })),
      );
      toast.success("Configuration imported", {
        description: `${data.prompts.length} prompt(s) loaded from ${file.name}.`,
      });
    } catch {
      toast.error("Failed to import", {
        description: "The file is not valid JSON.",
      });
    } finally {
      // Reset the input so the same file can be re-imported.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="PenTest Scan"
        description="A multi-LLM agent tests your system prompt: an Attacker generates adversarial prompts from seed templates, the Target model responds, and a Judge determines if secrets were leaked."
      />

      {/* Top row: Target Model + Tokens (left) | Pipeline Diagram (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Target Model & Tokens</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Target AI Model</Label>
              <MultiModelSelector value={targetModels} onChange={setTargetModels} />
              <p className="text-xs text-muted-foreground">
                Search OpenRouter&apos;s catalog (e.g. &quot;llama&quot;,
                &quot;gemini&quot;, &quot;gpt-4&quot;).
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                Tokens Remaining
              </Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3">
                <span className="text-lg font-bold text-foreground">
                  {tokens ?? "…"}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  scans remaining
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Each scan consumes 1 token. Request more in Settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline diagram */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Diagram</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentPipeline />
          </CardContent>
        </Card>
      </div>

      {/* Prompts */}
      <div className="space-y-6">
        {prompts.map((prompt, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    Prompt {idx + 1}
                  </CardTitle>
                  <CardDescription>
                    Configure the system prompt, tools, mock responses, and
                    judge instructions for this prompt.
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
              {/* 2×2 grid: left = System Prompt + Judge Instructions, right = Forbidden Task + Tools + Mock Responses */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left column */}
                <div className="space-y-6">
                  <FieldBlock
                    icon={FileText}
                    title="System Prompt"
                    value={prompt.systemPrompt}
                    onChange={(v) => updatePrompt(idx, "systemPrompt", v)}
                    placeholder="Paste your system prompt here."
                    minHeight="min-h-40"
                    monospace
                    showCharCount
                    onUseSample={() => {
                      updatePrompt(idx, "systemPrompt", sampleSystemPrompt);
                      toast.success("Sample system prompt loaded");
                    }}
                  />
                  <FieldBlock
                    icon={Gavel}
                    title="Judge Instructions"
                    badge="NEW"
                    description="How the Judge evaluates each response — separate from the forbidden task."
                    value={prompt.judgeInstructions}
                    onChange={(v) => updatePrompt(idx, "judgeInstructions", v)}
                    placeholder="e.g. Only mark LEAKED if the forbidden content appears verbatim in the response."
                    minHeight="min-h-32"
                    onUseSample={() => {
                      updatePrompt(idx, "judgeInstructions", sampleJudgeInstructions);
                      toast.success("Sample judge instructions loaded");
                    }}
                  />
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  <FieldBlock
                    icon={Ban}
                    title="Forbidden Task"
                    value={prompt.forbiddenTask}
                    onChange={(v) => updatePrompt(idx, "forbiddenTask", v)}
                    placeholder="Describe what the AI must never do or reveal."
                    minHeight="min-h-32"
                    showCharCount
                    onUseSample={() => {
                      updatePrompt(idx, "forbiddenTask", sampleForbiddenTask);
                      toast.success("Sample forbidden task loaded");
                    }}
                  />
                  <FieldBlock
                    icon={Braces}
                    title="Tools (JSON)"
                    badge="NEW"
                    description="OpenRouter tool definitions, appended as the tools payload on every Target call."
                    value={prompt.tools}
                    onChange={(v) => updatePrompt(idx, "tools", v)}
                    placeholder='[{"type":"function","function":{"name":"..."}}]'
                    minHeight="min-h-40"
                    monospace
                    onUseSample={() => {
                      updatePrompt(idx, "tools", JSON.stringify(sampleTools, null, 2));
                      toast.success("Sample tools loaded");
                    }}
                  />
                  <FieldBlock
                    icon={Code2}
                    title="Mock Tool Responses (JSON)"
                    badge="NEW"
                    description="Returned to the Target when it calls a tool, so the loop continues realistically."
                    value={prompt.mockResponses}
                    onChange={(v) => updatePrompt(idx, "mockResponses", v)}
                    placeholder='{"tool_name": {"mock_result": "..."}}'
                    minHeight="min-h-32"
                    monospace
                    onUseSample={() => {
                      updatePrompt(idx, "mockResponses", JSON.stringify(sampleMockToolResponses, null, 2));
                      toast.success("Sample mock responses loaded");
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add prompt + import/export buttons */}
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
      </div>

      {/* Launch bar */}
      <Card className={scanning ? "border-blue-500/30" : ""}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
              <Coins className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {tokens ?? "…"} tokens remaining
              </p>
              <p className="text-xs text-muted-foreground">
                {scanning ? (
                  "Scan in progress…"
                ) : (
                  <>
                    <span className="font-semibold text-foreground">
                      {targetModels.length} model{targetModels.length !== 1 ? "s" : ""}
                    </span>{" "}
                    ×{" "}
                    <span className="font-semibold text-foreground">
                      {prompts.length} prompt{prompts.length !== 1 ? "s" : ""}
                    </span>{" "}
                    ={" "}
                    <span className="font-semibold text-amber-400">
                      {targetModels.length * prompts.length} token{targetModels.length * prompts.length !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleLaunch}
              disabled={launching || scanning || tokens === 0 || targetModels.length === 0}
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
        {scanning && (
          <CardContent className="border-t border-border pt-5">
            <ScanProgressPanel
              totalSteps={TOTAL_STEPS}
              onComplete={handleScanComplete}
            />
          </CardContent>
        )}
      </Card>

      {/* Info card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <FileText className="h-5 w-5 shrink-0 text-blue-400" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Multi-LLM Agent Pipeline
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Paste your system prompt and select a target model. The
                SentinelPrompt multi-agent workflow uses adversarial attack
                prompts, tests them against the target, and has a Judge
                determine if secrets leaked. You can test up to 3 prompts in
                parallel — use &quot;Copy from&quot; to test variations of the
                same prompt.
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

/* ── Reusable field block ── */
interface FieldBlockProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  badge?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minHeight: string;
  monospace?: boolean;
  showCharCount?: boolean;
  onUseSample?: () => void;
}

function FieldBlock({
  icon: Icon,
  title,
  description,
  badge,
  value,
  onChange,
  placeholder,
  minHeight,
  monospace,
  showCharCount,
  onUseSample,
}: FieldBlockProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-400" />
          <Label className="text-sm font-semibold">{title}</Label>
          {badge && (
            <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
              {badge}
            </span>
          )}
          {showCharCount && (
            <span className="ml-auto text-xs text-muted-foreground">
              {value.length} chars
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${minHeight} max-h-80 resize-y overflow-y-auto scrollbar-thin ${monospace ? "font-mono text-xs" : "text-xs"}`}
        placeholder={placeholder}
      />
      {onUseSample && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onUseSample}
        >
          <Sparkles className="mr-1 h-3 w-3" />
          Use sample
        </Button>
      )}
    </div>
  );
}
