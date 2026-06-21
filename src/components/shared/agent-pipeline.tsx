"use client";

import { Target, Shield, Gavel, Sparkles } from "lucide-react";

export function AgentPipeline() {
  const agents = [
    {
      icon: Target,
      title: "Attacker LLM",
      desc: "Uses seed templates to generate adversarial attack prompts",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
    {
      icon: Shield,
      title: "Target Model",
      desc: "Receives the attack prompt with your system prompt",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      icon: Gavel,
      title: "Judge LLM",
      desc: "Determines if the attack successfully leaked secrets",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      icon: Sparkles,
      title: "Hardener LLM",
      desc: "Optimizes system prompts and extracts tool recommendations",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {agents.map((agent) => (
        <div
          key={agent.title}
          className={`rounded-xl border ${agent.border} ${agent.bg} p-4 flex flex-col`}
        >
          <div className="mb-2 flex items-center gap-2">
            <agent.icon className={`h-5 w-5 ${agent.color}`} />
            <h4 className="text-sm font-semibold text-foreground">
              {agent.title}
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground flex-1">
            {agent.desc}
          </p>
        </div>
      ))}
    </div>
  );
}
