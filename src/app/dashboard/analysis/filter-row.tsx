"use client";

import { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterCondition } from "@/lib/dataframe/client-query-engine";
import { OPERATORS_BY_TYPE } from "./constants";
import { useQueryContext } from "./query-context";

interface FilterRowProps {
  f: FilterCondition;
  idx: number;
  // Which filter array this row belongs to (main or subquery)
  currentFilters: FilterCondition[];
  setCurrentFilters: (filters: FilterCondition[]) => void;
  useFriendlyNames?: boolean;
}

export function FilterRow({
  f,
  idx,
  currentFilters,
  setCurrentFilters,
  useFriendlyNames = true,
}: FilterRowProps) {
  const { currentFields, getUniqueFieldValues, sourceType } = useQueryContext();

  // Ensure we read useFriendlyNames from context — but it lives in page.tsx.
  // We receive it via the closest consuming component (QueryComposer passes it).
  // Easiest solution: accept it as an optional prop with a sensible default.
  // (QueryComposer will forward it.)
  const field = currentFields.find((cf) => cf.name === f.property);
  const type = field ? field.type : "string";
  const isBetween = f.operator === "between" || f.operator === "not_between";
  const isSet = f.operator === "in_set" || f.operator === "not_in_set";

  const [tempInput, setTempInput] = useState("");

  const parts = String(f.value || "").split(",");
  const val1 = parts[0] || "";
  const val2 = parts[1] || "";

  const suggestions = useMemo(
    () => getUniqueFieldValues(f.property),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.property, sourceType],
  );

  const handlePartChange = (partIdx: number, val: string) => {
    const newParts = [...parts];
    newParts[partIdx] = val;
    const newFilters = [...currentFilters];
    newFilters[idx] = { ...newFilters[idx], value: newParts.join(",") };
    setCurrentFilters(newFilters);
  };

  const handleAddItem = () => {
    if (!tempInput.trim()) return;
    const items = String(f.value || "")
      .split(",")
      .filter((s) => s.trim());
    const newFilters = [...currentFilters];
    newFilters[idx] = {
      ...newFilters[idx],
      value: [...items, tempInput.trim()].join(","),
    };
    setCurrentFilters(newFilters);
    setTempInput("");
  };

  const handleRemoveItem = (itemIdx: number) => {
    const items = String(f.value || "")
      .split(",")
      .filter((s) => s.trim());
    const newFilters = [...currentFilters];
    newFilters[idx] = {
      ...newFilters[idx],
      value: items.filter((_, i) => i !== itemIdx).join(","),
    };
    setCurrentFilters(newFilters);
  };

  const inputType =
    type === "date" ? "date" : type === "number" ? "number" : "text";

  return (
    <div className="flex gap-2 items-start md:items-center flex-wrap md:flex-nowrap bg-white/[0.01] border border-white/5 p-2 rounded-lg">
      {/* Property selector */}
      <select
        value={f.property}
        onChange={(e) => {
          const newFilters = [...currentFilters];
          const targetField = currentFields.find(
            (cf) => cf.name === e.target.value,
          );
          const validOps = targetField
            ? OPERATORS_BY_TYPE[targetField.type] || OPERATORS_BY_TYPE.string
            : OPERATORS_BY_TYPE.string;
          newFilters[idx] = {
            ...newFilters[idx],
            property: e.target.value,
            operator: validOps[0].value as FilterCondition["operator"],
            value: "",
          };
          setCurrentFilters(newFilters);
        }}
        className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white shrink-0"
      >
        <option value="">-- select property --</option>
        {currentFields.map((cf) => (
          <option key={cf.name} value={cf.name}>
            {useFriendlyNames ? cf.label || cf.name : cf.name}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={f.operator}
        onChange={(e) => {
          const newFilters = [...currentFilters];
          newFilters[idx] = {
            ...newFilters[idx],
            operator: e.target.value as FilterCondition["operator"],
            value: "",
          };
          setCurrentFilters(newFilters);
        }}
        className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white shrink-0"
      >
        {(() => {
          const targetField = currentFields.find((cf) => cf.name === f.property);
          const ops = targetField
            ? OPERATORS_BY_TYPE[targetField.type] || OPERATORS_BY_TYPE.string
            : OPERATORS_BY_TYPE.string;
          return ops.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ));
        })()}
      </select>

      {/* Value input */}
      {isBetween ? (
        <div className="flex gap-2 items-center flex-1">
          <input
            type={inputType}
            value={val1}
            placeholder="Min..."
            onChange={(e) => handlePartChange(0, e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-28"
          />
          <span className="text-xs text-muted-foreground">and</span>
          <input
            type={inputType}
            value={val2}
            placeholder="Max..."
            onChange={(e) => handlePartChange(1, e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-28"
          />
        </div>
      ) : isSet ? (
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <div className="flex flex-wrap gap-1">
            {String(f.value || "")
              .split(",")
              .filter((s) => s.trim())
              .map((item, itemIdx) => (
                <Badge
                  key={itemIdx}
                  variant="secondary"
                  className="text-[10px] bg-white/10 text-white gap-1 py-0.5"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(itemIdx)}
                    className="text-red-400 hover:text-red-300 font-bold"
                  >
                    ×
                  </button>
                </Badge>
              ))}
          </div>
          <div className="flex gap-1 items-center">
            <input
              type={inputType}
              value={tempInput}
              list={`set-suggestions-${idx}-${f.property}`}
              placeholder="Add element..."
              onChange={(e) => setTempInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs text-white flex-1"
            />
            {suggestions.length > 0 && (
              <datalist id={`set-suggestions-${idx}-${f.property}`}>
                {suggestions.map((val) => (
                  <option key={val} value={val} />
                ))}
              </datalist>
            )}
            <Button
              size="icon"
              variant="outline"
              type="button"
              onClick={handleAddItem}
              className="h-7 w-7 border-white/10"
            >
              +
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-2">
          <input
            type={inputType}
            value={f.value || ""}
            list={`suggestions-${idx}-${f.property}`}
            placeholder={type === "date" ? "Select date..." : "Value..."}
            onChange={(e) => {
              const newFilters = [...currentFilters];
              newFilters[idx] = { ...newFilters[idx], value: e.target.value };
              setCurrentFilters(newFilters);
            }}
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white flex-1"
          />
          {suggestions.length > 0 && (
            <datalist id={`suggestions-${idx}-${f.property}`}>
              {suggestions.map((val) => (
                <option key={val} value={val} />
              ))}
            </datalist>
          )}
        </div>
      )}

      <Button
        size="icon"
        variant="ghost"
        type="button"
        onClick={() =>
          setCurrentFilters(currentFilters.filter((_, i) => i !== idx))
        }
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
