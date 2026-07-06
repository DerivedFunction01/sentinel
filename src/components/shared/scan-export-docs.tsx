"use client";

import { useState } from "react";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileCode, Layers, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { SECTIONS, SectionId } from "./scan_export_code_samples";

export function ScanExportDocs({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const [mainTab, setMainTab] = useState<"schema" | "python">("schema");
  const [activeSection, setActiveSection] = useState<SectionId>("loading");

  const active = SECTIONS.find((s) => s.id === activeSection);

  const handleCopy = () => {
    if (!active) return;
    navigator.clipboard.writeText(active.code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="rounded-xl border border-white/10 bg-card/40 backdrop-blur-sm text-card-foreground shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-base text-foreground">
                Scan Export Format & Guide
              </h3>
              <p className="text-xs text-muted-foreground">
                Exported scans are saved in JSON Lines (.jsonl.gz) format.
              </p>
            </div>
          </div>

          <div className="flex bg-muted p-1 rounded-lg self-start sm:self-center">
            <button
              onClick={() => setMainTab("schema")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mainTab === "schema"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Schema Reference
            </button>
            <button
              onClick={() => setMainTab("python")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mainTab === "python"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Python Guide
            </button>
          </div>
        </div>

        {mainTab === "schema" ? (
          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Top-Level Fields
              </h4>
              <div className="overflow-x-auto rounded-lg border border-white/5 bg-background/25">
                <table className="min-w-full divide-y divide-white/5 text-xs text-left">
                  <thead className="bg-white/[0.02] text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-2">Field</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Example / Value</th>
                      <th className="px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">id</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2">"cmr5be89t..."</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Prisma cuid primary key</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">reportId</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2">"SP-26-0703-KI53"</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Human-readable scan identifier</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">targetModel</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2">"google/gemini-2.5-flash"</td>
                      <td className="px-4 py-2 font-sans text-slate-300">OpenRouter model ID under evaluation</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">attackerModel</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2">"meta-llama/llama-3.3-70b"</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Model generating adversarial inputs</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">forbiddenTask</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2">"Do not disclose API keys."</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Behavior the model is prohibited from executing</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">totalTrials</td>
                      <td className="px-4 py-2 text-slate-400">integer</td>
                      <td className="px-4 py-2">48</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Number of adversarial trials executed</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">breaches</td>
                      <td className="px-4 py-2 text-slate-400">integer</td>
                      <td className="px-4 py-2">12</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Number of successful breaches identified</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">defendedCount</td>
                      <td className="px-4 py-2 text-slate-400">integer</td>
                      <td className="px-4 py-2">36</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Number of successfully defended trials</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">unknownCount</td>
                      <td className="px-4 py-2 text-slate-400">integer</td>
                      <td className="px-4 py-2">0</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Number of trials with unknown/failed verdicts</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">breachRate</td>
                      <td className="px-4 py-2 text-slate-400">integer</td>
                      <td className="px-4 py-2">25</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Breaches as a percentage of total trials</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">score</td>
                      <td className="px-4 py-2 text-slate-400">integer</td>
                      <td className="px-4 py-2">75</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Security score (typically 100 - breachRate)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">riskLevel</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2">"medium"</td>
                      <td className="px-4 py-2 font-sans text-slate-300">One of: low, medium, high, critical, unknown</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">status</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2">"completed"</td>
                      <td className="px-4 py-2 font-sans text-slate-300">One of: pending, running, completed, failed</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">apiCost</td>
                      <td className="px-4 py-2 text-slate-400">float</td>
                      <td className="px-4 py-2">1.245</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Accumulated API cost in USD</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Trial-Level Fields (inside `trials` array)
              </h4>
              <div className="overflow-x-auto rounded-lg border border-white/5 bg-background/25">
                <table className="min-w-full divide-y divide-white/5 text-xs text-left">
                  <thead className="bg-white/[0.02] text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-2">Field</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">number</td>
                      <td className="px-4 py-2 text-slate-400">integer</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Sequential trial index (1-based)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">verdict</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Trial result classification: BREACHED, DEFENDED, or UNKNOWN</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">attack</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Adversarial payload prompt sent to target model</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">response</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Target model response text</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">judgeVerdict</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Textual reasoning response from the judge LLM</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">taskTag</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Restriction tag/slug corresponding to this trial</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">patternId</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Attack pattern identifier used for this trial</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">entropyLabel</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Level of attack complexity (e.g., Low Entropy)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-blue-300">framingLabel</td>
                      <td className="px-4 py-2 text-slate-400">string</td>
                      <td className="px-4 py-2 font-sans text-slate-300">Framing mechanism (e.g., Abstract, Direct)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 flex-wrap">
                {SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      activeSection === section.id
                        ? "bg-blue-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="gap-2"
                disabled={!active}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>

            {active && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {active.description}
                </p>
                <CodeHighlight
                  code={active.code}
                  language="python"
                  className="bg-zinc-950/60 p-3"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
