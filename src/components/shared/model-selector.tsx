"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Search,
  Loader2,
  Wrench,
  CircleDollarSign,
  Gift,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatModelName } from "@/lib/enums";
import {
  ModelSelectorRole,
  incrementModelUsage,
  getTopModelsForRole,
} from "@/lib/model-utils";

interface ModelOption {
  id: string;
  name: string;
  isRecommended: boolean;
  aiSuggest: boolean;
  supportsTools: boolean;
  isLowCost: boolean;
  isFree: boolean;
}

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  /** Optional role for per-role usage tracking and defaults. */
  role?: ModelSelectorRole;
}

export function ModelSelector({ value, onChange, role }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Load models on mount (for the selected display name) and whenever the
  // dropdown opens or the search query changes. Debounced for search.
  useEffect(() => {
    let active = true;
    const t = setTimeout(
      async () => {
        if (open) setLoading(true);
        const params =
          search.length >= 2 ? `?q=${encodeURIComponent(search)}` : "";
        try {
          const res = await fetch(`/api/models${params}`);
          const data = await res.json();
          if (active) {
            setModels(data.models || []);
            setLoading(false);
          }
        } catch {
          if (active) setLoading(false);
        }
      },
      open ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, search]);

  const recommended = models.filter((m) => m.isRecommended);
  const others = models.filter((m) => !m.isRecommended);
  const selectedModel = models.find((m) => m.id === value);

  // Get frequently used models for this role (if role is provided)
  const frequentIds = role
    ? getTopModelsForRole(
        role,
        models.map((m) => m.id),
      )
    : [];
  const frequentModels: ModelOption[] = frequentIds.map((id) => {
    const found = models.find((m) => m.id === id);
    if (found) return found;
    return {
      id,
      name: formatModelName(id),
      isRecommended: false,
      aiSuggest: false,
      supportsTools: false,
      isLowCost: false,
      isFree: false,
    };
  });

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
        className="dark w-[var(--radix-popover-trigger-width)] min-w-[300px] border-border bg-popover p-0 text-popover-foreground"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search OpenRouter (type 2+ chars)"
          />
          <CommandList className="max-h-72 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : models.length === 0 ? (
              <CommandEmpty>No model found.</CommandEmpty>
            ) : (
              <>
                {search.length === 0 && role && frequentModels.length > 0 && (
                  <CommandGroup
                    heading="FREQUENTLY USED"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2"
                  >
                    {frequentModels.map((model) => (
                      <ModelItem
                        key={`frequent-${model.id}`}
                        model={model}
                        selected={model.id === value}
                        onSelect={(id) => {
                          incrementModelUsage(id, role);
                          onChange(id);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </CommandGroup>
                )}
                {recommended.length > 0 && (
                  <CommandGroup
                    heading="RECOMMENDED"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {recommended.map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        selected={model.id === value}
                        onSelect={(id) => {
                          if (role) incrementModelUsage(id, role);
                          onChange(id);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </CommandGroup>
                )}
                {others.length > 0 && (
                  <CommandGroup heading="ALL MODELS">
                    {others.map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        selected={model.id === value}
                        onSelect={(id) => {
                          if (role) incrementModelUsage(id, role);
                          onChange(id);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ModelItem({
  model,
  selected,
  onSelect,
}: {
  model: ModelOption;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <CommandItem
      value={`${model.name} ${model.id}`}
      onSelect={() => onSelect(model.id)}
      className="flex items-center justify-between gap-2 py-2"
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-foreground truncate">{model.name}</span>
          {model.supportsTools && (
            <Wrench className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          )}
          {model.isLowCost && (
            <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          )}
          {model.isFree && (
            <Gift className="h-3.5 w-3.5 shrink-0 text-purple-400" />
          )}
        </div>
        {model.aiSuggest && (
          <span className="text-xs text-muted-foreground">AI Suggest</span>
        )}
      </div>
      <Check
        className={cn(
          "h-4 w-4 shrink-0 text-blue-500",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
    </CommandItem>
  );
}
