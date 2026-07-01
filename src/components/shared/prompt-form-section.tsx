"use client";

import { memo, useMemo, useState, useEffect } from "react";
import {
  FileText,
  Ban,
  Gavel,
  Braces,
  Code2,
  AlertTriangle,
  CheckCheck,
  Sparkles,
  Copy,
  Trash2,
  Loader2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldBlock } from "@/components/shared/field-block";
import { Textarea } from "@/components/ui/textarea";
import {
  validateToolsAgainstMocks,
  type ToolValidationResult,
} from "@/lib/scan-validation";
import { SeedInfo } from "@/lib/types";

export interface PromptFormSectionValues {
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: string;
  mockResponses: string;
  cachedSeedInfo?: SeedInfo;
}

export interface PromptFormSectionOptions {
  /** Show character count on system prompt and forbidden task. Default: false */
  showCharCount?: boolean;
  /** Show "Copy from previous" button in top-right. Default: false */
  showCopyFromPrevious?: boolean;
  onCopyFromPrevious?: () => void;
  /** Show "Remove" button in top-right. Default: false */
  showRemove?: boolean;
  onRemove?: () => void;
  /** Show "Manage tools" button next to tools textarea. Default: false */
  showToolManager?: boolean;
  onOpenToolManager?: () => void;
  /** Show "Prettify" buttons for Tools and Mock Responses. Default: false */
  showPrettify?: boolean;
  /** Called when "Prettify" is clicked for tools. Default: prettify in-place. */
  onPrettifyTools?: () => void;
  /** Called when "Prettify" is clicked for mock responses. Default: prettify in-place. */
  onPrettifyMocks?: () => void;
  /** Optional label rendered above the section (e.g. "Prompt 1"). Default: none. */
  label?: string;
  /** Optional description below the label. Default: none. */
  description?: string;
  /** Extra action buttons rendered in the top-right (e.g. copy/remove). */
  extraActions?: React.ReactNode;
  /** Custom model to use for seed extraction suggestions. */
  extractorModel?: string;
}

export interface PromptFormSectionProps {
  values: PromptFormSectionValues;
  onChange: (field: keyof PromptFormSectionValues, value: any) => void;
  onUseSample?: (field: keyof PromptFormSectionValues) => void;
  options?: PromptFormSectionOptions;
}

function prettifyField(
  values: PromptFormSectionValues,
  onChange: (field: keyof PromptFormSectionValues, value: string) => void,
  field: "tools" | "mockResponses",
) {
  try {
    const parsed = JSON.parse(values[field]);
    onChange(field, JSON.stringify(parsed, null, 2));
  } catch {
    // silent — invalid JSON can't be prettified
  }
}

export const PromptFormSection = memo(function PromptFormSection({
  values,
  onChange,
  onUseSample,
  options = {},
}: PromptFormSectionProps) {
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [cachedConfig, setCachedConfig] = useState<{
    systemPrompt: string;
    tools: string;
    mockResponses: string;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("seed_extractor_last_config");
      if (stored) {
        setCachedConfig(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleAiSuggest = async () => {
    if (!values.systemPrompt.trim()) {
      alert("Please enter a System Prompt first so the AI can analyze it.");
      return;
    }
    setAiSuggestLoading(true);
    console.log("[AI Suggest] Triggering API call with values:", {
      systemPrompt: values.systemPrompt,
      tools: values.tools,
      mockResponses: values.mockResponses,
    });
    try {
      await getForbiddenTaskFast(values, options, onChange, setCachedConfig);
    } catch (err) {
      console.error("[AI Suggest] Error in fetch workflow:", err);
      alert("An error occurred while analyzing the prompt.");
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const promptChangedSinceExtraction = useMemo(() => {
    if (!cachedConfig) return false;
    // Only warn if forbiddenTask is populated (indicating we have some configuration already set)
    if (!values.forbiddenTask.trim()) return false;
    return (
      cachedConfig.systemPrompt !== values.systemPrompt ||
      cachedConfig.tools !== values.tools ||
      cachedConfig.mockResponses !== values.mockResponses
    );
  }, [
    cachedConfig,
    values.systemPrompt,
    values.tools,
    values.mockResponses,
    values.forbiddenTask,
  ]);

  const validation: ToolValidationResult = useMemo(
    () => validateToolsAgainstMocks(values.tools, values.mockResponses),
    [values.tools, values.mockResponses],
  );

  const handlePopulateMocks = () => {
    const populated: Record<string, unknown> = {};
    for (const name of validation.missingMockResponses) {
      populated[name] = {};
    }
    const currentMocks =
      values.mockResponses.trim() === ""
        ? {}
        : JSON.parse(values.mockResponses);
    const updated = { ...currentMocks, ...populated };
    onChange("mockResponses", JSON.stringify(updated, null, 2));
  };

  return (
    <div className="space-y-6">
      {options.label && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {options.label}
            </h3>
            {options.description && (
              <p className="text-sm text-muted-foreground">
                {options.description}
              </p>
            )}
          </div>
          {(options.showCopyFromPrevious ||
            options.showRemove ||
            options.extraActions) && (
            <div className="flex items-center gap-2 shrink-0">
              {options.showCopyFromPrevious && options.onCopyFromPrevious && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={options.onCopyFromPrevious}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy from previous
                </Button>
              )}
              {options.showRemove && options.onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-400 hover:text-red-500"
                  onClick={options.onRemove}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remove
                </Button>
              )}
              {options.extraActions}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          <FieldBlock
            icon={FileText}
            title="System Prompt"
            value={values.systemPrompt}
            onChange={(v) => onChange("systemPrompt", v)}
            placeholder="Paste your system prompt here."
            minHeight="min-h-40"
            monospace
            showCharCount={options.showCharCount}
            onUseSample={
              onUseSample ? () => onUseSample("systemPrompt") : undefined
            }
          />
          <FieldBlock
            icon={Gavel}
            title="Judge Instructions"
            badge="NEW"
            description="How the Judge evaluates each response — separate from the forbidden task."
            value={values.judgeInstructions}
            onChange={(v) => onChange("judgeInstructions", v)}
            placeholder="e.g. Only mark LEAKED if the forbidden content appears verbatim in the response."
            minHeight="min-h-32"
            onUseSample={
              onUseSample ? () => onUseSample("judgeInstructions") : undefined
            }
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <FieldBlock
            icon={Ban}
            title="Forbidden Tasks / Constraints"
            description="The constraints or guidelines the agent must not breach. List multiple constraints separated by a blank line. AI will auto-classify, match categories, and group forbidden tasks on scan launch."
            value={values.forbiddenTask}
            onChange={(v) => onChange("forbiddenTask", v)}
            placeholder="e.g.\nConstraint 1: Never disclose internal routing numbers.\n\nConstraint 2: Never authorize wire transfers."
            minHeight="min-h-32"
            showCharCount={options.showCharCount}
            onUseSample={
              onUseSample ? () => onUseSample("forbiddenTask") : undefined
            }
            onAiSuggest={handleAiSuggest}
            aiSuggestLoading={aiSuggestLoading}
          />

          {/* Tools (JSON) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Braces className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-foreground">
                  Tools (JSON)
                </span>
                <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  NEW
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {onUseSample && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUseSample("tools")}
                    className="h-7 text-xs text-slate-400 hover:text-white"
                  >
                    Use sample
                  </Button>
                )}
                {options.showToolManager && options.onOpenToolManager && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={options.onOpenToolManager}
                    className="h-7 text-xs text-slate-400 hover:text-white"
                  >
                    Manage tools
                  </Button>
                )}
                {options.showPrettify && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={
                      options.onPrettifyTools
                        ? options.onPrettifyTools
                        : () => prettifyField(values, onChange, "tools")
                    }
                    className="h-7 text-xs text-slate-400 hover:text-white"
                  >
                    <Code2 className="mr-1 h-3 w-3" />
                    Prettify
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              OpenRouter tool definitions, appended as the tools payload on
              every Target call.
            </p>
            <Textarea
              value={values.tools}
              onChange={(e) => onChange("tools", e.target.value)}
              placeholder='[{"type":"function","function":{"name":"..."}}]'
              className="font-mono text-xs min-h-40 max-h-80 overflow-y-auto"
            />
          </div>

          {/* Validation banner */}
          <ToolValidationBanner
            result={validation}
            onPopulateMocks={handlePopulateMocks}
          />

          {/* AI Suggest Out-of-Sync Warning */}
          {promptChangedSinceExtraction && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-200">
                      AI Suggest guidelines may be out of date
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      The system prompt, tools, or mock responses have changed
                      since the last AI suggest execution. The current forbidden
                      tasks might not match the new configuration.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-amber-500/35 hover:bg-amber-950/20 text-amber-300 hover:text-amber-200 shrink-0"
                  onClick={handleAiSuggest}
                  disabled={aiSuggestLoading}
                >
                  {aiSuggestLoading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="mr-1 h-3 w-3" />
                  )}
                  {aiSuggestLoading ? "Analyzing..." : "Update Suggestion"}
                </Button>
              </div>
            </div>
          )}

          {/* Mock Tool Responses (JSON) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-foreground">
                  Mock Tool Responses (JSON)
                </span>
                <span className="rounded bg-purple-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  NEW
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {onUseSample && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUseSample("mockResponses")}
                    className="h-7 text-xs text-slate-400 hover:text-white"
                  >
                    Use sample
                  </Button>
                )}
                {options.showPrettify && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={
                      options.onPrettifyMocks
                        ? options.onPrettifyMocks
                        : () => prettifyField(values, onChange, "mockResponses")
                    }
                    className="h-7 text-xs text-slate-400 hover:text-white"
                  >
                    <Code2 className="mr-1 h-3 w-3" />
                    Prettify
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Returned to the Target when it calls a tool, so the loop continues
              realistically.
            </p>
            <Textarea
              value={values.mockResponses}
              onChange={(e) => onChange("mockResponses", e.target.value)}
              placeholder='{"tool_name": {"mock_result": "..."}}'
              className="font-mono text-xs min-h-32 max-h-80 overflow-y-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

async function getForbiddenTaskFast(
  values: PromptFormSectionValues,
  options: PromptFormSectionOptions,
  onChange: (field: keyof PromptFormSectionValues, value: any) => void,
  setCachedConfig,
) {
  const res = await fetch("/api/scan/fast-suggest-forbidden", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt: values.systemPrompt,
      extractorModel: options.extractorModel,
    }),
  });
  const data = await res.json();
  console.log("[AI Suggest] API response data:", data);

  if (data.success && data.forbiddenTasks) {
    console.log("[AI Suggest] Updating forbiddenTask to:", data.forbiddenTasks);
    onChange("forbiddenTask", data.forbiddenTasks);
    // Clear cachedSeedInfo so that launching the scan triggers dynamic full extraction on the backend
    onChange("cachedSeedInfo", undefined);

    const newConfig = {
      systemPrompt: values.systemPrompt,
      tools: values.tools,
      mockResponses: values.mockResponses,
    };
    console.log("[AI Suggest] Saving config to localStorage:", newConfig);
    localStorage.setItem(
      "seed_extractor_last_config",
      JSON.stringify(newConfig),
    );
    setCachedConfig(newConfig);
  } else {
    console.warn(
      "[AI Suggest] API success but no tasks suggested or parsed:",
      data,
    );
    alert("No specific forbidden tasks suggested or parsed.");
  }
}

function ToolValidationBanner({
  result,
  onPopulateMocks,
}: {
  result: ToolValidationResult;
  onPopulateMocks: () => void;
}) {
  if (result.toolsParseError || result.mockResponsesParseError) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div className="space-y-1">
            {result.toolsParseError && (
              <p className="text-xs text-red-300">{result.toolsParseError}</p>
            )}
            {result.mockResponsesParseError && (
              <p className="text-xs text-red-300">
                {result.mockResponsesParseError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (result.isValid) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
        <div className="flex items-center gap-2">
          <CheckCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="text-xs text-emerald-300">
            All tool definitions have matching mock responses.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="space-y-2">
        {result.toolsSchemaErrors.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-200">
              Tool schema issues:
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {result.toolsSchemaErrors.map((err, i) => (
                <li key={i} className="text-xs text-amber-200">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(result.missingMockResponses.length > 0 ||
          result.extraMockResponses.length > 0) && (
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {result.missingMockResponses.length > 0 && (
                <p className="text-xs text-amber-200">
                  Missing mock response for tool
                  {result.missingMockResponses.length > 1 ? "s" : ""}:{" "}
                  <span className="font-mono font-semibold">
                    {result.missingMockResponses.join(", ")}
                  </span>
                </p>
              )}
              {result.extraMockResponses.length > 0 && (
                <p className="text-xs text-amber-200">
                  Mock response keys with no matching tool definition:{" "}
                  <span className="font-mono font-semibold">
                    {result.extraMockResponses.join(", ")}
                  </span>
                </p>
              )}
              <p className="text-xs text-amber-300/80">
                Add the missing tool definitions or remove the extra mock
                response keys to fix.
              </p>
            </div>
            {result.missingMockResponses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPopulateMocks}
                className="shrink-0 border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Auto-populate mocks
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
