"use client";

import { Play, Plus, Trash2, AlertCircle, Save, Terminal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterRow } from "./filter-row";
import { useQueryContext } from "./query-context";

interface QueryComposerProps {
  useFriendlyNames: boolean;
}

export function QueryComposer({ useFriendlyNames }: QueryComposerProps) {
  const {
    sourceType, setSourceType,
    selectedViewId, setSelectedViewId,
    filters, setFilters,
    projections, setProjections,
    groupBy, setGroupBy,
    aggregations, setAggregations,
    sortInstructions, setSortInstructions,
    limit, setLimit,
    setOp, setSetOp,
    subQuerySourceType, setSubQuerySourceType,
    subQueryViewId, setSubQueryViewId,
    subQueryFilters, setSubQueryFilters,
    newQueryName, setNewQueryName,
    includePivotConfig, setIncludePivotConfig,
    currentFields,
    savedQueries,
    handleRunQuery,
    handleSaveQuery,
    handleExportPython,
  } = useQueryContext();

  const fieldLabel = (name: string, label?: string) =>
    useFriendlyNames ? label || name : name;

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
            <button
              type="button"
              onClick={() => setIncludePivotConfig(!includePivotConfig)}
              title={includePivotConfig ? "Pivot config will be saved" : "Pivot config will NOT be saved"}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors ${
                includePivotConfig
                  ? "bg-pink-600/20 border-pink-500/40 text-pink-300"
                  : "border-white/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Check
                className={`h-3.5 w-3.5 ${includePivotConfig ? "text-pink-300" : "text-transparent"}`}
              />
              Pivot
            </button>
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

        {/* FROM DATASET */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-slate-300">FROM DATASET:</span>
          <div className="flex bg-muted p-1 rounded-md">
            {(["scans", "trials", "view"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSourceType(t)}
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

        {/* Columns (SELECT) */}
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
                    onChange={() =>
                      setProjections(
                        isChecked
                          ? projections.filter((p) => p !== f.name)
                          : [...projections, f.name],
                      )
                    }
                    className="rounded border-white/10 bg-zinc-950 text-blue-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                  />
                  <span className="truncate">{fieldLabel(f.name, f.label)}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Filters (WHERE) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
              Filters (WHERE)
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setFilters([...filters, { property: "", operator: "eq", value: "" }])
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
              />
            ))}
          </div>
        </div>

        {/* Group By & Aggregations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4">
          {/* Group By */}
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
                      const next = [...groupBy];
                      next[idx] = e.target.value;
                      setGroupBy(next);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white flex-1"
                  >
                    <option value="">-- select field --</option>
                    {currentFields.map((f) => (
                      <option key={f.name} value={f.name}>
                        {fieldLabel(f.name, f.label)}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setGroupBy(groupBy.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Aggregations */}
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
                    onChange={(e) => {
                      const next = [...aggregations];
                      next[idx] = { ...next[idx], function: e.target.value as any };
                      setAggregations(next);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <optgroup label="Basic">
                      <option value="count">COUNT</option>
                      <option value="count_distinct">COUNT DISTINCT</option>
                      <option value="sum">SUM</option>
                      <option value="avg">AVG</option>
                      <option value="min">MIN</option>
                      <option value="max">MAX</option>
                    </optgroup>
                    <optgroup label="Statistical">
                      <option value="std_dev">STD DEV</option>
                      <option value="median">MEDIAN</option>
                      <option value="q1">Q1 (25th %ile)</option>
                      <option value="q3">Q3 (75th %ile)</option>
                      <option value="range">RANGE (max−min)</option>
                      <option value="stat">STAT (Summary stats)</option>
                    </optgroup>
                  </select>
                  <select
                    value={agg.property}
                    onChange={(e) => {
                      const next = [...aggregations];
                      next[idx] = { ...next[idx], property: e.target.value };
                      setAggregations(next);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="*">*</option>
                    {currentFields.map((f) => (
                      <option key={f.name} value={f.name}>
                        {fieldLabel(f.name, f.label)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={agg.alias}
                    placeholder="Alias..."
                    onChange={(e) => {
                      const next = [...aggregations];
                      next[idx] = { ...next[idx], alias: e.target.value };
                      setAggregations(next);
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

        {/* Set Algebra */}
        <div className="border-t border-white/5 pt-4 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
              Set Algebra:
            </span>
            <div className="flex bg-muted p-1 rounded-md">
              {(["none", "union", "intersect", "except"] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => setSetOp(op)}
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
                  {(["scans", "trials", "view"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSubQuerySourceType(t)}
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
                  />
                ))}
              </div>

              {sourceType !== subQuerySourceType && (
                <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs rounded">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Warning: Operations between different datasets ({sourceType} ×{" "}
                    {subQuerySourceType}) might produce misaligned schema shapes.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ORDER BY & LIMIT */}
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
                      const next = [...sortInstructions];
                      next[idx] = { ...next[idx], property: e.target.value };
                      setSortInstructions(next);
                    }}
                    className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white flex-1"
                  >
                    <option value="">-- select property --</option>
                    {currentFields.map((f) => (
                      <option key={f.name} value={f.name}>
                        {fieldLabel(f.name, f.label)}
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
                    onChange={(e) => {
                      const next = [...sortInstructions];
                      next[idx] = {
                        ...next[idx],
                        direction: e.target.value as "asc" | "desc",
                      };
                      setSortInstructions(next);
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

        {/* Execute */}
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
