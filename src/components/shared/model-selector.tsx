"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatModelName } from "@/lib/enums";
import {
  ModelSelectorRole,
  incrementModelUsage,
} from "@/lib/model-utils";
import { ModelSelectorList } from "./model-selector-list";
import { useModelsCache } from "@/hooks/use-models-cache";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  /** Optional role for per-role usage tracking and defaults. */
  role?: ModelSelectorRole;
}

/**
 * Single-select model picker.
 * Uses ModelSelectorList internally for the dropdown content.
 */
export function ModelSelector({ value, onChange, role }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { models: allModels } = useModelsCache();

  const selectedModel = allModels.find((m) => m.id === value);

  const handleSelect = (id: string) => {
    if (role) incrementModelUsage(id, role);
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedModel
            ? selectedModel.name
            : value
              ? formatModelName(value)
              : "Select a model…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] border-border bg-popover p-0 text-popover-foreground [--popover:oklch(0.21_0.02_264)] [--popover-foreground:oklch(0.93_0.008_264)]"
        align="start"
      >
        <ModelSelectorList
          selectedIds={[value]}
          onSelect={handleSelect}
          role={role}
          search={search}
          onSearchChange={setSearch}
        />
      </PopoverContent>
    </Popover>
  );
}