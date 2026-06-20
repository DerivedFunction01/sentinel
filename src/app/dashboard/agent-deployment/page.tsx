"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Rocket, Server, GitBranch, Play, Square, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Deployment {
  id: string;
  name: string;
  model: string;
  status: "running" | "stopped";
  url: string;
}

export default function AgentDeploymentPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([
    {
      id: "dep-1",
      name: "Production Scanner",
      model: "anthropic/claude-3.5-haiku",
      status: "running",
      url: "https://agent-1.sentinelprompt.app",
    },
    {
      id: "dep-2",
      name: "Staging Tester",
      model: "deepseek/deepseek-chat",
      status: "stopped",
      url: "https://agent-2.sentinelprompt.app",
    },
  ]);
  const [name, setName] = useState("");
  const [model, setModel] = useState("anthropic/claude-3.5-haiku");
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = async () => {
    if (!name.trim()) {
      toast.error("Enter a deployment name");
      return;
    }
    setDeploying(true);
    toast.info("Deploying agent…");
    // Simulate deployment
    await new Promise((r) => setTimeout(r, 1500));
    const id = `dep-${Date.now()}`;
    const newDep: Deployment = {
      id,
      name: name.trim(),
      model,
      status: "running",
      url: `https://${id}.sentinelprompt.app`,
    };
    setDeployments([newDep, ...deployments]);
    setName("");
    setDeploying(false);
    toast.success("Agent deployed", { description: `${newDep.name} is now running.` });
  };

  const toggleStatus = (id: string) => {
    setDeployments(deployments.map((d) => (d.id === id ? { ...d, status: d.status === "running" ? "stopped" : "running" } : d)));
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/dashboard">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Deployment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deploy and manage persistent scanner agents that monitor your prompts
          continuously. (Mock — deployments are simulated during beta.)
        </p>
      </div>

      {/* Deploy new agent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4 text-blue-400" />
            Deploy New Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Agent Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CI Scanner" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="dark">
                <SelectItem value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku</SelectItem>
                <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                <SelectItem value="deepseek/deepseek-chat">DeepSeek Chat</SelectItem>
                <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleDeploy} disabled={deploying} className="w-full bg-blue-600 hover:bg-blue-700">
              {deploying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Deploy
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active deployments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-blue-400" />
            Active Deployments ({deployments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {deployments.map((dep) => (
              <div key={dep.id} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{dep.name}</span>
                    <Badge variant="outline" className={dep.status === "running" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-muted-foreground/30 bg-muted/20 text-muted-foreground"}>
                      {dep.status === "running" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {dep.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{dep.model}</span>
                    <span className="font-mono">{dep.url}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => toggleStatus(dep.id)}>
                  {dep.status === "running" ? <><Square className="mr-1 h-3.5 w-3.5" />Stop</> : <><Play className="mr-1 h-3.5 w-3.5" />Start</>}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
