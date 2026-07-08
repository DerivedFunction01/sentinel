"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptSectionCard } from "@/components/shared/prompt-section-card";
import { PromptFormSectionValues } from "@/components/shared/prompt-form-section";
import { ToolManagerDialog } from "@/components/shared/tool_editor/tool-manager-dialog";
import {
  sampleSystemPrompt,
  sampleForbiddenTask,
  sampleJudgeInstructions,
  sampleTools,
  sampleMockToolResponses,
} from "@/lib/sample-config";
import { toast } from "sonner";

interface ConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  promptValues: PromptFormSectionValues;
  onPromptValuesChange: (values: PromptFormSectionValues) => void;
  globalValues: PromptFormSectionValues;
  onGlobalValuesChange: (values: PromptFormSectionValues) => void;
}

export function ConfigDialog({
  isOpen,
  onOpenChange,
  promptValues,
  onPromptValuesChange,
  globalValues,
  onGlobalValuesChange,
}: ConfigDialogProps) {
  // Local Tool Manager States
  const [toolManagerOpen, setToolManagerOpen] = useState(false);
  const [toolManagerTarget, setToolManagerTarget] = useState<"current" | "global" | null>(null);

  const openToolManager = (target: "current" | "global") => {
    setToolManagerTarget(target);
    setToolManagerOpen(true);
  };

  const handleSaveTools = (
    toolsToAdd: any[],
    toolsToRemove: string[],
    localMocks: Record<string, any>
  ) => {
    const activeValues = toolManagerTarget === "current" ? promptValues : globalValues;
    const onValuesChange = toolManagerTarget === "current" ? onPromptValuesChange : onGlobalValuesChange;

    let currentTools: any[] = [];
    try {
      currentTools = JSON.parse(activeValues.tools || "[]");
    } catch {
      currentTools = [];
    }

    let currentMocks: any = {};
    try {
      currentMocks = JSON.parse(activeValues.mockResponses || "{}");
    } catch {
      currentMocks = {};
    }

    for (const name of toolsToRemove) {
      const idx = currentTools.findIndex((t: any) => t.function?.name === name);
      if (idx !== -1) currentTools.splice(idx, 1);
      delete currentMocks[name];
    }

    const keepNames = new Set<string>();
    for (const tool of toolsToAdd) {
      const name = tool.function?.name;
      if (!name) continue;
      const exists = currentTools.some((t: any) => t.function?.name === name);
      if (!exists) currentTools.push(tool);
      keepNames.add(name);
    }

    for (const name of keepNames) {
      if (localMocks[name]) currentMocks[name] = localMocks[name];
    }

    onValuesChange({
      ...activeValues,
      tools: JSON.stringify(currentTools, null, 2),
      mockResponses: JSON.stringify(currentMocks, null, 2),
    });

    setToolManagerOpen(false);
  };

  const handleLoadSample = (
    values: PromptFormSectionValues,
    onChange: (values: PromptFormSectionValues) => void,
    field: keyof PromptFormSectionValues
  ) => {
    if (field === "tools" || field === "mockResponses") {
      const getTimeTool = sampleTools.find((t) => t.function.name === "get_time");
      const getTimeMock = sampleMockToolResponses.get_time;
      onChange({
        ...values,
        tools: JSON.stringify(getTimeTool ? [getTimeTool] : [], null, 2),
        mockResponses: JSON.stringify(getTimeMock ? { get_time: getTimeMock } : {}, null, 2),
      });
      toast.success("Sample get_time tool & mock response loaded");
    } else {
      const sampleMap: Partial<Record<keyof PromptFormSectionValues, string>> = {
        systemPrompt: sampleSystemPrompt,
        forbiddenTask: sampleForbiddenTask,
        judgeInstructions: sampleJudgeInstructions,
      };
      const sample = sampleMap[field];
      if (sample) {
        onChange({ ...values, [field]: sample });
        toast.success(`Sample ${field} loaded`);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-white/10 gap-1.5"
        >
          <Settings2 className="h-3.5 w-3.5 text-blue-400" />
          Configure Prompts & Tools
        </Button>
      </DialogTrigger>
      <DialogContent className="dark min-w-3xl lg:min-w-6xl bg-zinc-900 border-white/10 text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Playground System Configuration</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-950/60 p-1 rounded-lg border border-white/5 mb-4">
            <TabsTrigger value="current" className="text-xs data-[state=active]:bg-zinc-800">
              Current Chat Configuration
            </TabsTrigger>
            <TabsTrigger value="global" className="text-xs data-[state=active]:bg-zinc-800">
              Global Default Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current">
            <PromptSectionCard
              title="Manual Agent System Prompt (Current Chat)"
              description="Specify the target model rules, mock tools definition, and test parameters for this specific conversation."
              values={promptValues}
              onChange={(field, val) =>
                onPromptValuesChange({ ...promptValues, [field]: val })
              }
              onUseSample={(field) => handleLoadSample(promptValues, onPromptValuesChange, field)}
              formOptions={{
                showCharCount: true,
                showPrettify: true,
                showToolManager: true,
                onOpenToolManager: () => openToolManager("current"),
                hideForbiddenAndJudge: true,
              }}
            />
          </TabsContent>

          <TabsContent value="global">
            <PromptSectionCard
              title="Global Default Configuration"
              description="Default system prompt, tools, and mock responses automatically copied to new test chats when created."
              values={globalValues}
              onChange={(field, val) =>
                onGlobalValuesChange({ ...globalValues, [field]: val })
              }
              onUseSample={(field) => handleLoadSample(globalValues, onGlobalValuesChange, field)}
              formOptions={{
                showCharCount: true,
                showPrettify: true,
                showToolManager: true,
                onOpenToolManager: () => openToolManager("global"),
                hideForbiddenAndJudge: true,
              }}
            />
          </TabsContent>
        </Tabs>

        {toolManagerTarget && (
          <ToolManagerDialog
            open={toolManagerOpen}
            onOpenChange={setToolManagerOpen}
            onConfirm={handleSaveTools}
            recommendedTools={[]}
            existingTools={(() => {
              try {
                const active = toolManagerTarget === "current" ? promptValues : globalValues;
                return JSON.parse(active.tools || "[]");
              } catch {
                return [];
              }
            })()}
            existingMockKeys={(() => {
              try {
                const active = toolManagerTarget === "current" ? promptValues : globalValues;
                return Object.keys(JSON.parse(active.mockResponses || "{}"));
              } catch {
                return [];
              }
            })()}
            existingMocks={(() => {
              try {
                const active = toolManagerTarget === "current" ? promptValues : globalValues;
                return JSON.parse(active.mockResponses || "{}");
              } catch {
                return {};
              }
            })()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
