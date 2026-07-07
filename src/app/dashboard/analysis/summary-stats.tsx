"use client";

import { useState, useMemo } from "react";
import { Sliders } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SummaryStatsViewProps {
  results: any[];
  currentFields: any[];
  useFriendlyNames: boolean;
}

export function SummaryStatsView({
  results,
  currentFields,
  useFriendlyNames,
}: SummaryStatsViewProps) {
  const rowKeys = useMemo(() => {
    if (results.length === 0) return [];
    return Object.keys(results[0]);
  }, [results]);

  const dimensionKeys = useMemo(() => {
    if (results.length === 0) return [];
    const firstRow = results[0];
    return rowKeys.filter(
      (k) =>
        k !== "id" &&
        k !== "trials" &&
        k !== "tags" &&
        (typeof firstRow[k] === "string" || typeof firstRow[k] === "boolean")
    );
  }, [results, rowKeys]);

  const valueKeys = useMemo(() => {
    if (results.length === 0) return [];
    const firstRow = results[0];
    return rowKeys.filter((k) => typeof firstRow[k] === "number" && k !== "id");
  }, [results, rowKeys]);

  const [dimensionKey, setDimensionKey] = useState("");
  const [valueKey, setValueKey] = useState("");

  const activeDim = dimensionKey || dimensionKeys[0] || "";
  const activeVal = valueKey || valueKeys[0] || "";

  const statsData = useMemo(() => {
    if (results.length === 0 || !activeDim || !activeVal) return [];

    const groups: Record<string, number[]> = {};
    for (const row of results) {
      const label = String(row[activeDim] ?? "null");
      const val = Number(row[activeVal]);
      if (!isNaN(val)) {
        if (!groups[label]) groups[label] = [];
        groups[label].push(val);
      }
    }

    const percentileVal = (arr: number[], pct: number) => {
      const index = (pct / 100) * (arr.length - 1);
      const low = Math.floor(index);
      const high = Math.ceil(index);
      return arr[low] + (index - low) * (arr[high] - arr[low]);
    };

    return Object.keys(groups).map((label) => {
      const nums = groups[label].sort((a, b) => a - b);
      if (nums.length === 0) {
        return {
          dimension: label,
          min: 0,
          q1: 0,
          median: 0,
          q3: 0,
          max: 0,
          mean: 0,
          count: 0,
        };
      }
      const sum = nums.reduce((s, v) => s + v, 0);
      return {
        dimension: label,
        min: nums[0],
        q1: Number(percentileVal(nums, 25).toFixed(2)),
        median: Number(percentileVal(nums, 50).toFixed(2)),
        q3: Number(percentileVal(nums, 75).toFixed(2)),
        max: nums[nums.length - 1],
        mean: Number((sum / nums.length).toFixed(2)),
        count: nums.length,
      };
    });
  }, [results, activeDim, activeVal]);

  const getFieldLabel = (key: string) => {
    const matched = currentFields.find((f) => f.name === key);
    return useFriendlyNames && matched ? matched.label || matched.name : key;
  };

  const rawMin = statsData.length > 0 ? Math.min(...statsData.map((d) => d.min)) : 0;
  const rawMax = statsData.length > 0 ? Math.max(...statsData.map((d) => d.max)) : 100;

  const isPercentageScale = rawMin >= 0 && rawMax <= 100 && (
    activeVal.toLowerCase().includes("rate") || 
    activeVal.toLowerCase().includes("score") || 
    activeVal.toLowerCase().includes("percent")
  );

  const minGlobal = isPercentageScale ? 0 : rawMin - (rawMax - rawMin) * 0.05;
  const maxGlobal = isPercentageScale ? 100 : rawMax + (rawMax - rawMin) * 0.05;
  const globalRange = maxGlobal - minGlobal || 1;

  return (
    <div className="space-y-6">
      {/* Control selectors */}
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-lg bg-zinc-950/40 border border-white/5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Group By (Dimension)
          </label>
          <select
            value={activeDim}
            onChange={(e) => setDimensionKey(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
          >
            {dimensionKeys.map((k) => (
              <option key={k} value={k}>
                {getFieldLabel(k)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Metric (Numerical Value)
          </label>
          <select
            value={activeVal}
            onChange={(e) => setValueKey(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
          >
            {valueKeys.map((k) => (
              <option key={k} value={k}>
                {getFieldLabel(k)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Box and whisker distribution card */}
      <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="h-4 w-4 text-emerald-400" />
            Distribution of {getFieldLabel(activeVal)} by {getFieldLabel(activeDim)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {statsData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-slate-500">
              No numerical distribution data to analyze.
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1">
              {statsData.map((d, idx) => {
                const leftWhisker = ((d.min - minGlobal) / globalRange) * 100;
                const rightWhisker = ((d.max - minGlobal) / globalRange) * 100;
                const leftBox = ((d.q1 - minGlobal) / globalRange) * 100;
                const rightBox = ((d.q3 - minGlobal) / globalRange) * 100;
                const medianPos = ((d.median - minGlobal) / globalRange) * 100;
                const meanPos = ((d.mean - minGlobal) / globalRange) * 100;

                return (
                  <div key={idx} className="flex items-center gap-4 text-[10px]">
                    <div className="w-[120px] truncate text-slate-300 font-semibold" title={d.dimension}>
                      {d.dimension}
                    </div>
                    <div className="flex-1 relative h-7 bg-white/5 border border-white/5 rounded flex items-center group">
                      {/* Whisker Line */}
                      <div
                        className="absolute h-0.5 bg-slate-500"
                        style={{ left: `${leftWhisker}%`, right: `${100 - rightWhisker}%` }}
                      />
                      {/* Whisker End-Ticks */}
                      <div className="absolute w-0.5 h-3.5 bg-slate-400" style={{ left: `${leftWhisker}%` }} />
                      <div className="absolute w-0.5 h-3.5 bg-slate-400" style={{ left: `${rightWhisker}%` }} />
                      {/* Box (Q1 to Q3) */}
                      <div
                        className="absolute h-4.5 bg-blue-500/20 border border-blue-500/60 rounded-sm"
                        style={{ left: `${leftBox}%`, right: `${100 - rightBox}%` }}
                      />
                      {/* Median Line */}
                      <div className="absolute w-0.5 h-5 bg-rose-500" style={{ left: `${medianPos}%` }} />
                      {/* Mean Dot */}
                      <div
                        className="absolute w-2 h-2 rounded-full bg-emerald-400 border border-black shadow"
                        style={{ left: `calc(${meanPos}% - 4px)` }}
                      />
                      
                      {/* Tooltip on Hover */}
                      <div className="absolute opacity-0 group-hover:opacity-100 bg-zinc-900 border border-white/10 p-2.5 rounded shadow-2xl text-[9px] pointer-events-none transition-opacity duration-150 z-20 -top-14 left-1/2 -translate-x-1/2 flex gap-3 whitespace-nowrap text-slate-300">
                        <span>Min: <strong className="text-white">{d.min}</strong></span>
                        <span>Q1: <strong className="text-white">{d.q1}</strong></span>
                        <span>Med: <strong className="text-rose-400">{d.median}</strong></span>
                        <span>Q3: <strong className="text-white">{d.q3}</strong></span>
                        <span>Max: <strong className="text-white">{d.max}</strong></span>
                        <span>Mean: <strong className="text-emerald-400">{d.mean}</strong></span>
                        <span>Count: <strong className="text-slate-400">{d.count}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
