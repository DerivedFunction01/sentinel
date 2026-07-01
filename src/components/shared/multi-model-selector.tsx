"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Search, Loader2, X, Plus, Wrench } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface ModelOption {
  id: string;
  name: string;
  isRecommended: boolean;
  aiSuggest: boolean;
  supportsTools: boolean;
}

interface MultiModelSelectorProps {
  /** Selected model ids. */
  value: string[];
  onChange: (ids: string[]) => void;
}

const RECENT_MODELS_KEY = "ToolRegistry_recent_models";

function getRecentModels(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_MODELS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentModel(modelId: string) {
  if (typeof window === "undefined") return;
  try {
    const recents = getRecentModels();
    const filtered = recents.filter((id) => id !== modelId);
    filtered.unshift(modelId);
    if (filtered.length > 5) filtered.pop();
    localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(filtered));
  } catch {}
}

export function MultiModelSelector({
  value,
  onChange,
}: MultiModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Load models on mount and whenever the dropdown opens or search changes.
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

  // Also load on mount for display names of already-selected models.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/models");
        const data = await res.json();
        if (active) setModels(data.models || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const recommended = models.filter((m) => m.isRecommended);
  const others = models.filter((m) => !m.isRecommended);

  const toggleModel = (id: string) => {
    saveRecentModel(id);
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
    (id) => models.find((m) => m.id === id)?.name || formatModelName(id),
  );

  const recentIds = getRecentModels();
  const recentModels: ModelOption[] = recentIds.map((id) => {
    const found = models.find((m) => m.id === id);
    if (found) return found;
    return {
      id,
      name: formatModelName(id),
      isRecommended: false,
      aiSuggest: false,
      supportsTools: false,
    };
  });

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
                  {search.length === 0 && recentModels.length > 0 && (
                    <CommandGroup
                      heading="RECENTLY USED"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2"
                    >
                      {recentModels.map((model) => (
                        <ModelItem
                          key={`recent-${model.id}`}
                          model={model}
                          selected={value.includes(model.id)}
                          onSelect={() => toggleModel(model.id)}
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
                          selected={value.includes(model.id)}
                          onSelect={() => toggleModel(model.id)}
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
                          selected={value.includes(model.id)}
                          onSelect={() => toggleModel(model.id)}
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

      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} model{value.length !== 1 ? "s" : ""} selected — each
          will be tested against every prompt.
        </p>
      )}
    </div>
  );
}

function ModelItem({
  model,
  selected,
  onSelect,
}: {
  model: ModelOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${model.name} ${model.id}`}
      onSelect={onSelect}
      className="flex items-center justify-between gap-2 py-2"
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-foreground truncate">{model.name}</span>
          {model.supportsTools && (
            <Wrench className="h-3 w-3 shrink-0 text-blue-400" />
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
