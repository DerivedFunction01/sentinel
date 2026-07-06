"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ModelSelector } from "./model-selector";
import { MultiModelSelector } from "./multi-model-selector";
import { ModelSelectorRole } from "@/lib/model-utils";
import { Swords, Gavel, Sparkles, Braces } from "lucide-react";

export interface ChooseModelsProps {
  multiple?: boolean;
  targetModel?: string;
  setTargetModel?: (model: string) => void;
  targetModels?: string[];
  setTargetModels?: (models: string[]) => void;
  attackerModel: string;
  setAttackerModel: (model: string) => void;
  judgeModel: string;
  setJudgeModel: (model: string) => void;
  hardenerModel: string;
  setHardenerModel: (model: string) => void;
  seedExtractorModel: string;
  setSeedExtractorModel: (model: string) => void;
  extractorModel: string;
  setExtractorModel: (model: string) => void;
  showAdvancedModels: boolean;
  setShowAdvancedModels: (show: boolean) => void;
  enableHardening?: boolean;
  setEnableHardening?: (enabled: boolean) => void;
  tokens?: number | null;
  name?: string;
  setName?: (name: string) => void;
}

export function ChooseModels({
  multiple = true,
  targetModel,
  setTargetModel,
  targetModels = [],
  setTargetModels,
  attackerModel,
  setAttackerModel,
  judgeModel,
  setJudgeModel,
  hardenerModel,
  setHardenerModel,
  seedExtractorModel,
  setSeedExtractorModel,
  extractorModel,
  setExtractorModel,
  showAdvancedModels,
  setShowAdvancedModels,
  enableHardening,
  setEnableHardening,
  tokens,
  name,
  setName,
}: ChooseModelsProps) {
  const isMulti = multiple;

  const handleTargetChange = (value: string[]) => {
    if (setTargetModels) setTargetModels(value);
  };

  const handleSingleTargetChange = (value: string) => {
    if (setTargetModel) setTargetModel(value);
  };

  return (
    <Card className={isMulti ? "lg:col-span-2" : ""}>
      <CardHeader>
        <CardTitle className="text-base">Models Selection</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {name !== undefined && setName !== undefined && (
          <div className="space-y-2 sm:col-span-3">
            <Label className="text-sm font-medium">Deployment Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Payment Flow"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Target AI Model{isMulti ? "(s)" : ""}
          </Label>
          {isMulti ? (
            <MultiModelSelector
              value={targetModels}
              onChange={handleTargetChange}
              role={ModelSelectorRole.Target}
            />
          ) : (
            <ModelSelector
              value={targetModel || ""}
              onChange={handleSingleTargetChange}
              role={ModelSelectorRole.Target}
            />
          )}
          {isMulti && (
            <p className="text-xs text-muted-foreground">
              Select one or more models to test in parallel.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Swords className="h-3.5 w-3.5 text-red-400" />
            Attacker Model
          </Label>
          <ModelSelector
            value={attackerModel}
            onChange={setAttackerModel}
            role={ModelSelectorRole.Attack}
          />
          <p className="text-xs text-muted-foreground">
            Generates adversarial prompts targeting the forbidden task.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Gavel className="h-3.5 w-3.5 text-emerald-400" />
            Judge Model
          </Label>
          <ModelSelector
            value={judgeModel}
            onChange={setJudgeModel}
            role={ModelSelectorRole.Judge}
          />
          <p className="text-xs text-muted-foreground">
            Evaluates whether the target leaked restricted info.
          </p>
        </div>

        <div className="col-span-full border-t border-white/5 pt-4 mt-2">
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
                  Custom model used to auto-suggest forbidden tasks and analyze
                  prompt ontologies.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  Hardener Model
                </Label>
                <ModelSelector
                  value={hardenerModel}
                  onChange={setHardenerModel}
                  role={ModelSelectorRole.Hardener}
                />
                <p className="text-[10px] text-muted-foreground">
                  Sets the model used to generate a hardened system prompt
                  following the scan. (Does not run automatically)
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
                  Custom model used to extract tools and analyze mock responses
                  during hardening.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
