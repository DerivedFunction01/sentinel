"use client";

import { useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SCAN_FIELDS, TRIAL_FIELDS } from "./constants";

/** Shared colour palette used across all chart types. */
const CHART_COLORS = [
  "#3b82f6", // blue
  "#e11d48", // rose
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

// ─── FlatCharts ───────────────────────────────────────────────────────────────

interface FlatChartsProps {
  chartTypeSelection: "auto" | "bar" | "line" | "pie" | "histogram" | "scatter";
  setChartTypeSelection: (
    v: "auto" | "bar" | "line" | "pie" | "histogram" | "scatter",
  ) => void;
  chartData: {
    data: any[];
    xAxisKey: string;
    keys: string[];
    isTemporal: boolean;
    isCategoricalFrequency?: boolean;
    isGroupedQuery?: boolean;
  };
}

/** Classify metric key to rate/score, distribution (trials/runs), or count/cost */
function getMetricType(
  key: string,
): "rate_or_score" | "distribution" | "count_or_cost" {
  const normalized = key.toLowerCase();
  if (
    normalized.includes("rate") ||
    normalized.includes("score") ||
    normalized.includes("ratio") ||
    normalized.includes("pct") ||
    normalized.includes("percent")
  ) {
    return "rate_or_score";
  }
  if (
    normalized.includes("trial") ||
    normalized.includes("run") ||
    normalized.includes("scan_count")
  ) {
    return "distribution";
  }
  return "count_or_cost";
}

export function FlatCharts({
  chartTypeSelection,
  setChartTypeSelection,
  chartData,
}: FlatChartsProps) {
  // 1. Resolve localized chart type for each key individually (under auto mode)
  const resolveChartTypeForKey = useCallback(
    (key: string, distinctCount: number, isCategorical: boolean) => {
      if (chartTypeSelection !== "auto") return chartTypeSelection;
      if (isCategorical) {
        if (distinctCount <= 5) return "pie";
        return "bar";
      }

      // Detect if categorical labels on X-axis are identical/redundant (e.g. 10 rows all labeled the same)
      const labels = chartData.data.map((row) =>
        String(row[chartData.xAxisKey] ?? ""),
      );
      const uniqueLabels = new Set(labels).size;
      const totalRows = chartData.data.length;

      // Only render Line Chart if there are at least 3 distinct date values to show a real trend
      if (chartData.isTemporal && uniqueLabels >= 3) return "line";

      const labelsAreRedundant =
        uniqueLabels <= 1 || (totalRows > 3 && uniqueLabels < totalRows * 0.4);
      const isAggregatedSummary =
        !!chartData.isGroupedQuery ||
        (uniqueLabels === totalRows && totalRows > 1);

      const type = getMetricType(key);
      if (type === "distribution") {
        if (isAggregatedSummary) return "bar";
        return "histogram";
      }

      if (type === "rate_or_score") {
        if (isAggregatedSummary) return "bar";
        if (distinctCount > 10 || labelsAreRedundant) return "histogram";
        return "bar";
      } else {
        // count_or_cost
        if (isAggregatedSummary) return "bar";
        if (distinctCount <= 5) return "pie";
        if (distinctCount > 10 || labelsAreRedundant) return "histogram";
        return "bar";
      }
    },
    [
      chartTypeSelection,
      chartData.isTemporal,
      chartData.data,
      chartData.xAxisKey,
      chartData.isGroupedQuery,
    ],
  );

  // Render a single sub-chart card for a given key
  const renderSubChartCard = (key: string, idx: number) => {
    const firstRow = chartData.data[0];
    const rawFirstVal = firstRow ? firstRow[key] : null;
    let parsedFirstVal = rawFirstVal;
    if (typeof rawFirstVal === "string" && rawFirstVal.startsWith("{")) {
      try {
        parsedFirstVal = JSON.parse(rawFirstVal);
      } catch (e) {}
    }
    const isStatObject = !!(
      parsedFirstVal &&
      typeof parsedFirstVal === "object" &&
      (parsedFirstVal as any)._isStatObj
    );
    const isCategorical =
      firstRow && !isStatObject
        ? typeof firstRow[key] === "string" ||
          typeof firstRow[key] === "boolean"
        : false;
    const metricType = getMetricType(key);
    const dataPoints = chartData.data.map((d) => d[key]);
    const distinctValues = new Set(
      dataPoints.filter((v) => v !== undefined && v !== null),
    ).size;
    const resolvedType = isStatObject
      ? "box"
      : resolveChartTypeForKey(key, distinctValues, isCategorical);
    const color = CHART_COLORS[idx % CHART_COLORS.length];

    // frequency data helper for non-numerical categorical columns
    const freqData = (() => {
      if (!isCategorical) return [];
      const counts: Record<string, number> = {};
      for (const d of chartData.data) {
        const val = String(d[key] ?? "null");
        counts[val] = (counts[val] || 0) + 1;
      }
      const sorted = Object.keys(counts)
        .map((name) => ({ name, count: counts[name] }))
        .sort((a, b) => b.count - a.count);

      if (sorted.length <= 15) return sorted;

      const head = sorted.slice(0, 14);
      const tail = sorted.slice(14);
      const tailSum = tail.reduce((sum, item) => sum + item.count, 0);
      const maxHead = Math.max(...head.map((h) => h.count), 0);

      if (tailSum > maxHead) {
        const avg = Number((tailSum / tail.length).toFixed(1));
        return [...head, { name: "Other (Avg)", count: avg }];
      }
      return [...head, { name: "Other (Sum)", count: tailSum }];
    })();

    // Localized Histogram computation
    const histogramData = (() => {
      if (isCategorical) return [];
      const vals = dataPoints.map(Number).filter((v) => !isNaN(v));
      if (vals.length === 0) return [];
      const minVal = Math.min(...vals);
      const maxVal = Math.max(...vals);
      const numBins = Math.min(10, vals.length);
      const range = maxVal - minVal;

      if (range === 0) {
        return [{ rangeLabel: `${minVal.toFixed(1)}`, count: vals.length }];
      }

      const binWidth = range / numBins;
      const bins = Array.from({ length: numBins }, (_, i) => {
        const start = minVal + i * binWidth;
        const end = start + binWidth;
        return {
          start,
          end,
          rangeLabel: `${start.toFixed(1)} - ${end.toFixed(1)}`,
          count: 0,
        };
      });

      for (const v of vals) {
        for (let i = 0; i < numBins; i++) {
          const bin = bins[i];
          if (i === numBins - 1) {
            if (v >= bin.start && v <= bin.end) {
              bin.count++;
              break;
            }
          } else {
            if (v >= bin.start && v < bin.end) {
              bin.count++;
              break;
            }
          }
        }
      }
      return bins;
    })();

    // Localized Pie chart data sorting and slice capping
    const pieData = (() => {
      if (isCategorical) {
        // Cap slice count for categorical frequency pie charts
        if (freqData.length <= 5)
          return freqData.map((d) => ({ name: d.name, value: d.count }));
        const head = freqData
          .slice(0, 4)
          .map((d) => ({ name: d.name, value: d.count }));
        const tail = freqData.slice(4);
        const tailSum = tail.reduce((sum, item) => sum + item.count, 0);
        const maxHead = Math.max(...head.map((h) => h.value), 0);

        if (tailSum > maxHead) {
          const avg = Number((tailSum / tail.length).toFixed(1));
          return [...head, { name: "Other (Avg)", value: avg }];
        }
        return [...head, { name: "Other (Sum)", value: tailSum }];
      }

      const sorted = [...chartData.data]
        .map((row) => ({
          name: String(row[chartData.xAxisKey] ?? ""),
          value: Number(row[key]) || 0,
        }))
        .sort((a, b) => b.value - a.value);

      if (sorted.length <= 5) return sorted;

      const head = sorted.slice(0, 4);
      const tail = sorted.slice(4);
      const tailSum = tail.reduce((sum, item) => sum + item.value, 0);
      const maxHead = Math.max(...head.map((h) => h.value), 0);

      if (tailSum > 0) {
        if (tailSum > maxHead) {
          const avg = Number((tailSum / tail.length).toFixed(2));
          return [...head, { name: "Other (Avg)", value: avg }];
        }
        return [
          ...head,
          { name: "Other (Sum)", value: Number(tailSum.toFixed(2)) },
        ];
      }
      return head;
    })();

    const yAxisDomain =
      metricType === "rate_or_score" ? ([0, 100] as const) : undefined;
    const shouldRenderHorizontalBar = resolvedType === "bar";

    // Localized Scatter chart data mapping
    const scatterData = (() => {
      return chartData.data.map((row, rIdx) => {
        const xVal = Number(row[chartData.xAxisKey]);
        const yVal = Number(row[key]);
        return {
          x: isNaN(xVal) ? rIdx : xVal,
          y: isNaN(yVal) ? 0 : yVal,
          name: String(row[chartData.xAxisKey] ?? rIdx),
        };
      });
    })();

    // Localized Bar chart data mapping to aggregate rows with duplicate text labels
    const barData = (() => {
      if (resolvedType !== "bar") return [];
      const labelKey = chartData.xAxisKey;
      const uniqueLabels = new Set(
        chartData.data.map((r) => String(r[labelKey] ?? "")),
      );

      if (uniqueLabels.size === chartData.data.length) {
        return chartData.data;
      }

      const grouped: Record<
        string,
        { name: string; sum: number; count: number }
      > = {};
      for (const row of chartData.data) {
        const label = String(row[labelKey] ?? "null");
        const val = Number(row[key]) || 0;
        if (!grouped[label]) {
          grouped[label] = { name: label, sum: 0, count: 0 };
        }
        grouped[label].sum += val;
        grouped[label].count += 1;
      }

      return Object.values(grouped).map((g) => {
        const isAvg = metricType === "rate_or_score";
        return {
          [labelKey]: g.name,
          [key]: isAvg
            ? Number((g.sum / g.count).toFixed(2))
            : Number(g.sum.toFixed(2)),
        };
      });
    })();

    return (
      <div
        key={key}
        className="border border-white/5 bg-zinc-950/40 p-4 rounded-lg flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            {key.replace(/_/g, " ")} {isCategorical ? "(Frequency)" : ""}
          </span>
          <Badge
            variant="outline"
            className="text-[9px] uppercase tracking-normal"
          >
            {resolvedType}{" "}
            {metricType === "rate_or_score" && !isCategorical ? "(0-100%)" : ""}
          </Badge>
        </div>

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {isCategorical && resolvedType !== "pie" ? (
              /* Horizontal Bar Chart for Categorical Frequency counts */
              <BarChart layout="vertical" data={freqData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                  }}
                  labelClassName="text-slate-400 font-bold text-xs"
                />
                <Bar
                  name="Record Count"
                  dataKey="count"
                  fill={color}
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            ) : resolvedType === "line" ? (
              <LineChart data={chartData.data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey={chartData.xAxisKey}
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                  domain={yAxisDomain}
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                  }}
                  labelClassName="text-slate-400 font-bold text-xs"
                />
                <Line
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            ) : resolvedType === "pie" ? (
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                  }}
                  labelClassName="text-slate-400 font-bold text-xs"
                />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  fill={color}
                  label={{ fontSize: 9, fill: "#94a3b8" }}
                >
                  {pieData.map((_, pIdx) => (
                    <Cell
                      key={`cell-${pIdx}`}
                      fill={CHART_COLORS[pIdx % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            ) : resolvedType === "box" ? (
              /* Custom Box-and-Whisker distribution layout */
              <div className="flex flex-col gap-3 h-[200px] overflow-y-auto custom-scrollbar pr-1">
                {(() => {
                  const getStatObj = (row: any) => {
                    const rawVal = row[key];
                    if (typeof rawVal === "string" && rawVal.startsWith("{")) {
                      try {
                        return JSON.parse(rawVal);
                      } catch (e) {}
                    }
                    return (
                      rawVal || {
                        min: 0,
                        q1: 0,
                        median: 0,
                        q3: 0,
                        max: 0,
                        mean: 0,
                        count: 0,
                      }
                    );
                  };

                  const minGlobal = Math.min(
                    ...chartData.data.map((row) =>
                      Number(getStatObj(row)?.min ?? 0),
                    ),
                  );
                  const maxGlobal = Math.max(
                    ...chartData.data.map((row) =>
                      Number(getStatObj(row)?.max ?? 100),
                    ),
                  );
                  const globalRange = maxGlobal - minGlobal || 1;

                  return chartData.data.map((row, rIdx) => {
                    const rowKeys = Object.keys(row);
                    const labelKey =
                      rowKeys.find(
                        (k) =>
                          k !== key &&
                          (typeof row[k] === "string" ||
                            typeof row[k] === "boolean"),
                      ) || rowKeys[0];
                    const label = String(row[labelKey] ?? `Item ${rIdx}`);
                    const stat = getStatObj(row);

                    const leftWhisker =
                      ((stat.min - minGlobal) / globalRange) * 100;
                    const rightWhisker =
                      ((stat.max - minGlobal) / globalRange) * 100;
                    const leftBox = ((stat.q1 - minGlobal) / globalRange) * 100;
                    const rightBox =
                      ((stat.q3 - minGlobal) / globalRange) * 100;
                    const medianPos =
                      ((stat.median - minGlobal) / globalRange) * 100;
                    const meanPos =
                      ((stat.mean - minGlobal) / globalRange) * 100;

                    return (
                      <div
                        key={rIdx}
                        className="flex items-center gap-4 text-[10px]"
                      >
                        <div
                          className="w-[100px] truncate text-slate-300 font-semibold"
                          title={label}
                        >
                          {label}
                        </div>
                        <div className="flex-1 relative h-6 bg-white/5 border border-white/5 rounded flex items-center group">
                          {/* Whisker Line */}
                          <div
                            className="absolute h-0.5 bg-slate-500"
                            style={{
                              left: `${leftWhisker}%`,
                              right: `${100 - rightWhisker}%`,
                            }}
                          />
                          {/* Whisker End-Ticks */}
                          <div
                            className="absolute w-0.5 h-3 bg-slate-400"
                            style={{ left: `${leftWhisker}%` }}
                          />
                          <div
                            className="absolute w-0.5 h-3 bg-slate-400"
                            style={{ left: `${rightWhisker}%` }}
                          />
                          {/* Box (Q1 to Q3) */}
                          <div
                            className="absolute h-4 bg-blue-500/30 border border-blue-500/70 rounded-sm"
                            style={{
                              left: `${leftBox}%`,
                              right: `${100 - rightBox}%`,
                            }}
                          />
                          {/* Median Line */}
                          <div
                            className="absolute w-0.5 h-4 bg-rose-500"
                            style={{ left: `${medianPos}%` }}
                            title={`Median: ${stat.median}`}
                          />
                          {/* Mean Dot */}
                          <div
                            className="absolute w-2 h-2 rounded-full bg-emerald-400 border border-black shadow"
                            style={{ left: `calc(${meanPos}% - 4px)` }}
                            title={`Mean: ${stat.mean}`}
                          />

                          {/* Tooltip on Hover */}
                          <div className="absolute opacity-0 group-hover:opacity-100 bg-zinc-900 border border-white/10 p-2 rounded shadow-xl text-[9px] pointer-events-none transition-opacity z-10 -top-12 left-1/2 -translate-x-1/2 flex gap-2 whitespace-nowrap text-slate-300">
                            <span>
                              Min: <strong>{stat.min}</strong>
                            </span>
                            <span>
                              Q1: <strong>{stat.q1}</strong>
                            </span>
                            <span>
                              Med:{" "}
                              <strong className="text-rose-400">
                                {stat.median}
                              </strong>
                            </span>
                            <span>
                              Q3: <strong>{stat.q3}</strong>
                            </span>
                            <span>
                              Max: <strong>{stat.max}</strong>
                            </span>
                            <span>
                              Count: <strong>{stat.count}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : resolvedType === "scatter" ? (
              <ScatterChart>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={chartData.xAxisKey}
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={key}
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                  domain={yAxisDomain}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                  }}
                  labelClassName="text-slate-400 font-bold text-xs"
                />
                <Scatter name={key} data={scatterData} fill={color} />
              </ScatterChart>
            ) : resolvedType === "histogram" ? (
              <BarChart data={histogramData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="rangeLabel"
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                  }}
                  labelClassName="text-slate-400 font-bold text-xs"
                />
                <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : shouldRenderHorizontalBar ? (
              <BarChart layout="vertical" data={barData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey={chartData.xAxisKey}
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                  }}
                  labelClassName="text-slate-400 font-bold text-xs"
                />
                <Bar dataKey={key} fill={color} radius={[0, 3, 3, 0]} />
              </BarChart>
            ) : (
              <BarChart data={barData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey={chartData.xAxisKey}
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                  domain={yAxisDomain}
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                  }}
                  labelClassName="text-slate-400 font-bold text-xs"
                />
                <Bar dataKey={key} fill={color} radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Filter out keys that have only zero or invalid/null values, or are marked hidden/noChart in schema
  const meaningfulKeys = useMemo(() => {
    const isFieldHidden = (k: string) => {
      const match = [...SCAN_FIELDS, ...TRIAL_FIELDS].find(
        (f) => f.name === k,
      ) as any;
      return match ? !!match.hidden : false;
    };

    const isFieldNoChart = (k: string) => {
      const match = [...SCAN_FIELDS, ...TRIAL_FIELDS].find(
        (f) => f.name === k,
      ) as any;
      return match ? !!match.noChart : false;
    };

    const firstRow = chartData.data[0];
    if (!firstRow) return [];

    return chartData.keys.filter((key) => {
      if (isFieldHidden(key)) return false;
      if (isFieldNoChart(key)) return false;
      // Do not render the grouping key as its own independent card in a grouped query
      if (chartData.isGroupedQuery && key === chartData.xAxisKey) return false;

      const rawVal = firstRow[key];
      let parsedVal = rawVal;
      if (typeof rawVal === "string" && rawVal.startsWith("{")) {
        try {
          parsedVal = JSON.parse(rawVal);
        } catch (e) {}
      }
      const isStat = !!(
        parsedVal &&
        typeof parsedVal === "object" &&
        (parsedVal as any)._isStatObj
      );
      if (isStat) return true;

      const isColCategorical =
        typeof firstRow[key] === "string" || typeof firstRow[key] === "boolean";
      if (isColCategorical) {
        return chartData.data.some(
          (d) => d[key] !== undefined && d[key] !== null && d[key] !== "",
        );
      } else {
        return chartData.data.some((d) => {
          const val = Number(d[key]);
          return !isNaN(val) && val !== 0;
        });
      }
    });
  }, [
    chartData.keys,
    chartData.data,
    chartData.isGroupedQuery,
    chartData.xAxisKey,
  ]);

  const isMultiGrid = meaningfulKeys.length > 1;

  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Query Visualizations Plot
        </CardTitle>
        <div className="flex bg-muted p-0.5 rounded text-[10px]">
          {(
            ["auto", "bar", "line", "pie", "histogram", "scatter"] as const
          ).map((type) => (
            <button
              key={type}
              onClick={() => setChartTypeSelection(type)}
              className={`px-2 py-0.5 rounded font-medium uppercase transition-colors ${
                chartTypeSelection === type
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {meaningfulKeys.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-center text-xs text-muted-foreground border border-dashed border-white/5 rounded-lg">
            No active non-zero metrics to plot.
          </div>
        ) : (
          <div
            className={
              isMultiGrid
                ? "grid grid-cols-1 md:grid-cols-2 gap-6"
                : "grid grid-cols-1"
            }
          >
            {meaningfulKeys.map(renderSubChartCard)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── FlatDataTable ────────────────────────────────────────────────────────────

interface FieldDef {
  name: string;
  label: string;
  type: string;
  desc: string;
}

export function getFriendlyHeaderLabel(
  key: string,
  currentFields: FieldDef[],
): string {
  const matched = currentFields.find((cf) => cf.name === key);
  if (matched) return matched.label || matched.name;

  const parts = key.split("_");
  if (parts.length >= 2) {
    const aggSuffixes = [
      "count",
      "sum",
      "avg",
      "min",
      "max",
      "median",
      "range",
      "std",
      "dev",
      "std_dev",
    ];
    let suffix = parts[parts.length - 1];
    let baseKey = parts.slice(0, -1).join("_");

    // Handle std_dev double suffix
    if (suffix === "dev" && parts[parts.length - 2] === "std") {
      suffix = "std_dev";
      baseKey = parts.slice(0, -2).join("_");
    }

    const baseMatched = currentFields.find((cf) => cf.name === baseKey);
    if (baseMatched) {
      const baseLabel = baseMatched.label || baseMatched.name;
      const aggLabelMap: Record<string, string> = {
        count: "Count",
        sum: "Sum",
        avg: "Average",
        min: "Minimum",
        max: "Maximum",
        median: "Median",
        range: "Range",
        std: "Std Dev",
        std_dev: "Std Dev",
      };
      return `${baseLabel} (${aggLabelMap[suffix] || suffix})`;
    }
  }
  return key;
}

interface FlatDataTableProps {
  results: any[];
  currentFields: FieldDef[];
  useFriendlyNames: boolean;
}

export function FlatDataTable({
  results,
  currentFields,
  useFriendlyNames,
}: FlatDataTableProps) {
  const handleCsvExport = () => {
    const csvRows: string[] = [];
    const headers = Object.keys(results[0]);
    csvRows.push(headers.join(","));
    for (const row of results) {
      csvRows.push(
        headers
          .map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `query_export_${Date.now()}.csv`);
    a.click();
  };

  // Derive a stable column set across ALL rows, not just the first, so ragged
  // rows (e.g. SELECT * where some records omit optional fields) keep aligned.
  const columns = useMemo(() => {
    if (results.length === 0) return [];
    return Array.from(new Set(results.flatMap((r) => Object.keys(r))));
  }, [results]);

  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Result Row Console ({results.length} Records)
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCsvExport}
          className="border-white/10 text-xs gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          CSV Export
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="min-w-full divide-y divide-white/5 text-xs text-left">
          <thead className="bg-white/[0.02] text-muted-foreground font-semibold">
            <tr>
              {columns.map((key) => {
                const label = getFriendlyHeaderLabel(key, currentFields);
                return (
                  <th key={key} className="px-4 py-2.5">
                    {useFriendlyNames ? label : key}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono text-slate-300">
            {results.slice(0, 100).map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-white/[0.02]">
                {columns.map((key) => {
                  if (
                    !(key in row) ||
                    row[key] === undefined ||
                    row[key] === null
                  ) {
                    return (
                      <td
                        key={key}
                        className="px-4 py-2 max-w-[250px] truncate text-muted-foreground/50"
                      >
                        -
                      </td>
                    );
                  }
                  if (typeof row[key] === "object") {
                    const json = JSON.stringify(row[key]);
                    const capped =
                      json.length > 80 ? json.slice(0, 80) + "…" : json;
                    return (
                      <td
                        key={key}
                        className="px-4 py-2 max-w-[250px] truncate"
                        title={json}
                      >
                        {capped}
                      </td>
                    );
                  }
                  return (
                    <td key={key} className="px-4 py-2 max-w-[250px] truncate">
                      {String(row[key])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {results.length > 100 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-white/5">
            Showing first 100 records only. Export to CSV to view full dataset.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PivotTableControls ───────────────────────────────────────────────────────

interface PivotTableControlsProps {
  pivotRowKey: string;
  setPivotRowKey: (v: string) => void;
  pivotColKey: string;
  setPivotColKey: (v: string) => void;
  pivotValueKey: string;
  setPivotValueKey: (v: string) => void;
  pivotAggType: "count" | "sum" | "avg";
  setPivotAggType: (v: "count" | "sum" | "avg") => void;
  enablePivotHeatmap: boolean;
  setEnablePivotHeatmap: (v: boolean) => void;
  currentFields: FieldDef[];
  useFriendlyNames: boolean;
}

export function PivotTableControls({
  pivotRowKey,
  setPivotRowKey,
  pivotColKey,
  setPivotColKey,
  pivotValueKey,
  setPivotValueKey,
  pivotAggType,
  setPivotAggType,
  enablePivotHeatmap,
  setEnablePivotHeatmap,
  currentFields,
  useFriendlyNames,
}: PivotTableControlsProps) {
  const label = (f: FieldDef) =>
    useFriendlyNames ? f.label || f.name : f.name;

  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
            Rows Dimension
          </label>
          <select
            value={pivotRowKey}
            onChange={(e) => setPivotRowKey(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full"
          >
            {currentFields.map((f) => (
              <option key={f.name} value={f.name}>
                {label(f)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
            Columns Dimension
          </label>
          <select
            value={pivotColKey}
            onChange={(e) => setPivotColKey(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full"
          >
            {currentFields.map((f) => (
              <option key={f.name} value={f.name}>
                {label(f)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
            Aggregated Value
          </label>
          <select
            value={pivotValueKey}
            onChange={(e) => setPivotValueKey(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full"
          >
            <option value="*">Row Count (*)</option>
            {currentFields.map((f) => (
              <option key={f.name} value={f.name}>
                {label(f)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
            Aggregation Function
          </label>
          <select
            value={pivotAggType}
            onChange={(e) =>
              setPivotAggType(e.target.value as "count" | "sum" | "avg")
            }
            className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full"
          >
            <option value="count">COUNT</option>
            <option value="sum">SUM</option>
            <option value="avg">AVERAGE</option>
          </select>
        </div>

        <div className="flex items-center pt-5">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={enablePivotHeatmap}
              onChange={(e) => setEnablePivotHeatmap(e.target.checked)}
              className="rounded border-white/10 bg-zinc-950 text-pink-500 focus:ring-0 h-4 w-4"
            />
            <span>Heatmap Grid Overlay</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PivotTable ───────────────────────────────────────────────────────────────

interface PivotTableProps {
  pivotResults: { pivotedData: any[]; columns: string[] };
  enablePivotHeatmap: boolean;
  pivotValueKey: string;
  currentFields: FieldDef[];
  pivotRowKey: string;
  useFriendlyNames: boolean;
}

export function PivotTable({
  pivotResults,
  enablePivotHeatmap,
  pivotValueKey,
  currentFields,
  pivotRowKey,
  useFriendlyNames,
}: PivotTableProps) {
  // Compute min/max for heatmap
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const row of pivotResults.pivotedData) {
    for (const col of pivotResults.columns) {
      const val = Number(row[col]);
      if (!isNaN(val)) {
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }
  }
  if (minVal === Infinity) minVal = 0;
  if (maxVal === -Infinity) maxVal = 0;

  const getHeatmapBg = (cellVal: any) => {
    if (!enablePivotHeatmap) return undefined;
    const val = Number(cellVal);
    if (isNaN(val) || maxVal === minVal) return undefined;
    const intensity = (val - minVal) / (maxVal - minVal || 1);
    const isBreach = pivotValueKey.toLowerCase().includes("breach");
    const rgb = isBreach ? `225, 29, 72` : `59, 130, 246`;
    return `rgba(${rgb}, ${intensity * 0.4})`;
  };

  const rowLabel =
    currentFields.find((cf) => cf.name === pivotRowKey)?.label || pivotRowKey;

  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pivot Matrix Data Grid
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="min-w-full divide-y divide-white/5 text-xs text-left">
          <thead className="bg-white/[0.02] text-muted-foreground font-semibold">
            <tr>
              <th className="px-4 py-2.5 uppercase tracking-wider text-blue-400">
                {useFriendlyNames ? rowLabel : pivotRowKey}
              </th>
              {pivotResults.columns.map((col) => (
                <th key={col} className="px-4 py-2.5">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono text-slate-300">
            {pivotResults.pivotedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2 font-semibold text-white">
                  {row[pivotRowKey]}
                </td>
                {pivotResults.columns.map((col) => {
                  const cellVal = row[col];
                  return (
                    <td
                      key={`${idx}-${col || ""}`}
                      className="px-4 py-2 transition-colors duration-200"
                      style={{ backgroundColor: getHeatmapBg(cellVal) }}
                    >
                      {cellVal !== undefined ? cellVal : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── PivotChart ───────────────────────────────────────────────────────────────

interface PivotChartProps {
  pivotRowKey: string;
  pivotColKey: string;
  pivotResults: { pivotedData: any[]; columns: string[] };
}

export function PivotChart({
  pivotRowKey,
  pivotColKey,
  pivotResults,
}: PivotChartProps) {
  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pivoted Stacked Chart (Row: {pivotRowKey} × Col: {pivotColKey})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pivotResults.pivotedData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey={pivotRowKey}
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
              />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                }}
                labelClassName="text-slate-400 font-bold text-xs"
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {pivotResults.columns.map((col, idx) => (
                <Bar
                  key={col}
                  dataKey={col}
                  stackId="a"
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
