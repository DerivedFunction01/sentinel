"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, Database, BookOpen, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { executePivot } from "@/lib/dataframe/client-query-engine";
import {
  getAllCachedScanDetails,
  setCachedScanDetail,
  clearCachedReports,
  getSavedQueries,
  saveQuery,
  deleteSavedQuery,
} from "@/lib/indexed-db";
import { PRESETS } from "./presets";
import { sanitizeScan } from "./constants";
import { QueryProvider, useQueryContext } from "./query-context";
import { QueryComposer } from "./query-composer";
import {
  FlatCharts,
  FlatDataTable,
  PivotChart,
  PivotTable,
  PivotTableControls,
} from "./charts";
import { SavedViews, SchemaExplorer } from "./explorer";

// ─── Inner page — has access to QueryContext ────────────────────────────────

function AnalysisConsoleInner({
  scans,
  savedQueries,
  loadSavedQueries,
  useFriendlyNames,
  results,
  setResults,
}: {
  scans: any[];
  savedQueries: any[];
  loadSavedQueries: () => Promise<void>;
  useFriendlyNames: boolean;
  results: any[];
  setResults: (r: any[]) => void;
}) {
  const {
    currentFields,
    setSourceType,
    setSelectedViewId,
    setFilters,
    groupBy,
    setGroupBy,
    setAggregations,
    setSortInstructions,
    setLimit,
    setProjections,
    setSetOp,
    setSubQueryFilters,
    pivotConfig,
    setPivotConfig,
  } = useQueryContext();

  const {
    rowKey: pivotRowKey,
    colKey: pivotColKey,
    valueKey: pivotValueKey,
    aggType: pivotAggType,
    enableHeatmap: enablePivotHeatmap,
  } = pivotConfig;

  const setPivotRowKey = (v: string) =>
    setPivotConfig({ ...pivotConfig, rowKey: v });
  const setPivotColKey = (v: string) =>
    setPivotConfig({ ...pivotConfig, colKey: v });
  const setPivotValueKey = (v: string) =>
    setPivotConfig({ ...pivotConfig, valueKey: v });
  const setPivotAggType = (v: "count" | "sum" | "avg") =>
    setPivotConfig({ ...pivotConfig, aggType: v });
  const setEnablePivotHeatmap = (v: boolean) =>
    setPivotConfig({ ...pivotConfig, enableHeatmap: v });

  // ── Results view ────────────────────────────────────────────────────────
  const [resultsTab, setResultsTab] = useState<"flat" | "pivot">("flat");

  // ── Chart selectors ─────────────────────────────────────────────────────
  const [chartTypeSelection, setChartTypeSelection] = useState<"auto" | "bar" | "line" | "pie" | "histogram" | "scatter">("auto");

  // ── Available pivot fields (only columns present in the current results) ──
  const availablePivotFields = useMemo(() => {
    if (results.length === 0) return currentFields;
    const resultKeys = Object.keys(results[0]);
    return resultKeys.map((key) => {
      const matched = currentFields.find((f) => f.name === key);
      return matched ?? { name: key, label: key, type: "string", desc: key };
    });
  }, [results, currentFields]);

  // Auto-reset pivot keys if they're no longer in the available fields
  useEffect(() => {
    if (availablePivotFields.length === 0) return;
    const keys = availablePivotFields.map((f) => f.name);
    const firstKey = keys[0];
    if (!keys.includes(pivotRowKey)) setPivotRowKey(firstKey);
    if (!keys.includes(pivotColKey)) setPivotColKey(keys[1] ?? firstKey);
    // pivotValueKey "*" is always valid (row count)
    if (pivotValueKey !== "*" && !keys.includes(pivotValueKey)) setPivotValueKey("*");
  }, [availablePivotFields]);

  // ── Preset loader ───────────────────────────────────────────────────────
  const loadPreset = (preset: (typeof PRESETS)[0]) => {
    setSourceType(preset.query.table || "scans");
    setFilters(preset.query.filters || []);
    setGroupBy(preset.query.group_by || []);
    setAggregations(preset.query.aggregations || []);
    setSortInstructions(preset.query.sort || []);
    setLimit(preset.query.limit || "");
    setProjections(preset.query.projections || []);
    setSetOp("none");
    setSubQueryFilters([]);
    toast.info(`Loaded preset: ${preset.name}`);
  };

  // ── Saved view loader ───────────────────────────────────────────────────
  const loadSavedQueryDef = (saved: any) => {
    const q = saved.query;
    if (q.sourceViewId) {
      setSourceType("view");
      setSelectedViewId(q.sourceViewId);
    } else {
      setSourceType(q.table || "scans");
    }
    setFilters(q.filters || []);
    setGroupBy(q.group_by || []);
    setAggregations(q.aggregations || []);
    setSortInstructions(q.sort || []);
    setLimit(q.limit || "");
    setProjections(q.projections || []);

    if (q.union) {
      setSetOp("union");
    } else if (q.intersect) {
      setSetOp("intersect");
    } else if (q.except) {
      setSetOp("except");
    } else {
      setSetOp("none");
      setSubQueryFilters([]);
    }
    if (saved.pivotConfig) {
      setPivotConfig({
        rowKey: saved.pivotConfig.rowKey,
        colKey: saved.pivotConfig.colKey,
        valueKey: saved.pivotConfig.valueKey,
        aggType: saved.pivotConfig.aggType,
        enableHeatmap: saved.pivotConfig.enableHeatmap,
      });
    }
    toast.info(`Loaded view: ${saved.name}`);
  };

  // ── Export/import helpers ───────────────────────────────────────────────
  const handleExportQueries = () => {
    if (savedQueries.length === 0) {
      toast.error("No saved queries to export.");
      return;
    }
    const lines = savedQueries.map((q) => JSON.stringify(q)).join("\n");
    const blob = new Blob([lines], { type: "application/jsonl" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `saved_queries_export_${Date.now()}.jsonl`);
    a.click();
    toast.success("Exported saved queries configurations!");
  };

  const handleImportQueries = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim());
        let count = 0;
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.id && parsed.name && parsed.query) {
            await saveQuery(
              parsed.id,
              parsed.name,
              parsed.query,
              parsed.pivotConfig || null,
              parsed.selectableColumns,
            );
            count++;
          }
        }
        toast.success(`Successfully imported ${count} queries!`);
        loadSavedQueries();
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse query config file.");
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteQuery = async (id: string) => {
    try {
      await deleteSavedQuery(id);
      toast.success("Query view deleted.");
      loadSavedQueries();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Derived chart data ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (results.length === 0) return null;
    const firstRow = results[0];
    const rowKeys = Object.keys(firstRow);

    // Prioritized temporal/timeline key (useful if rendering timeline comparison)
    const xAxisKey = (() => {
      // 0. Group by fields (highest priority for grouped summary metrics comparison)
      const activeGroup = rowKeys.find((k) =>
        groupBy.some((g) => g === k || g.replace(/_/g, "").toLowerCase() === k.replace(/_/g, "").toLowerCase())
      );
      if (activeGroup) return activeGroup;

      // 1. Time fields (high priority for timelines)
      const timeField = rowKeys.find((k) => k === "createdAt" || k.startsWith("createdAt_"));
      if (timeField) return timeField;

      // 2. High-quality categorical/entity keys
      const highQualityEntities = [
        "targetModel",
        "attackerModel",
        "judgeModel",
        "forbiddenTask",
        "taskTag",
        "tag",
        "category",
        "verdict",
      ];
      const entityField = rowKeys.find((k) => highQualityEntities.includes(k));
      if (entityField) return entityField;

      // 3. Any string field that is not an ID
      const blacklistedIds = ["id", "scanid", "reportid", "runid", "trialid"];
      const generalStringField = rowKeys.find(
        (k) => typeof firstRow[k] === "string" && !blacklistedIds.includes(k.toLowerCase()),
      );
      if (generalStringField) return generalStringField;
      return "targetModel";
    })();

    const blacklistedIds = ["id", "scanid", "reportid", "runid", "trialid"];
    // Keys of fields that are chartable (exclude raw IDs, complex arrays, and internal fields)
    const keys = rowKeys.filter((key) => {
      const val = firstRow[key];
      return (
        key !== "trials" &&
        key !== "tags" &&
        !blacklistedIds.includes(key.toLowerCase()) &&
        (typeof val === "number" || typeof val === "string" || typeof val === "boolean")
      );
    });

    if (keys.length === 0) return null;

    const isTemporal = xAxisKey === "createdAt" || xAxisKey.startsWith("createdAt_");

    const formattedData = results.map((row) => {
      const item = { ...row };
      if (item.createdAt && typeof item.createdAt === "string") {
        item.createdAt = item.createdAt.split("T")[0];
      }
      return item;
    });

    return {
      data: formattedData,
      xAxisKey,
      keys,
      isTemporal,
      isGroupedQuery: groupBy.length > 0,
    };
  }, [results, groupBy]);

  const pivotResults = useMemo(() => {
    if (results.length === 0 || !pivotRowKey || !pivotColKey) return null;
    try {
      return executePivot(results, { rowKey: pivotRowKey, colKey: pivotColKey, valueKey: pivotValueKey, aggType: pivotAggType });
    } catch (e: any) {
      console.error("Pivot execution failed:", e);
      return null;
    }
  }, [results, pivotRowKey, pivotColKey, pivotValueKey, pivotAggType]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-6">
        <SavedViews
          savedQueries={savedQueries}
          loadSavedQueryDef={loadSavedQueryDef}
          handleDeleteQuery={handleDeleteQuery}
          handleExportQueries={handleExportQueries}
          handleImportQueries={handleImportQueries}
        />
        <SchemaExplorer useFriendlyNames={useFriendlyNames} />
      </div>

      {/* Main builder + results area */}
      <div className="lg:col-span-3 space-y-6">
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={() => loadPreset(p)}
              className="border-white/5 bg-background/35 text-xs hover:bg-white/5 text-slate-300"
            >
              <BookOpen className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
              {p.name}
            </Button>
          ))}
        </div>

        <QueryComposer useFriendlyNames={useFriendlyNames} />

        {/* Results area */}
        {results.length > 0 && (
          <div className="space-y-6">
            {/* Results tab switcher */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setResultsTab("flat")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                  resultsTab === "flat"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-muted-foreground hover:text-white"
                }`}
              >
                Flat Grid Results
              </button>
              <button
                onClick={() => setResultsTab("pivot")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  resultsTab === "pivot"
                    ? "border-pink-500 text-white"
                    : "border-transparent text-muted-foreground hover:text-white"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Pivot Matrix Console
              </button>
            </div>

            {resultsTab === "flat" ? (
              <div className="space-y-6">
                {chartData && (
                  <FlatCharts
                    chartTypeSelection={chartTypeSelection}
                    setChartTypeSelection={setChartTypeSelection}
                    chartData={chartData}
                  />
                )}
                <FlatDataTable
                  results={results}
                  currentFields={currentFields}
                  useFriendlyNames={useFriendlyNames}
                />
              </div>
            ) : (
              <div className="space-y-6">
                <PivotTableControls
                  pivotRowKey={pivotRowKey}
                  setPivotRowKey={setPivotRowKey}
                  pivotColKey={pivotColKey}
                  setPivotColKey={setPivotColKey}
                  pivotValueKey={pivotValueKey}
                  setPivotValueKey={setPivotValueKey}
                  pivotAggType={pivotAggType}
                  setPivotAggType={setPivotAggType}
                  enablePivotHeatmap={enablePivotHeatmap}
                  setEnablePivotHeatmap={setEnablePivotHeatmap}
                  currentFields={availablePivotFields}
                  useFriendlyNames={useFriendlyNames}
                />
                {pivotResults && pivotResults.pivotedData.length > 0 && (
                  <PivotChart
                    pivotRowKey={pivotRowKey}
                    pivotColKey={pivotColKey}
                    pivotResults={pivotResults}
                  />
                )}
                {pivotResults && (
                  <PivotTable
                    pivotResults={pivotResults}
                    enablePivotHeatmap={enablePivotHeatmap}
                    pivotValueKey={pivotValueKey}
                    currentFields={availablePivotFields}
                    pivotRowKey={pivotRowKey}
                    useFriendlyNames={useFriendlyNames}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page root — owns scans/cache and renders QueryProvider ─────────────────

export default function AnalysisConsolePage() {
  const [scans, setScans] = useState<any[]>([]);
  const [savedQueries, setSavedQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [useFriendlyNames, setUseFriendlyNames] = useState(true);

  useEffect(() => {
    loadCachedScans();
    loadSavedQueries();
  }, []);

  const loadCachedScans = async () => {
    setLoading(true);
    try {
      const cached = await getAllCachedScanDetails();
      setScans((cached || []).map(sanitizeScan));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load local scans from cache");
    } finally {
      setLoading(false);
    }
  };

  const loadSavedQueries = async () => {
    try {
      const queries = await getSavedQueries();
      setSavedQueries(queries || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const toastId = toast.loading("Syncing scan database locally...");
    try {
      const res = await fetch("/api/scans?full=true");
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      if (data.scans && Array.isArray(data.scans)) {
        await clearCachedReports();
        for (const scan of data.scans) {
          await setCachedScanDetail(scan.id, scan);
        }
        setScans(data.scans.map(sanitizeScan));
        toast.success(`Successfully cached ${data.scans.length} scans!`, { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to sync database scans.", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Client-Side Analysis Console
          </h1>
          <p className="text-muted-foreground text-sm">
            Query, group, aggregate, and perform set algebra on local scans. Powered by IndexedDB.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-white/10 px-3 py-1.5 rounded-md text-xs text-slate-300 select-none hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={useFriendlyNames}
              onChange={(e) => setUseFriendlyNames(e.target.checked)}
              className="rounded border-white/10 bg-zinc-950 text-blue-500 focus:ring-0 h-4 w-4"
            />
            <span>Friendly UI Labels</span>
          </label>
          <Badge variant="outline" className="px-3 py-1 bg-white/5 border-white/10 text-white gap-1">
            <Database className="h-3 w-3 text-blue-400" />
            {scans.length} Scans Cached
          </Badge>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync Local Cache
          </Button>
        </div>
      </div>

      {/* QueryProvider wraps everything that needs query state */}
      <QueryProvider
        scans={scans}
        savedQueries={savedQueries}
        refreshSavedQueries={loadSavedQueries}
        onResults={setResults}
      >
        <AnalysisConsoleInner
          scans={scans}
          savedQueries={savedQueries}
          loadSavedQueries={loadSavedQueries}
          useFriendlyNames={useFriendlyNames}
          results={results}
          setResults={setResults}
        />
      </QueryProvider>
    </div>
  );
}
