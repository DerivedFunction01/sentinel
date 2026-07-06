"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Play,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  Database,
  FileCode,
  BookOpen,
  Download,
  HelpCircle,
  AlertCircle,
  Save,
  FolderHeart,
  Upload,
  ChevronRight,
  GitBranch,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  executeQuery,
  executePivot,
  QueryDefinition,
  PivotDefinition,
  FilterCondition,
  Aggregation,
  SortInstruction,
} from "@/lib/dataframe/client-query-engine";
import {
  getAllCachedScanDetails,
  setCachedScanDetail,
  clearCachedReports,
  getSavedQueries,
  saveQuery,
  deleteSavedQuery,
} from "@/lib/indexed-db";
import { translateQueryToPython } from "@/lib/dataframe/python-compiler";
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
} from "recharts";
import { PRESETS } from "./presets";
import { OPERATORS_BY_TYPE, SCAN_FIELDS, TRIAL_FIELDS } from "./constants";

export function FlatCharts(
  setChartTypeSelection,
  chartTypeSelection: string,
  resolvedChartType: string,
  chartData: {
    data: any[];
    pieData: any[];
    xAxisKey: string;
    keys: string[];
    isTemporal: boolean;
    isPieRecommended: boolean;
  },
) {
  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Query Visualizations Plot
          </CardTitle>
        </div>
        <div className="flex bg-muted p-0.5 rounded text-[10px]">
          {["auto", "bar", "line", "pie"].map((type) => (
            <button
              key={type}
              onClick={() => setChartTypeSelection(type as any)}
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
      <CardContent>
        <div className="h-[250px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            {resolvedChartType === "line" ? (
              <LineChart data={chartData.data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey={chartData.xAxisKey}
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
                {chartData.keys.map((key, i) => {
                  const colors = [
                    "#3b82f6",
                    "#e11d48",
                    "#10b981",
                    "#f59e0b",
                    "#8b5cf6",
                    "#ec4899",
                    "#14b8a6",
                    "#f97316",
                  ];
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={colors[i % colors.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  );
                })}
              </LineChart>
            ) : resolvedChartType === "pie" ? (
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                  }}
                  labelClassName="text-slate-400 font-bold text-xs"
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Pie
                  data={chartData.pieData}
                  dataKey={chartData.keys[0]}
                  nameKey={chartData.xAxisKey}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  fill="#3b82f6"
                  label={{ fontSize: 10, fill: "#94a3b8" }}
                >
                  {chartData.pieData.map((entry, idx) => {
                    const colors = [
                      "#3b82f6",
                      "#e11d48",
                      "#10b981",
                      "#f59e0b",
                      "#8b5cf6",
                      "#ec4899",
                      "#14b8a6",
                      "#f97316",
                    ];
                    return (
                      <Cell
                        key={`cell-${idx}`}
                        fill={colors[idx % colors.length]}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={chartData.data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey={chartData.xAxisKey}
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
                {chartData.keys.map((key, i) => {
                  const colors = [
                    "#3b82f6",
                    "#e11d48",
                    "#10b981",
                    "#f59e0b",
                    "#8b5cf6",
                    "#ec4899",
                    "#14b8a6",
                    "#f97316",
                  ];
                  return (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={colors[i % colors.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function FlatDataTable(
  results: any[],
  currentFields: { name: string; label: string; type: string; desc: string }[],
  useFriendlyNames: boolean,
) {
  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Result Row Console ({results.length} Records)
          </CardTitle>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
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
            const blob = new Blob([csvRows.join("\n")], {
              type: "text/csv",
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.setAttribute("href", url);
            a.setAttribute("download", `query_export_${Date.now()}.csv`);
            a.click();
          }}
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
              {Object.keys(results[0]).map((key) => {
                const fieldLabel =
                  currentFields.find((cf) => cf.name === key)?.label || key;
                return (
                  <th key={key} className="px-4 py-2.5">
                    {useFriendlyNames ? fieldLabel : key}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono text-slate-300">
            {results.slice(0, 100).map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-white/[0.02]">
                {Object.keys(row).map((key, cIdx) => (
                  <td key={cIdx} className="px-4 py-2 max-w-[250px] truncate">
                    {typeof row[key] === "object"
                      ? JSON.stringify(row[key])
                      : String(row[key])}
                  </td>
                ))}
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

export function PivotTableControls(
  pivotRowKey: string,
  setPivotRowKey,
  currentFields: { name: string; label: string; type: string; desc: string }[],
  useFriendlyNames: boolean,
  pivotColKey: string,
  setPivotColKey,
  pivotValueKey: string,
  setPivotValueKey,
  pivotAggType: string,
  setPivotAggType,
  enablePivotHeatmap: boolean,
  setEnablePivotHeatmap,
) {
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
                {useFriendlyNames ? f.label || f.name : f.name}
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
                {useFriendlyNames ? f.label || f.name : f.name}
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
                {useFriendlyNames ? f.label || f.name : f.name}
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
            onChange={(e: any) => setPivotAggType(e.target.value)}
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

export function PivotTable(
  pivotResults: { pivotedData: any[]; columns: string[] },
  enablePivotHeatmap: boolean,
  pivotValueKey: string,
  currentFields: { name: string; label: string; type: string; desc: string }[],
  pivotRowKey: string,
  useFriendlyNames: boolean,
) {
  return (() => {
    // Extract min/max values for heatmap overlay
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
                    const bgStyle = getHeatmapBg(cellVal);
                    return (
                      <td
                        key={col}
                        className="px-4 py-2 transition-colors duration-200"
                        style={{ backgroundColor: bgStyle }}
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
  })();
}

export function PivotChart(
  pivotRowKey: string,
  pivotColKey: string,
  pivotResults: { pivotedData: any[]; columns: string[] },
) {
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
              {pivotResults.columns.map((col, idx) => {
                const colors = [
                  "#3b82f6",
                  "#e11d48",
                  "#10b981",
                  "#f59e0b",
                  "#8b5cf6",
                  "#ec4899",
                  "#14b8a6",
                ];
                return (
                  <Bar
                    key={col}
                    dataKey={col}
                    stackId="a"
                    fill={colors[idx % colors.length]}
                    radius={[2, 2, 0, 0]}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
