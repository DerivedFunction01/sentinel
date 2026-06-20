"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface ModelOption {
  id: string;
  name: string;
  isRecommended: boolean;
  aiSuggest: boolean;
}

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Load models on mount (for the selected display name) and whenever the
  // dropdown opens or the search query changes. Debounced for search.
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      if (open) setLoading(true);
      const params = search.length >= 2 ? `?q=${encodeURIComponent(search)}` : "";
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
    }, open ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, search]);

  const recommended = models.filter((m) => m.isRecommended);
  const others = models.filter((m) => !m.isRecommended);
  const selectedModel = models.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedModel ? selectedModel.name : value || "Select a model…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="dark w-[var(--radix-popover-trigger-width)] min-w-[300px] border-border bg-popover p-0 text-popover-foreground"
        align="start"
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search OpenRouter (type 2+ chars)"
              className="h-9 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <CommandList className="max-h-72 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : models.length === 0 ? (
              <CommandEmpty>No model found.</CommandEmpty>
            ) : (
              <>
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
        <span className="text-sm text-foreground">{model.name}</span>
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
