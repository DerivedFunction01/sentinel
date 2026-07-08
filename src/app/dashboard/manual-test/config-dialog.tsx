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
import { PromptSectionCard } from "@/components/shared/prompt-section-card";
import { PromptFormSectionValues } from "@/components/shared/prompt-form-section";

interface ConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  promptValues: PromptFormSectionValues;
  onPromptValuesChange: (values: PromptFormSectionValues) => void;
}

export function ConfigDialog({
  isOpen,
  onOpenChange,
  promptValues,
  onPromptValuesChange,
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
        <PromptSectionCard
          title="Manual Agent System Prompt"
          description="Specify the target model rules, mock tools definition, and test parameters."
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
      </DialogContent>
    </Dialog>
  );
}
