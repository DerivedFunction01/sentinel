"use client";

import { useState, useMemo } from "react";
import { Play, Plus, Trash2, AlertCircle, Save, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FilterCondition,
  Aggregation,
  SortInstruction,
} from "@/lib/dataframe/client-query-engine";
import { OPERATORS_BY_TYPE } from "./constants";
import { FilterRowProps } from "./filter-row";

function FilterRow({
  f,
  idx,
  currentFilters,
  setCurrentFilters,
  currentFields,
  getUniqueFieldValues,
  useFriendlyNames,
}: FilterRowProps) {
  const field = currentFields.find((cf) => cf.name === f.property);
  const type = field ? field.type : "string";
  const isBetween = f.operator === "between" || f.operator === "not_between";
  const isSet = f.operator === "in_set" || f.operator === "not_in_set";

  const [tempInput, setTempInput] = useState("");

  const parts = String(f.value || "").split(",");
  const val1 = parts[0] || "";
  const val2 = parts[1] || "";

  const suggestions = useMemo(() => {
    return getUniqueFieldValues(f.property);
  }, [f.property, getUniqueFieldValues]);

  const handlePartChange = (partIdx: number, val: string) => {
    const newParts = [...parts];
    newParts[partIdx] = val;
    const newFilters = [...currentFilters];
    newFilters[idx].value = newParts.join(",");
    setCurrentFilters(newFilters);
  };

  const handleAddItem = () => {
    if (!tempInput.trim()) return;
    const items = String(f.value || "")
      .split(",")
      .filter((s) => s.trim());
    const newItems = [...items, tempInput.trim()];
    const newFilters = [...currentFilters];
    newFilters[idx].value = newItems.join(",");
    setCurrentFilters(newFilters);
    setTempInput("");
  };

  const handleRemoveItem = (itemIdx: number) => {
    const items = String(f.value || "")
      .split(",")
      .filter((s) => s.trim());
    const newItems = items.filter((_, i) => i !== itemIdx);
    const newFilters = [...currentFilters];
    newFilters[idx].value = newItems.join(",");
    setCurrentFilters(newFilters);
  };

  const inputType =
    type === "date" ? "date" : type === "number" ? "number" : "text";

  return (
    <div className="flex gap-2 items-start md:items-center flex-wrap md:flex-nowrap bg-white/[0.01] border border-white/5 p-2 rounded-lg">
      <select
        value={f.property}
        onChange={(e) => {
          const newFilters = [...currentFilters];
          newFilters[idx].property = e.target.value;
          const targetField = currentFields.find(
            (cf) => cf.name === e.target.value,
          );
          if (targetField) {
            const validOps =
              OPERATORS_BY_TYPE[targetField.type] || OPERATORS_BY_TYPE.string;
            newFilters[idx].operator = validOps[0].value as any;
            newFilters[idx].value = "";
          }
          setCurrentFilters(newFilters);
        }}
        className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white shrink-0"
      >
        <option value="">-- select property --</option>
        {currentFields.map((field) => (
          <option key={field.name} value={field.name}>
            {useFriendlyNames ? field.label || field.name : field.name}
          </option>
        ))}
      </select>

      <select
        value={f.operator}
        onChange={(e: any) => {
          const newFilters = [...currentFilters];
          newFilters[idx].operator = e.target.value;
          newFilters[idx].value = "";
          setCurrentFilters(newFilters);
        }}
        className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white shrink-0"
      >
        {(() => {
          const targetField = currentFields.find(
            (cf) => cf.name === f.property,
          );
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

      {/* Render Value Inputs */}
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
              newFilters[idx].value = e.target.value;
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

export function QueryComposer(
  newQueryName: string,
  setNewQueryName,
  handleSaveQuery: () => Promise<void>,
  handleExportPython: () => void,
  setSourceType,
  sourceType: string,
  selectedViewId: string,
  setSelectedViewId,
  savedQueries: any[],
  currentFields: { name: string; label: string; type: string; desc: string }[],
  projections: string[],
  setProjections,
  useFriendlyNames: boolean,
  setFilters,
  filters: FilterCondition[],
  getUniqueFieldValues: (property: string) => string[],
  setGroupBy,
  groupBy: string[],
  setAggregations,
  aggregations: Aggregation[],
  setSetOp,
  setOp: string,
  setSubQuerySourceType,
  subQuerySourceType: string,
  subQueryViewId: string,
  setSubQueryViewId,
  setSubQueryFilters,
  subQueryFilters: FilterCondition[],
  setSortInstructions,
  sortInstructions: SortInstruction[],
  limit: string | number,
  setLimit,
  handleRunQuery: () => void,
) {
  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-foreground flex items-center justify-between">
          <span>Query Composer</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newQueryName}
              placeholder="Name view..."
              onChange={(e) => setNewQueryName(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1 text-xs text-white"
            />
            <Button
              size="sm"
              onClick={handleSaveQuery}
              className="bg-pink-600 hover:bg-pink-500 text-white text-xs gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Save View
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPython}
              className="border-white/10 text-white text-xs gap-1.5"
            >
              <Terminal className="h-3.5 w-3.5 text-green-400" />
              Export Python
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Table selection */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-slate-300">
            FROM DATASET:
          </span>
          <div className="flex bg-muted p-1 rounded-md">
            {["scans", "trials", "view"].map((t) => (
              <button
                key={t}
                onClick={() => setSourceType(t as any)}
                className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                  sourceType === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {sourceType === "view" && (
            <select
              value={selectedViewId}
              onChange={(e) => setSelectedViewId(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
            >
              <option value="">-- select view --</option>
              {savedQueries.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Columns selection (SELECT) */}
        <div className="space-y-2 border-t border-white/5 pt-4">
          <span className="text-xs font-medium text-slate-300 uppercase tracking-wider block">
            Columns (SELECT)
          </span>
          <p className="text-[10px] text-muted-foreground italic">
            Leave all unchecked to SELECT * (all fields).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {currentFields.map((f) => {
              const isChecked = projections.includes(f.name);
              return (
                <label
                  key={f.name}
                  className="flex items-center gap-1.5 p-1.5 rounded border border-white/5 hover:bg-white/5 cursor-pointer transition-colors text-xs text-slate-300 select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        setProjections(projections.filter((p) => p !== f.name));
                      } else {
                        setProjections([...projections, f.name]);
                      }
                    }}
                    className="rounded border-white/10 bg-zinc-950 text-blue-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                  />
                  <span className="truncate">
                    {useFriendlyNames ? f.label || f.name : f.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
              Filters (WHERE)
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setFilters([
                  ...filters,
                  { property: "", operator: "eq", value: "" },
                ])
              }
              className="border-white/10 text-xs px-2.5 h-7"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Filter
            </Button>
          </div>
          <div className="space-y-2">
            {filters.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No filters active. Selecting all records.
              </p>
            )}
            {filters.map((f, idx) => (
              <FilterRow
                key={idx}
                f={f}
                idx={idx}
                currentFilters={filters}
                setCurrentFilters={setFilters}
                currentFields={currentFields}
                getUniqueFieldValues={getUniqueFieldValues}
                useFriendlyNames={useFriendlyNames}
              />
            ))}
          </div>
        </div>

        {/* Aggregations & Group By */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                Group By
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGroupBy([...groupBy, ""])}
                className="border-white/10 text-xs px-2.5 h-7"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Group
              </Button>
            </div>
            <div className="space-y-2">
              {groupBy.map((g, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={g}
                    onChange={(e) => {
                      const newGroup = [...groupBy];
                      newGroup[idx] = e.target.value;
                      setGroupBy(newGroup);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white flex-1"
                  >
                    <option value="">-- select field --</option>
                    {currentFields.map((field) => (
                      <option key={field.name} value={field.name}>
                        {useFriendlyNames
                          ? field.label || field.name
                          : field.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setGroupBy(groupBy.filter((_, i) => i !== idx))
                    }
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                Aggregations
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setAggregations([
                    ...aggregations,
                    { function: "count", property: "*", alias: "" },
                  ])
                }
                className="border-white/10 text-xs px-2.5 h-7"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Aggregation
              </Button>
            </div>
            <div className="space-y-2">
              {aggregations.map((agg, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={agg.function}
                    onChange={(e: any) => {
                      const newAgg = [...aggregations];
                      newAgg[idx].function = e.target.value;
                      setAggregations(newAgg);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="count">COUNT</option>
                    <option value="count_distinct">COUNT DISTINCT</option>
                    <option value="sum">SUM</option>
                    <option value="avg">AVG</option>
                    <option value="min">MIN</option>
                    <option value="max">MAX</option>
                  </select>

                  <select
                    value={agg.property}
                    onChange={(e) => {
                      const newAgg = [...aggregations];
                      newAgg[idx].property = e.target.value;
                      setAggregations(newAgg);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="*">*</option>
                    {currentFields.map((field) => (
                      <option key={field.name} value={field.name}>
                        {useFriendlyNames
                          ? field.label || field.name
                          : field.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={agg.alias}
                    placeholder="Alias..."
                    onChange={(e) => {
                      const newAgg = [...aggregations];
                      newAgg[idx].alias = e.target.value;
                      setAggregations(newAgg);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white flex-1 min-w-[70px]"
                  />

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setAggregations(aggregations.filter((_, i) => i !== idx))
                    }
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Set Operations */}
        <div className="border-t border-white/5 pt-4 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
              Set Algebra:
            </span>
            <div className="flex bg-muted p-1 rounded-md">
              {["none", "union", "intersect", "except"].map((op) => (
                <button
                  key={op}
                  onClick={() => setSetOp(op as any)}
                  className={`px-3 py-1 text-xs rounded-md font-medium uppercase transition-colors ${
                    setOp === op
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {op === "none" ? "None" : op}
                </button>
              ))}
            </div>
          </div>

          {setOp !== "none" && (
            <div className="bg-white/[0.02] border border-dashed border-white/10 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-4 border-b border-white/5 pb-2.5 mb-2">
                <span className="text-xs font-medium text-slate-300">
                  SUBQUERY SOURCE:
                </span>
                <div className="flex bg-muted p-0.5 rounded">
                  {["scans", "trials", "view"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSubQuerySourceType(t as any)}
                      className={`px-2.5 py-0.5 text-[10px] rounded font-medium capitalize transition-colors ${
                        subQuerySourceType === t
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {subQuerySourceType === "view" && (
                  <select
                    value={subQueryViewId}
                    onChange={(e) => setSubQueryViewId(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1 text-xs text-white"
                  >
                    <option value="">-- select view --</option>
                    {savedQueries.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 uppercase">
                  Subquery Filters (WHERE)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSubQueryFilters([
                      ...subQueryFilters,
                      { property: "", operator: "eq", value: "" },
                    ])
                  }
                  className="border-white/10 text-xs px-2 h-6"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Sub-Filter
                </Button>
              </div>
              <div className="space-y-2">
                {subQueryFilters.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    No subquery filters added yet.
                  </p>
                )}
                {subQueryFilters.map((f, idx) => (
                  <FilterRow
                    key={idx}
                    f={f}
                    idx={idx}
                    currentFilters={subQueryFilters}
                    setCurrentFilters={setSubQueryFilters}
                    currentFields={currentFields}
                    getUniqueFieldValues={getUniqueFieldValues}
                    useFriendlyNames={useFriendlyNames}
                  />
                ))}
              </div>

              {/* Shape Mismatch Warning */}
              {sourceType !== subQuerySourceType && (
                <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs rounded">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Warning: Operations between different datasets ({sourceType}{" "}
                    × {subQuerySourceType}) might produce misaligned schema
                    shapes.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sorting and Limit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                Order By
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSortInstructions([
                    ...sortInstructions,
                    { property: "", direction: "asc" },
                  ])
                }
                className="border-white/10 text-xs px-2.5 h-7"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Order
              </Button>
            </div>
            <div className="space-y-2">
              {sortInstructions.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={s.property}
                    onChange={(e) => {
                      const newSort = [...sortInstructions];
                      newSort[idx].property = e.target.value;
                      setSortInstructions(newSort);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white flex-1"
                  >
                    <option value="">-- select property --</option>
                    {currentFields.map((field) => (
                      <option key={field.name} value={field.name}>
                        {useFriendlyNames
                          ? field.label || field.name
                          : field.name}
                      </option>
                    ))}
                    {aggregations.map((agg) => (
                      <option key={agg.alias} value={agg.alias}>
                        {agg.alias} (aggregated)
                      </option>
                    ))}
                  </select>

                  <select
                    value={s.direction}
                    onChange={(e: any) => {
                      const newSort = [...sortInstructions];
                      newSort[idx].direction = e.target.value;
                      setSortInstructions(newSort);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="asc">ASC</option>
                    <option value="desc">DESC</option>
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setSortInstructions(
                        sortInstructions.filter((_, i) => i !== idx),
                      )
                    }
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider block">
              Limit
            </span>
            <input
              type="number"
              value={limit}
              placeholder="None (Return all records)"
              onChange={(e) =>
                setLimit(e.target.value ? Number(e.target.value) : "")
              }
              className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
          <Button
            onClick={handleRunQuery}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2 w-full sm:w-auto font-bold"
          >
            <Play className="h-4 w-4 fill-white" />
            Execute Query
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
