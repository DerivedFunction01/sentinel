"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/components/shared/model-selector";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { Sparkles, Check } from "lucide-react";
import { Granularity } from "@/lib/enums";
import { DEFAULT_MODEL } from "@/lib/model-utils";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface GranularityPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    granularity: Granularity,
    extractorModel: string,
    includeToolRecommendation: boolean,
  ) => void;
  defaultGranularity?: Granularity;
  defaultExtractorModel?: string;
}

export function GranularityPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultGranularity = Granularity.Compact,
  defaultExtractorModel = DEFAULT_MODEL,
}: GranularityPickerDialogProps) {
  const [granularity, setGranularity] =
    useState<Granularity>(defaultGranularity);
  const [extractorModel, setExtractorModel] = useState<string>(
    defaultExtractorModel,
  );
  const [includeToolRecommendation, setIncludeToolRecommendation] =
    useState<boolean>(true);

  const compactCodeSample = `{
  "type": "function",
  "function": {
    "name": "commerce_transactions",
    "description": "Call for discount codes, rebates, loyalty, payment.",
    "parameters": {
      "type": "object",
      "properties": {
        "operation": {
          "type": "string",
          "enum": ["inquiry", "execution"]
        },
        "query": { "type": "string" }
      },
      "required": ["operation", "query"]
    }
  }
}`;

  const detailedCodeSample = `{
  "type": "function",
  "function": {
    "name": "competitor_intelligence",
    "description": "Analysis of competitor offerings and price match.",
    "parameters": {
      "type": "object",
      "properties": {
        "competitor": { "type": "string" },
        "plan_type": { "type": "string" },
        "features_requested": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "required": ["competitor", "plan_type"]
    }
  }
}`;

  const handleConfirm = () => {
    onConfirm(granularity, extractorModel, includeToolRecommendation);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark max-w-2xl border-border bg-slate-900 text-slate-100 p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            Extract Tools from Hardened Prompt
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            Analyze prompt constraints and convert conditional gatekeeper rules
            into structured tool schemas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Toggle for Tool Recommendation */}
          <div className="flex items-center justify-between bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <div className="space-y-0.5">
              <Label
                htmlFor="include-tools"
                className="font-bold text-sm text-foreground cursor-pointer"
              >
                Extract Tool Recommendations
              </Label>
              <p className="text-[11px] text-slate-400 max-w-md">
                Offload conditional business logic to structured tool definitions.
                Uncheck this if you only want to harden the system prompt.
              </p>
            </div>
            <Checkbox
              id="include-tools"
              checked={includeToolRecommendation}
              onCheckedChange={(checked) => setIncludeToolRecommendation(!!checked)}
            />
          </div>

          <div
            className={cn(
              "space-y-6 transition-all duration-200",
              !includeToolRecommendation && "opacity-40 pointer-events-none"
            )}
          >
            {/* Granularity Selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Granularity Mode
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Compact Mode Card */}
                <div
                  onClick={() => setGranularity(Granularity.Compact)}
                  className={`relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all duration-200 bg-slate-950/40 hover:bg-slate-950/60 ${
                    granularity === Granularity.Compact
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "border-slate-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">Compact Mode</span>
                      {granularity === Granularity.Compact && (
                        <span className="rounded-full bg-blue-600/20 p-1">
                          <Check className="h-3 w-3 text-blue-400" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400 mb-3">
                      Best for simple prompts. Consolidates gatekeeper checks into
                      1–3 broad tools with simple parameters.
                    </p>
                  </div>
                  <CodeHighlight
                    code={compactCodeSample}
                    language="json"
                    className="text-[9px] p-2 bg-slate-950/80 border border-slate-850/80 max-h-36 overflow-y-auto select-none"
                  />
                </div>

                {/* Detailed Mode Card */}
                <div
                  onClick={() => setGranularity(Granularity.Detailed)}
                  className={`relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all duration-200 bg-slate-950/40 hover:bg-slate-950/60 ${
                    granularity === Granularity.Detailed
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "border-slate-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">Detailed Mode</span>
                      {granularity === Granularity.Detailed && (
                        <span className="rounded-full bg-blue-600/20 p-1">
                          <Check className="h-3 w-3 text-blue-400" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400 mb-3">
                      Best for complex environments. Creates separate domain tools
                      with rich category enums and specific parameters.
                    </p>
                  </div>
                  <CodeHighlight
                    code={detailedCodeSample}
                    language="json"
                    className="text-[9px] p-2 bg-slate-950/80 border border-slate-850/80 max-h-36 overflow-y-auto select-none"
                  />
                </div>
              </div>
            </div>

            {/* Extractor Model Dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Extraction Model
              </label>
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-2">
                <ModelSelector
                  value={extractorModel}
                  onChange={setExtractorModel}
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  For complex prompts with many rules, choosing a larger reasoning
                  model (e.g., Anthropic Claude or GPT-4o) can yield cleaner, more
                  precise tool schemas.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-800/80 pt-4 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-200"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Generate Recommendation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
