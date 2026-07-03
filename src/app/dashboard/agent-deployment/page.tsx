"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Rocket,
  Server,
  GitBranch,
  Play,
  Loader2,
  Trash2,
  Copy,
  FileText,
  Gavel,
  Ban,
  Braces,
  Code2,
  ExternalLink,
  CheckCircle2,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelSelector } from "@/components/shared/model-selector";
import { PromptFormSection } from "@/components/shared/prompt-form-section";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { SdkDocs } from "@/components/shared/sdk_docs/sdk-docs";
import { toast } from "sonner";
import {
  DEFAULT_MODEL,
  findDefaultModel,
  getMostUsedModelForRole,
  ModelSelectorRole,
} from "@/lib/model-utils";
import { usePromptForm } from "@/hooks/use-prompt-form";
import { useModelDefaults } from "@/hooks/use-model-defaults";

interface Deployment {
  id: string;
  name: string;
  targetModel: string;
  attackerModel: string;
  judgeModel: string;
  hardenerModel: string;
  seedExtractorModel: string;
  extractorModel: string;
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: string;
  mockToolResponses: string;
  status: string;
  url: string;
  createdAt: string;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
}

export default function AgentDeploymentPage() {
  const router = useRouter();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState(true);
  const [selectedDeployment, setSelectedDeployment] =
    useState<Deployment | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [targetModel, setTargetModel] = useState("");
  const [attackerModel, setAttackerModel] = useState("");
  const [judgeModel, setJudgeModel] = useState("");
  const [hardenerModel, setHardenerModel] = useState("");
  const [seedExtractorModel, setSeedExtractorModel] = useState("");
  const [extractorModel, setExtractorModel] = useState("");
  const [showAdvancedModels, setShowAdvancedModels] = useState(false);

  const promptForm = usePromptForm({ loadSamples: false });
  const { loaded: modelsLoaded } = useModelDefaults();

  // Prettify helpers since the shared PromptFormSection can receive custom callbacks
  const prettifyTools = () => {
    try {
      const parsed = JSON.parse(promptForm.values.tools);
      promptForm.setValue("tools", JSON.stringify(parsed, null, 2));
    } catch {}
  };
  const prettifyMocks = () => {
    try {
      const parsed = JSON.parse(promptForm.values.mockResponses);
      promptForm.setValue("mockResponses", JSON.stringify(parsed, null, 2));
    } catch {}
  };

  const [deploying, setDeploying] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch deployments and api keys
  const fetchDeployments = async () => {
    try {
      const res = await fetch("/api/deployments");
      const data = await res.json();
      if (res.ok && data.deployments) {
        setDeployments(data.deployments);
        if (data.deployments.length > 0 && !selectedDeployment) {
          setSelectedDeployment(data.deployments[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch deployments:", err);
    } finally {
      setLoadingDeployments(false);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      if (res.ok && data.keys) {
        setApiKeys(data.keys);
      }
    } catch (err) {
      console.error("Failed to fetch api keys:", err);
    }
  };

  useEffect(() => {
    fetchDeployments();
    fetchApiKeys();
  }, []);

  // Pick default models on mount when the shared hook signals ready
  useEffect(() => {
    if (!modelsLoaded) return;
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.models && d.models.length > 0) {
          const fallbackModelId = findDefaultModel(d.models);
          // Use most frequently used model for each role, falling back to system default
          setTargetModel((prev) =>
            prev === ""
              ? getMostUsedModelForRole(
                  ModelSelectorRole.Target,
                  fallbackModelId,
                )
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
  }, [modelsLoaded]);

  const handleStartEdit = (dep: Deployment) => {
    setEditingId(dep.id);
    setName(dep.name);
    setTargetModel(dep.targetModel);
    setAttackerModel(dep.attackerModel);
    setJudgeModel(dep.judgeModel);
    setHardenerModel(dep.hardenerModel || "");
    setSeedExtractorModel(dep.seedExtractorModel || "");
    setExtractorModel(dep.extractorModel || "");
    promptForm.setValue("systemPrompt", dep.systemPrompt);
    promptForm.setValue("forbiddenTask", dep.forbiddenTask);
    promptForm.setValue("judgeInstructions", dep.judgeInstructions);
    promptForm.setValue("tools", dep.tools);
    promptForm.setValue("mockResponses", dep.mockToolResponses);
    toast.info(`Editing deployment profile: "${dep.name}"`);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setHardenerModel("");
    setSeedExtractorModel("");
    setExtractorModel("");
    promptForm.reset();
    toast.info("Cancelled editing mode");
  };

  const handleDeploy = async () => {
    if (!name.trim()) {
      toast.error("Enter a deployment name");
      return;
    }

    if (!promptForm.validate()) return;

    setDeploying(true);

    const payload = promptForm.toPayload();

    const sendRequest = async (url: string, method: string, body: any) => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json().then((data) => ({ res, data }));
    };

    try {
      if (editingId) {
        toast.info("Saving changes to deployment profile…");
        const { res, data } = await sendRequest(
          `/api/deployments/${editingId}`,
          "PATCH",
          {
            name: name.trim(),
            targetModel,
            attackerModel,
            judgeModel,
            hardenerModel,
            seedExtractorModel,
            extractorModel,
            ...payload,
          },
        );

        if (!res.ok) {
          toast.error(data.error || "Failed to update deployment");
          return;
        }

        toast.success("Deployment profile updated successfully!");
        setEditingId(null);
        setName("");

        // Refresh list
        const updatedRes = await fetch("/api/deployments");
        const updatedData = await updatedRes.json();
        if (updatedRes.ok && updatedData.deployments) {
          setDeployments(updatedData.deployments);
          const currentDep = updatedData.deployments.find(
            (d: any) => d.id === editingId,
          );
          if (currentDep) setSelectedDeployment(currentDep);
        }
      } else {
        toast.info("Creating deployment profile…");
        const { res, data } = await sendRequest("/api/deployments", "POST", {
          name: name.trim(),
          targetModel,
          attackerModel,
          judgeModel,
          hardenerModel,
          seedExtractorModel,
          extractorModel,
          ...payload,
        });

        if (!res.ok) {
          toast.error(data.error || "Failed to create deployment");
          return;
        }

        toast.success("Deployment profile created successfully!");
        setName("");

        // Refresh list
        const updatedRes = await fetch("/api/deployments");
        const updatedData = await updatedRes.json();
        if (updatedRes.ok && updatedData.deployments) {
          setDeployments(updatedData.deployments);
          const newDep = updatedData.deployments.find(
            (d: any) => d.id === data.deployment.id,
          );
          if (newDep) setSelectedDeployment(newDep);
        }
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeploying(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deployment profile?"))
      return;

    try {
      const res = await fetch(`/api/deployments/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Deployment profile deleted");
        const nextList = deployments.filter((d) => d.id !== id);
        setDeployments(nextList);
        if (selectedDeployment?.id === id) {
          setSelectedDeployment(nextList.length > 0 ? nextList[0] : null);
        }
      } else {
        toast.error("Failed to delete deployment");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleRunScan = async (dep: Deployment) => {
    if (apiKeys.length === 0) {
      toast.error("No active API Key found", {
        description:
          "Generate an API Key in API Integration first to trigger scans programmatically or manually here.",
        action: {
          label: "API Integration",
          onClick: () => router.push("/dashboard/api-integration"),
        },
      });
      return;
    }

    setTriggeringId(dep.id);
    toast.info("Triggering scan via deployment API…");

    try {
      // Find the first key prefix, but since we need the full plain key to trigger,
      // and we only store prefix in DB, we guide them to copy it or we use a simulated trigger.
      // Wait, can we call the trigger API directly? Yes! But we don't have the plain key stored on the server (it's bcrypt hashed).
      // Oh! So to make the manual "Run Scan" button in the UI work, does it need to go through the public API trigger route
      // or can it call a local helper or can we ask them to paste their API key?
      // Wait! If they are logged in, we can just run the scan pipeline on their behalf without an API key!
      // But they want to see it work. Let's make the "Run Scan" button trigger the scan directly on their behalf
      // (which is super convenient), or ask for the API key if not cached.
      // Wait, let's look at how `/api/scan/launch` runs: it uses user session. We can just hit `/api/scan/launch`!
      // But wait, the deployment has specific parameters. We can just send the deployment parameters directly to `/api/scan/launch`!
      // Yes! That is extremely elegant: we can make "Run Scan" call `/api/scan/launch` passing the stored deployment parameters.
      // That way they don't have to provide the API key manually in the browser UI, while still validating the exact execution!
      const res = await fetch("/api/scan/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetModels: [dep.targetModel],
          attackerModel: dep.attackerModel,
          judgeModel: dep.judgeModel,
          hardenerModel: dep.hardenerModel || DEFAULT_MODEL,
          seedExtractorModel: dep.seedExtractorModel || DEFAULT_MODEL,
          extractorModel: dep.extractorModel || DEFAULT_MODEL,
          systemPrompt: dep.systemPrompt,
          forbiddenTask: dep.forbiddenTask,
          judgeInstructions: dep.judgeInstructions,
          tools: dep.tools,
          mockResponses: dep.mockToolResponses,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to trigger scan");
        return;
      }

      toast.success("Scan launched successfully!");
      if (data.reportId) {
        router.push(`/dashboard/reports/${data.reportId}`);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTriggeringId(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const keyPlaceholder =
    apiKeys.length > 0
      ? `sp_live_${apiKeys[0].keyPrefix.replace("sp_live_", "")}...`
      : "YOUR_API_KEY";

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/dashboard">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Agent Deployment
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save scan configuration profiles as deployments and trigger automated
          scans programmatically using your API Key.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Deployments list and integration guide */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-blue-400" />
                Active Profiles ({deployments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDeployments ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : deployments.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No active profiles. Create one using the form.
                </div>
              ) : (
                <div className="space-y-2">
                  {deployments.map((dep) => (
                    <div
                      key={dep.id}
                      onClick={() => setSelectedDeployment(dep)}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors text-left ${
                        selectedDeployment?.id === dep.id
                          ? "border-blue-500/50 bg-blue-500/5"
                          : "border-border bg-muted/10 hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-foreground truncate max-w-[150px]">
                          {dep.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                        >
                          ACTIVE
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {dep.targetModel.split("/").pop()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedDeployment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Play className="h-4 w-4 text-blue-400" />
                  Integration Guide
                </CardTitle>
                <CardDescription className="text-xs">
                  Trigger scans automatically via webhook or terminal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Trigger URL
                  </Label>
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 font-mono text-[10px] text-foreground">
                    <span className="truncate flex-1 select-all">
                      {selectedDeployment.url}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 hover:bg-muted"
                      onClick={() =>
                        copyToClipboard(selectedDeployment.url, "Trigger URL")
                      }
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-muted-foreground">
                      CURL Example
                    </Label>
                    <Link
                      href="/dashboard/api-integration"
                      className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                      Manage API Keys <ExternalLink className="h-2 w-2" />
                    </Link>
                  </div>
                  <div className="relative">
                    <CodeHighlight
                      code={`curl -X POST "${selectedDeployment.url}" \\\n  -H "Authorization: Bearer ${keyPlaceholder}"`}
                      language="bash"
                      className="text-[10px]"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-2 top-2 h-6 w-6 hover:bg-muted"
                      onClick={() =>
                        copyToClipboard(
                          `curl -X POST "${selectedDeployment.url}" \\\n  -H "Authorization: Bearer ${keyPlaceholder}"`,
                          "CURL command",
                        )
                      }
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                    disabled={triggeringId === selectedDeployment.id}
                    onClick={() => handleRunScan(selectedDeployment)}
                  >
                    {triggeringId === selectedDeployment.id ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Run Scan
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted"
                    size="sm"
                    onClick={() => handleStartEdit(selectedDeployment)}
                  >
                    <SettingsIcon className="mr-1.5 h-3.5 w-3.5" />
                    Edit Config
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    size="sm"
                    onClick={() => handleDelete(selectedDeployment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="h-4 w-4 text-blue-400" />
                {editingId
                  ? `Edit Profile: ${deployments.find((d) => d.id === editingId)?.name || ""}`
                  : "Create New Profile"}
              </CardTitle>
              <CardDescription>
                {editingId
                  ? "Update settings and prompt configurations for this profile."
                  : "Define the models, prompts, and options for this deployment profile."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Deployment Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Production Payment Flow"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target AI Model</Label>
                  <ModelSelector
                    value={targetModel}
                    onChange={setTargetModel}
                    role={ModelSelectorRole.Target}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Attacker Model</Label>
                  <ModelSelector
                    value={attackerModel}
                    onChange={setAttackerModel}
                    role={ModelSelectorRole.Attack}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Judge Model</Label>
                  <ModelSelector
                    value={judgeModel}
                    onChange={setJudgeModel}
                    role={ModelSelectorRole.Judge}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hardener Model</Label>
                  <ModelSelector
                    value={hardenerModel}
                    onChange={setHardenerModel}
                    role={ModelSelectorRole.Hardener}
                  />
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <div className="border-t border-white/5 pt-4 mt-2">
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
                        role={ModelSelectorRole.SeedExtractor}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Custom model used to auto-suggest forbidden tasks and
                        analyze prompt ontologies.
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
                        role={ModelSelectorRole.ToolExtractor}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Custom model used to extract tools and analyze mock
                        responses during hardening.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <PromptFormSection
                values={promptForm.values}
                onChange={promptForm.setValue}
                onUseSample={promptForm.loadSample}
                options={{
                  showCharCount: true,
                  showPrettify: true,
                  onPrettifyTools: prettifyTools,
                  onPrettifyMocks: prettifyMocks,
                  extractorModel: seedExtractorModel,
                }}
              />

              <div className="flex justify-end gap-3 pt-4">
                {editingId && (
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={deploying}
                    className="w-full sm:w-auto"
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  onClick={handleDeploy}
                  disabled={deploying}
                  className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                >
                  {deploying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingId ? "Saving Changes..." : "Deploying Profile..."}
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      {editingId ? "Save Changes" : "Create Deployment"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedDeployment && (
        <div className="mt-8 border-t border-border pt-8">
          <SdkDocs
            apiKey={apiKeys.length > 0 ? `${apiKeys[0].keyPrefix}...` : ""}
            deploymentId={selectedDeployment.id}
          />
        </div>
      )}
    </div>
  );
}
