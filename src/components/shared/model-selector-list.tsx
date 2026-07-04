"use client";

import { Loader2, Wrench, CircleDollarSign, Gift, Check } from "lucide-react";
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
import { ModelSelectorRole, getTopModelsForRole } from "@/lib/model-utils";
import { useModelsCache } from "@/hooks/use-models-cache";
import { useMemo } from "react";

export interface ModelOption {
  id: string;
  name: string;
  isRecommended: boolean;
  aiSuggest: boolean;
  supportsTools: boolean;
  isLowCost: boolean;
  isFree: boolean;
}

interface ModelSelectorListProps {
  /** Currently selected model id(s). */
  selectedIds: string[];
  /** Called when a model is selected. */
  onSelect: (id: string) => void;
  /** Role for per-role usage tracking. */
  role?: ModelSelectorRole;
  /** Whether to show the "FREQUENTLY USED" section. Defaults to true. */
  showFrequent?: boolean;
  /** Controlled search value. */
  search: string;
  /** Search change handler. */
  onSearchChange: (value: string) => void;
}

/**
 * Shared dropdown list for model selection.
 * Renders the Command popover content: search input + loading/empty/list groups.
 * Both ModelSelector and MultiModelSelector use this internally.
 */
export function ModelSelectorList({
  selectedIds,
  onSelect,
  role,
  showFrequent = true,
  search,
  onSearchChange,
}: ModelSelectorListProps) {
  const { models: allModels, loading } = useModelsCache();

  // Client-side search filter over the cached array
  const models = useMemo(() => {
    if (search.length < 2) return allModels;
    const q = search.toLowerCase();
    return allModels.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)),
    );
  }, [allModels, search]);

  const recommended = models.filter((m) => m.isRecommended);
  const others = models.filter((m) => !m.isRecommended);

  // Get frequently used models for this role
  const frequentIds =
    role && showFrequent
      ? getTopModelsForRole(
          role,
          allModels.map((m) => m.id),
        )
      : [];
  const frequentModels: ModelOption[] = frequentIds.map((id) => {
    const found = allModels.find((m) => m.id === id);
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
    <Command shouldFilter={false}>
      <CommandInput
        value={search}
        onValueChange={onSearchChange}
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
            {search.length === 0 && frequentModels.length > 0 && (
              <CommandGroup
                heading="FREQUENTLY USED"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2"
              >
                {frequentModels.map((model) => (
                  <ModelItem
                    key={`frequent-${model.id}`}
                    model={model}
                    selected={selectedIds.includes(model.id)}
                    onSelect={() => onSelect(model.id)}
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
                    selected={selectedIds.includes(model.id)}
                    onSelect={() => onSelect(model.id)}
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
                    selected={selectedIds.includes(model.id)}
                    onSelect={() => onSelect(model.id)}
                  />
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </Command>
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
