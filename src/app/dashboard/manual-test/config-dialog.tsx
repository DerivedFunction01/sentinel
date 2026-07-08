"use client";

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
              onUseSample={() => {}}
              formOptions={{
                showCharCount: true,
                showPrettify: true,
                showToolManager: false,
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
              onUseSample={() => {}}
              formOptions={{
                showCharCount: true,
                showPrettify: true,
                showToolManager: false,
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
