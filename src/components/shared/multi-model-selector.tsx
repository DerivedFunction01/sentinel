"use client";

import { useState } from "react";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatModelName } from "@/lib/enums";
import {
  ModelSelectorRole,
  incrementModelUsage,
} from "@/lib/model-utils";
import { ModelSelectorList } from "./model-selector-list";
import { useModelsCache } from "@/hooks/use-models-cache";

interface MultiModelSelectorProps {
  /** Selected model ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Role for per-role usage tracking (defaults to target). */
  role?: ModelSelectorRole;
}

/**
 * Multi-select model picker.
 * Uses ModelSelectorList internally for the dropdown content.
 */
export function MultiModelSelector({
  value,
  onChange,
  role = ModelSelectorRole.Target,
}: MultiModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { models: allModels } = useModelsCache();

  const toggleModel = (id: string) => {
    incrementModelUsage(id, role);
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const removeModel = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  const selectedNames = value.map(
    (id) => allModels.find((m) => m.id === id)?.name || formatModelName(id),
  );

  return (
    <div className="space-y-2">
      {/* Selected models as chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id, idx) => (
            <Badge
              key={id}
              variant="outline"
              className="flex items-center gap-1 border-blue-500/30 bg-blue-600/10 py-1 pr-1 text-blue-400"
            >
              <span className="text-xs">{selectedNames[idx]}</span>
              <button
                type="button"
                onClick={() => removeModel(id)}
                className="rounded-sm p-0.5 hover:bg-blue-600/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add model dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              {value.length === 0 ? "Select models…" : "Add another model…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[300px] border-border bg-popover p-0 text-popover-foreground [--popover:oklch(0.21_0.02_264)] [--popover-foreground:oklch(0.93_0.008_264)]"
          align="start"
        >
          <ModelSelectorList
            selectedIds={value}
            onSelect={toggleModel}
            role={role}
            search={search}
            onSearchChange={setSearch}
          />
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} model{value.length !== 1 ? "s" : ""} selected — each
          will be tested against every prompt.
        </p>
      )}
    </div>
  );
}