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
  Eye,
  EyeOff,
  Key,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Sliders,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialVerdict } from "@/lib/enums";
import { getVerdictStyle, getJudgeLabelStyle } from "@/lib/risk-utils";
import type { Trial } from "@/lib/types";

import { CodeHighlight } from "@/components/shared/code-highlight";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TrialCardProps {
  trial: Trial;
  scan: any;
  onRefresh?: () => void;
}

export function TrialCard({ trial, scan, onRefresh }: TrialCardProps) {
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
              {trial.toolCalls && trial.toolCalls.length > 0 ? (
                <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400 font-semibold flex items-center gap-1">
                  <Wrench className="h-2.5 w-2.5" />
                  Tool Called ({trial.toolCalls.length})
                </span>
              ) : (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  No Tool Calls
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
            {isBreached ? TrialVerdict.Breached : TrialVerdict.Defended}
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
          {/* Attack (only rendered if no chronological transcript exists to avoid duplicate user prompts) */}
          {(!trial.transcript || trial.transcript.length === 0) && (
            <Section
              icon={Swords}
              label="Attacker — Generated Attack"
              iconColor="text-red-400"
              bgColor="bg-red-500/5"
              borderColor="border-red-500/10"
            >
              <MarkdownRenderer content={trial.attack} />
            </Section>
          )}

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

          {/* Chronological Transcript or Legacy Fallback */}
          {trial.transcript && trial.transcript.length > 0 ? (
            <Section
              icon={Swords}
              label="Chronological Conversation Trace"
              iconColor="text-blue-400"
              bgColor="bg-slate-500/5"
              borderColor="border-slate-500/10"
            >
              <div className="space-y-4">
                {trial.transcript.map((turn, idx) => {
                  if (turn.role === "user") {
                    return (
                      <div key={idx} className="flex flex-col gap-1 border-l-2 border-blue-500/30 pl-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">User / Attack</span>
                        <div className="text-sm text-foreground/90">
                          <MarkdownRenderer content={turn.content || ""} />
                        </div>
                      </div>
                    );
                  }
                  if (turn.role === "assistant") {
                    return (
                      <div key={idx} className="flex flex-col gap-2 border-l-2 border-purple-500/30 pl-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400">Assistant</span>
                        {turn.content && (
                          <div className="text-sm text-foreground/90">
                            <MarkdownRenderer content={turn.content} />
                          </div>
                        )}
                        {turn.toolCalls && turn.toolCalls.length > 0 && (
                          <div className="mt-1 space-y-2">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-purple-400/80">Initiated Tool Calls:</span>
                            {turn.toolCalls.map((tc, tcIdx) => (
                              <div key={tcIdx} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                                <div className="flex items-center gap-2 text-xs">
                                  <Wrench className="h-3.5 w-3.5 text-purple-400" />
                                  <code className="font-mono font-semibold text-purple-400">{tc.name}()</code>
                                </div>
                                <div className="mt-2">
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Arguments</p>
                                  <CodeHighlight
                                    code={JSON.stringify(tc.arguments, null, 2)}
                                    language="json"
                                    className="!p-2 !bg-muted/30 text-[11px]"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (turn.role === "tool") {
                    let formattedContent = String(turn.content);
                    try {
                      if (formattedContent.startsWith("{")) {
                        formattedContent = JSON.stringify(JSON.parse(formattedContent), null, 2);
                      }
                    } catch {}
                    return (
                      <div key={idx} className="flex flex-col gap-1 border-l-2 border-amber-500/30 pl-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Tool Output ({turn.name})</span>
                        <div className="mt-1">
                          <CodeHighlight
                            code={formattedContent}
                            language="json"
                            className="!p-2 !bg-muted/30 text-[11px]"
                          />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </Section>
          ) : (
            <>
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
                <MarkdownRenderer content={trial.response} />
              </Section>
            </>
          )}

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

            <MarkdownRenderer content={trial.judgeVerdict} />
          </Section>

          {/* Interactive Re-evaluation & Override Panel */}
          {onRefresh && scan && (
            <ReevaluationPanel trial={trial} scan={scan} onRefresh={onRefresh} />
          )}
        </div>
      )}
    </div>
  );
}

function ReevaluationPanel({
  trial,
  scan,
  onRefresh,
}: {
  trial: Trial;
  scan: any;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"ai" | "manual">("ai");

  // Manual Override State
  const [manualVerdict, setManualVerdict] = useState<TrialVerdict>(
    trial.verdict === TrialVerdict.Breached ? TrialVerdict.Defended : TrialVerdict.Breached
  );
  const [manualReasoning, setManualReasoning] = useState(
    trial.judgeVerdict || ""
  );
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  // AI Re-evaluation State
  const [selectedRefNums, setSelectedRefNums] = useState<number[]>([]);
  const [isReevaluating, setIsReevaluating] = useState(false);
  const [proposal, setProposal] = useState<{ verdict: TrialVerdict; reasoning: string } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Parse all scan trials to find successfully defended ones (excluding this one)
  let scanTrials: Trial[] = [];
  try {
    scanTrials = typeof scan.trials === "string" ? JSON.parse(scan.trials) : scan.trials || [];
  } catch {}

  const defendedTrials = scanTrials.filter(
    (t) => t.verdict === TrialVerdict.Defended && t.number !== trial.number
  );

  const handleManualOverride = async () => {
    if (!manualReasoning.trim()) {
      toast.error("Please enter reasoning for manual override");
      return;
    }
    setIsSavingOverride(true);
    const toastId = toast.loading("Applying manual override...");
    try {
      const res = await fetch(`/api/scan/${scan.id}/re-evaluate-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialNumber: trial.number,
          manualOverride: {
            verdict: manualVerdict,
            reasoning: manualReasoning,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save manual override");
      }
      toast.success("Manual override applied successfully", { id: toastId });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "An error occurred", { id: toastId });
    } finally {
      setIsSavingOverride(false);
    }
  };

  const handleGenerateProposal = async () => {
    setIsReevaluating(true);
    const toastId = toast.loading("AI judge is re-evaluating the trial...");
    try {
      const res = await fetch(`/api/scan/${scan.id}/re-evaluate-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialNumber: trial.number,
          selectedReferenceNumbers: selectedRefNums,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate AI proposal");
      }
      const data = await res.json();
      setProposal(data.proposal);
      toast.success("Re-evaluation proposal generated!", { id: toastId });
    } catch (e: any) {
      toast.error(e.message || "An error occurred", { id: toastId });
    } finally {
      setIsReevaluating(false);
    }
  };

  const handleConfirmProposal = async () => {
    if (!proposal) return;
    setIsConfirming(true);
    const toastId = toast.loading("Saving re-evaluation verdict...");
    try {
      const res = await fetch(`/api/scan/${scan.id}/confirm-re-evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialNumber: trial.number,
          verdict: proposal.verdict,
          reasoning: proposal.reasoning,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save proposal");
      }
      toast.success("AI re-evaluation proposal accepted and saved!", { id: toastId });
      setProposal(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "An error occurred", { id: toastId });
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleRefNum = (num: number) => {
    setSelectedRefNums((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  return (
    <div className="mt-4 rounded-lg border border-yellow-500/15 bg-yellow-500/[0.02] p-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-yellow-400">
          <Sliders className="h-4 w-4" />
          <span>Verdict & Response Correction Console</span>
        </div>
        <div className="flex rounded-md bg-white/5 p-0.5">
          <button
            onClick={() => { setTab("ai"); setProposal(null); }}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded-sm transition-colors",
              tab === "ai" ? "bg-yellow-500/20 text-yellow-400" : "text-slate-400 hover:text-white"
            )}
          >
            AI Contrastive Re-eval
          </button>
          <button
            onClick={() => setTab("manual")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded-sm transition-colors",
              tab === "manual" ? "bg-yellow-500/20 text-yellow-400" : "text-slate-400 hover:text-white"
            )}
          >
            Manual Override
          </button>
        </div>
      </div>

      {tab === "ai" ? (
        <div className="space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-yellow-500">How it works:</span> Under-performing or overly strict judge evaluations can be re-run with contrastive learning. Select up to 3 successfully defended trials below to serve as "safe reference" examples. The judge LLM will compare this trial to those examples.
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Select Reference Examples ({defendedTrials.length} available)
            </span>
            {defendedTrials.length === 0 ? (
              <div className="text-[11px] text-slate-500 bg-black/20 p-2.5 rounded border border-white/5">
                No successfully defended trials in this scan to use as custom references. Default safe reference templates will be used.
              </div>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-2 pr-1 select-none">
                {defendedTrials.map((t) => {
                  const isChecked = selectedRefNums.includes(t.number);
                  return (
                    <div
                      key={t.number}
                      onClick={() => toggleRefNum(t.number)}
                      className={cn(
                        "flex items-start gap-2.5 p-2 rounded border transition-colors cursor-pointer text-xs",
                        isChecked
                          ? "bg-yellow-500/[0.04] border-yellow-500/30 text-slate-200"
                          : "bg-black/10 border-white/5 text-slate-400 hover:bg-black/25"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {}}
                        className="mt-0.5 pointer-events-none"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-yellow-500/80 mb-0.5">
                          <span>Trial #{t.number} ({t.taskTag || "Standard"})</span>
                        </div>
                        <p className="truncate text-slate-300 font-serif italic">"{t.response}"</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {proposal ? (
            <div className="mt-4 p-3.5 rounded-lg border border-yellow-500/30 bg-yellow-500/[0.04] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-yellow-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Proposed Re-evaluation Result
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                    proposal.verdict === TrialVerdict.Breached
                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                      : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  )}
                >
                  {proposal.verdict}
                </span>
              </div>
              <div className="text-xs text-slate-300 bg-black/40 p-2.5 rounded border border-white/5 max-h-32 overflow-y-auto leading-relaxed">
                {proposal.reasoning}
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-white/10 text-slate-300 hover:text-white hover:bg-white/5 bg-transparent"
                  onClick={() => setProposal(null)}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-yellow-500 text-black hover:bg-yellow-600 font-medium"
                  onClick={handleConfirmProposal}
                  disabled={isConfirming}
                >
                  {isConfirming && <Loader2 className="h-3 w-3 animate-spin mr-1 text-black" />}
                  Accept & Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium flex items-center gap-1.5"
                onClick={handleGenerateProposal}
                disabled={isReevaluating}
              >
                {isReevaluating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Run Re-evaluation Proposal
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-yellow-500">Override Verdict:</span> Directly bypass the LLM judge decisions and force a specific verdict for this trial.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setManualVerdict(TrialVerdict.Defended)}
              className={cn(
                "p-2.5 rounded border text-center transition-all flex flex-col items-center justify-center gap-1",
                manualVerdict === TrialVerdict.Defended
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : "bg-black/10 border-white/5 text-slate-400 hover:bg-black/25"
              )}
            >
              <CircleCheck className="h-4 w-4" />
              <span className="text-xs font-semibold">Force Defended</span>
            </button>
            <button
              onClick={() => setManualVerdict(TrialVerdict.Breached)}
              className={cn(
                "p-2.5 rounded border text-center transition-all flex flex-col items-center justify-center gap-1",
                manualVerdict === TrialVerdict.Breached
                  ? "bg-red-500/10 border-red-500/40 text-red-400"
                  : "bg-black/10 border-white/5 text-slate-400 hover:bg-black/25"
              )}
            >
              <CircleX className="h-4 w-4" />
              <span className="text-xs font-semibold">Force Breached</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override-reason" className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Reasoning / Explanation
            </Label>
            <Textarea
              id="override-reason"
              rows={3}
              placeholder="Provide context or explanation for this manual correction..."
              value={manualReasoning}
              onChange={(e) => setManualReasoning(e.target.value)}
              className="text-xs bg-black/25 border-white/10 focus:border-yellow-500/30"
            />
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium flex items-center gap-1.5"
              onClick={handleManualOverride}
              disabled={isSavingOverride}
            >
              {isSavingOverride && <Loader2 className="h-4 w-4 animate-spin text-black" />}
              Apply Override
            </Button>
          </div>
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
