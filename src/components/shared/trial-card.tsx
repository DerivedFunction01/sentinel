"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Swords,
  MessageSquareReply,
  Gavel,
  Wrench,
  ArrowRight,
  CircleCheck,
  CircleX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialVerdict } from "@/lib/enums";
import { getVerdictStyle, getJudgeLabelStyle } from "@/lib/risk-utils";
import type { Trial } from "@/lib/types";

import { CodeHighlight } from "@/components/shared/code-highlight";

interface TrialCardProps {
  trial: Trial;
}

export function TrialCard({ trial }: TrialCardProps) {
  const [expanded, setExpanded] = useState(
    trial.verdict === TrialVerdict.Breached,
  );
  const verdictStyle = getVerdictStyle(trial.verdict);
  const judgeStyle = getJudgeLabelStyle(trial.judgeLabel);
  const isBreached = trial.verdict === TrialVerdict.Breached;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background/30",
        isBreached ? "border-red-500/20" : "border-white/5",
      )}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex min-w-0 items-center gap-3">
          {isBreached ? (
            <CircleX className="h-4 w-4 shrink-0 text-red-400" />
          ) : (
            <CircleCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {trial.taskTag || `forbidden_task_1`}
              </span>
              {trial.entropyLabel && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                  {trial.entropyLabel.toLowerCase()}
                </span>
              )}
              {trial.framingLabel && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                  {trial.framingLabel.toLowerCase()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "text-xs font-medium",
              isBreached ? "text-red-400" : "text-emerald-400",
            )}
          >
            {isBreached ? "BREACHED" : "DEFENDED"}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-4 border-t border-white/5 p-4">
          {/* Attack */}
          <Section
            icon={Swords}
            label="Attacker — Generated Attack"
            iconColor="text-red-400"
            bgColor="bg-red-500/5"
            borderColor="border-red-500/10"
          >
            <pre className="whitespace-pre-wrap font-mono text-sm text-white/80">
              {trial.attack}
            </pre>
          </Section>

          {/* Debug Metadata */}
          {(trial.targetThing || trial.seedTemplate) && (
            <Section
              icon={Swords}
              label="Generation Metadata (Debug)"
              iconColor="text-amber-400"
              bgColor="bg-amber-500/5"
              borderColor="border-amber-500/10"
            >
              <div className="space-y-3">
                {trial.targetThing && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Targeted Synonym / Concept
                    </p>
                    <span className="font-mono text-xs text-amber-300">
                      "{trial.targetThing}"
                    </span>
                  </div>
                )}
                {trial.seedTemplate && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Adversarial Seed Template
                    </p>
                    <CodeHighlight
                      code={trial.seedTemplate}
                      language="plaintext"
                      className="!p-2 !bg-muted/30 text-[11px]"
                    />
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Tool calls (if any) */}
          {trial.toolCalls && trial.toolCalls.length > 0 && (
            <Section
              icon={Wrench}
              label="Tool Calls"
              iconColor="text-purple-400"
              bgColor="bg-purple-500/5"
              borderColor="border-purple-500/10"
            >
              <div className="space-y-3">
                {trial.toolCalls.map((tc, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <code className="font-mono font-semibold text-purple-400">
                        {tc.name}()
                      </code>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        mock response returned
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Arguments
                        </p>
                        <CodeHighlight
                          code={JSON.stringify(tc.arguments, null, 2)}
                          language="json"
                          className="!p-2 !bg-muted/30 text-[11px]"
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Mock Response
                        </p>
                        <CodeHighlight
                          code={JSON.stringify(tc.mockResponse, null, 2)}
                          language="json"
                          className="!p-2 !bg-muted/30 text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Response */}
          <Section
            icon={MessageSquareReply}
            label="Target Model — Response"
            iconColor="text-blue-400"
            bgColor="bg-blue-500/5"
            borderColor="border-blue-500/10"
          >
            <pre className="whitespace-pre-wrap font-mono text-sm text-white/80">
              {trial.response}
            </pre>
          </Section>

          {/* Judge verdict */}
          <Section
            icon={Gavel}
            label="Judge — Verdict"
            iconColor={isBreached ? "text-red-400" : "text-emerald-400"}
            bgColor={isBreached ? "bg-red-500/5" : "bg-emerald-500/5"}
            borderColor={
              isBreached ? "border-red-500/10" : "border-emerald-500/10"
            }
          >
            <div className="mb-2">
              <span
                className={cn(
                  "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  judgeStyle.bgClass,
                  judgeStyle.textClass,
                )}
              >
                {judgeStyle.label}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/80">
              {trial.judgeVerdict}
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  iconColor,
  bgColor,
  borderColor,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", iconColor)} />
        <p
          className={cn(
            "text-[10px] font-medium uppercase tracking-wider",
            iconColor,
          )}
        >
          {label}
        </p>
      </div>
      <div className={cn("rounded-md border p-3", bgColor, borderColor)}>
        {children}
      </div>
    </div>
  );
}
