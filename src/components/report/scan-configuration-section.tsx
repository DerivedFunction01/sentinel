import { Ban, Code2, Gavel, Shield, Swords, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { Scan } from "@/lib/types";
import { RestrictionBehavior } from "@/lib/enums";

interface ScanConfigurationSectionProps {
  scan: Scan;
  mounted: boolean;
  summarizedPatterns?: string;
  generatingSummary?: boolean;
  onGenerateSummary?: () => void;
}

function ConfigBlock({
  label,
  icon: Icon,
  badge,
  description,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          {badge && (
            <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function ScanConfigurationSection({
  scan,
  mounted,
  summarizedPatterns,
  generatingSummary,
  onGenerateSummary,
}: ScanConfigurationSectionProps) {
  return (
    <section id="scan-configuration" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          01 — Scan Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What the assistant was asked to protect.
        </p>
      </div>

      <ConfigBlock label="System Prompt" icon={Shield}>
        <CodeHighlight
          code={scan.systemPrompt}
          language="plaintext"
          className="p-4!"
        />
      </ConfigBlock>

      <ConfigBlock
        label="Tools"
        icon={Wrench}
        badge="NEW"
        description="Appended as the tools payload on every Target call via OpenRouter."
      >
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            >
              <span className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-blue-400" />
                {scan.tools.length} tool definitions
              </span>
              <span className="text-xs text-muted-foreground">
                Click to expand
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CodeHighlight
              code={JSON.stringify(scan.tools, null, 2)}
              language="json"
              className="mt-3 p-4! max-h-96 overflow-auto"
            />
          </CollapsibleContent>
        </Collapsible>
      </ConfigBlock>

      <ConfigBlock
        label="Mock Tool Responses"
        icon={Code2}
        badge="NEW"
        description="Returned to the Target when it calls a tool, so the adversarial loop continues realistically."
      >
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            >
              <span className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-purple-400" />
                {Object.keys(scan.mockToolResponses).length} mock responses
              </span>
              <span className="text-xs text-muted-foreground">
                Click to expand
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CodeHighlight
              code={JSON.stringify(scan.mockToolResponses, null, 2)}
              language="json"
              className="mt-3 p-4! max-h-96 overflow-auto"
            />
          </CollapsibleContent>
        </Collapsible>
      </ConfigBlock>

      <ConfigBlock label="Forbidden Task" icon={Ban}>
        <CodeHighlight
          code={scan.forbiddenTask}
          language="plaintext"
          className="p-4!"
        />
      </ConfigBlock>

      <ConfigBlock
        label="Judge Instructions"
        icon={Gavel}
        badge="NEW"
        description="Tells the Judge exactly how to evaluate each response — separate from the forbidden task."
      >
        <CodeHighlight
          code={scan.judgeInstructions}
          language="plaintext"
          className="p-4!"
        />
      </ConfigBlock>

      <ConfigBlock label="Adversarial Coverage" icon={Swords}>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {scan.forbiddenTask || "Forbidden Task"}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-red-500/30 text-red-400 shrink-0 ml-3"
              >
                {scan.breaches} / {scan.totalTrials} breached
              </Badge>
            </div>
          </div>

          {mounted &&
            scan.metadata?.seedExtraction &&
            (() => {
              const seed = scan.metadata.seedExtraction!;
              return (
                <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Seed Extraction
                  </p>
                  <div className="flex flex-col gap-3 text-xs">
                    {seed.personaDescription && (
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Persona</span>
                        <span className="text-foreground font-medium">
                          {seed.personaDescription}
                        </span>
                      </div>
                    )}
                    {seed.businessCategories &&
                      seed.businessCategories.length > 0 && (
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-muted-foreground">
                            Categories
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {seed.businessCategories.map(
                              (cat: string, i: number) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[10px] border-slate-700 text-slate-300 font-normal px-2 py-0"
                                >
                                  {cat}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    {seed.businessFeatures &&
                      seed.businessFeatures.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-muted-foreground block font-semibold text-[11px] uppercase tracking-wider">
                            Features
                          </span>
                          <ul className="list-disc pl-4 space-y-1 text-foreground text-xs leading-relaxed">
                            {seed.businessFeatures.map(
                              (feat: string, i: number) => (
                                <li key={i}>{feat}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                    {seed.things &&
                      seed.things.map(
                        (
                          t: {
                            thingName?: string;
                            thingDescription?: string;
                            thingNameVariants?: string[];
                            thingDescriptionVariants?: string[];
                            credentials?: string[];
                            businessScenarios?: string[];
                            concreteScenarios?: string[];
                            behaviorType?: RestrictionBehavior;
                            ontologySection?: string;
                          },
                          idx: number,
                        ) => (
                          <div
                            key={idx}
                            className="col-span-3 border-t border-white/5 pt-2 mt-2 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-purple-400">
                                Restriction #{idx + 1}: {t.thingName}
                              </p>
                              {t.ontologySection && (
                                <span className="rounded bg-purple-500/25 border border-purple-500/35 px-1.5 py-0.5 text-[9px] font-medium text-purple-300">
                                  Section: {t.ontologySection}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <span className="text-muted-foreground">
                                Description
                              </span>
                              <span className="text-foreground col-span-2">
                                {t.thingDescription}
                              </span>

                              {t.thingNameVariants &&
                                t.thingNameVariants.length > 0 && (
                                  <>
                                    <span className="text-muted-foreground">
                                      Name Variants
                                    </span>
                                    <div className="flex flex-wrap gap-1 col-span-2">
                                      {t.thingNameVariants.map(
                                        (v: string, i: number) => (
                                          <Badge
                                            key={i}
                                            variant="secondary"
                                            className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-normal px-2 py-0"
                                          >
                                            {v}
                                          </Badge>
                                        ),
                                      )}
                                    </div>
                                  </>
                                )}

                              {t.behaviorType && (
                                <>
                                  <span className="text-muted-foreground">
                                    Behavior
                                  </span>
                                  <span className="text-foreground col-span-2 font-mono text-[11px]">
                                    {t.behaviorType}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <span className="text-muted-foreground">
                                Description
                              </span>
                              <span className="text-foreground col-span-2">
                                {t.thingDescription}
                              </span>

                              {t.thingNameVariants &&
                                t.thingNameVariants.length > 0 && (
                                  <>
                                    <span className="text-muted-foreground">
                                      Name Variants
                                    </span>
                                    <div className="flex flex-wrap gap-1 col-span-2">
                                      {t.thingNameVariants.map(
                                        (v: string, i: number) => (
                                          <Badge
                                            key={i}
                                            variant="secondary"
                                            className="text-[10px] bg-slate-900 border-slate-800 text-slate-300 font-normal px-2 py-0"
                                          >
                                            {v}
                                          </Badge>
                                        ),
                                      )}
                                    </div>
                                  </>
                                )}

                              {t.thingDescriptionVariants &&
                                t.thingDescriptionVariants.length > 0 && (
                                  <>
                                    <span className="text-muted-foreground">
                                      Description Variants
                                    </span>
                                    <ul className="list-disc pl-4 space-y-1 col-span-2 text-foreground text-xs">
                                      {t.thingDescriptionVariants.map(
                                        (v: string, i: number) => (
                                          <li key={i}>{v}</li>
                                        ),
                                      )}
                                    </ul>
                                  </>
                                )}

                              {t.credentials && t.credentials.length > 0 && (
                                <>
                                  <span className="text-muted-foreground">
                                    Credentials
                                  </span>
                                  <div className="flex flex-wrap gap-1 col-span-2">
                                    {t.credentials.map(
                                      (cred: string, i: number) => (
                                        <code
                                          key={i}
                                          className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] text-amber-300 font-mono"
                                        >
                                          {cred}
                                        </code>
                                      ),
                                    )}
                                  </div>
                                </>
                              )}

                              {t.businessScenarios &&
                                t.businessScenarios.length > 0 && (
                                  <>
                                    <span className="text-muted-foreground">
                                      Scenarios
                                    </span>
                                    <ul className="list-disc pl-4 space-y-1 col-span-2 text-foreground text-xs">
                                      {t.businessScenarios
                                        .slice(0, 3)
                                        .map((v: string, i: number) => (
                                          <li key={i}>{v}</li>
                                        ))}
                                    </ul>
                                  </>
                                )}

                              {t.concreteScenarios &&
                                t.concreteScenarios.length > 0 && (
                                  <>
                                    <span className="text-muted-foreground">
                                      Concrete Scenarios
                                    </span>
                                    <ul className="list-disc pl-4 space-y-1 col-span-2 text-foreground text-xs">
                                      {t.concreteScenarios.map(
                                        (v: string, i: number) => (
                                          <li key={i}>{v}</li>
                                        ),
                                      )}
                                    </ul>
                                  </>
                                )}
                            </div>
                          </div>
                        ),
                      )}

                    {seed.coreSystemPrompt && (
                      <div className="col-span-3 border-t border-white/5 pt-3 mt-2 space-y-1.5">
                        <span className="text-muted-foreground block font-semibold text-[11px] uppercase tracking-wider">
                          Sanitized Core System Prompt (Judge's View)
                        </span>
                        <pre className="bg-slate-950/70 border border-slate-800/80 p-2.5 rounded text-[11px] text-slate-300 font-mono overflow-auto max-h-[200px] whitespace-pre-wrap leading-relaxed">
                          {seed.coreSystemPrompt}
                        </pre>
                      </div>
                    )}

                    {/* Concrete scenarios are shown per-restriction below */}
                  </div>
                </div>
              );
            })()}

          {summarizedPatterns ? (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
                >
                  <span className="flex items-center gap-2">
                    <Swords className="h-3.5 w-3.5 text-amber-400" />
                    Attack Pattern Summary
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Click to expand
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-lg border border-border bg-muted/5 p-3">
                  <MarkdownRenderer content={summarizedPatterns} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            scan.breaches > 0 && (
              <div className="rounded-lg border border-slate-700/60 bg-slate-800/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <Swords className="h-3.5 w-3.5" />
                    No Attack Pattern Summary
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-lg leading-relaxed">
                    This report has {scan.breaches} successful attacks, but the
                    pattern summary is missing (possibly due to a temporary LLM
                    API failure during scanning).
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGenerateSummary}
                  disabled={generatingSummary}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0 font-medium text-xs"
                >
                  {generatingSummary ? (
                    <>
                      <span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Generating...
                    </>
                  ) : (
                    "Generate Summary"
                  )}
                </Button>
              </div>
            )
          )}
        </div>
      </ConfigBlock>
    </section>
  );
}
