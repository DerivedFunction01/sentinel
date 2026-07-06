"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { RefreshCw, Database, BookOpen, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  executeQuery,
  executePivot,
  QueryDefinition,
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
import { PRESETS } from "./presets";
import { SCAN_FIELDS, TRIAL_FIELDS } from "./constants";
import { QueryComposer } from "./query-composer";
import {
  FlatCharts,
  FlatDataTable,
  PivotChart,
  PivotTable,
  PivotTableControls,
} from "./charts";
import { SavedViews, SchemaExplorer } from "./explorer";

export default function AnalysisConsolePage() {
  const [scans, setScans] = useState<any[]>([]);
  const [savedQueries, setSavedQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // Results view toggler
  const [resultsTab, setResultsTab] = useState<"flat" | "pivot">("flat");

  // Chart selectors
  const [chartTypeSelection, setChartTypeSelection] = useState<
    "auto" | "bar" | "line" | "pie"
  >("auto");
  const [enablePivotHeatmap, setEnablePivotHeatmap] = useState(false);
  const [useFriendlyNames, setUseFriendlyNames] = useState(true);

  // Query state
  const [sourceType, setSourceType] = useState<"scans" | "trials" | "view">(
    "scans",
  );
  const [selectedViewId, setSelectedViewId] = useState<string>("");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [projections, setProjections] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregations, setAggregations] = useState<Aggregation[]>([]);
  const [sortInstructions, setSortInstructions] = useState<SortInstruction[]>(
    [],
  );
  const [limit, setLimit] = useState<number | "">("");

  // Set operation state
  const [setOp, setSetOp] = useState<"none" | "union" | "intersect" | "except">(
    "none",
  );
  const [subQuerySourceType, setSubQuerySourceType] = useState<
    "scans" | "trials" | "view"
  >("scans");
  const [subQueryViewId, setSubQueryViewId] = useState<string>("");
  const [subQueryFilters, setSubQueryFilters] = useState<FilterCondition[]>([]);

  // Pivot table states
  const [pivotRowKey, setPivotRowKey] = useState<string>("targetModel");
  const [pivotColKey, setPivotColKey] = useState<string>("riskLevel");
  const [pivotValueKey, setPivotValueKey] = useState<string>("*");
  const [pivotAggType, setPivotAggType] = useState<"count" | "sum" | "avg">(
    "count",
  );

  // Save query state
  const [newQueryName, setNewQueryName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCachedScans();
    loadSavedQueries();
  }, []);

  const getUniqueFieldValues = (property: string) => {
    if (!property || scans.length === 0) return [];
    const values = new Set<string>();

    const targetTable =
      sourceType === "view"
        ? savedQueries.find((q) => q.id === selectedViewId)?.query?.table ||
          "scans"
        : sourceType;

    if (targetTable === "scans") {
      for (const scan of scans) {
        let val = scan[property];
        if (val !== undefined && val !== null && val !== "") {
          if (Array.isArray(val)) {
            val.forEach((v) => values.add(String(v)));
          } else {
            values.add(String(val));
          }
        }
      }
    } else {
      // trials
      for (const scan of scans) {
        const scanTrials = Array.isArray(scan.trials)
          ? scan.trials
          : typeof scan.trials === "string"
            ? JSON.parse(scan.trials)
            : [];
        for (const t of scanTrials) {
          let val = t[property];
          if (val === undefined) {
            if (property === "targetModel") val = scan.targetModel;
            if (property === "createdAt") val = scan.createdAt;
          }
          if (val !== undefined && val !== null && val !== "") {
            values.add(String(val));
          }
        }
      }
    }
    return Array.from(values).sort();
  };

  const loadCachedScans = async () => {
    setLoading(true);
    try {
      const cached = await getAllCachedScanDetails();
      setScans(cached || []);
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
        setScans(data.scans);
        toast.success(`Successfully cached ${data.scans.length} scans!`, {
          id: toastId,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to sync database scans.", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const currentFields = useMemo(() => {
    if (sourceType === "view") {
      const parent = savedQueries.find((q) => q.id === selectedViewId);
      if (parent && parent.query.table) {
        return parent.query.table === "scans" ? SCAN_FIELDS : TRIAL_FIELDS;
      }
      return SCAN_FIELDS;
    }
    return sourceType === "scans" ? SCAN_FIELDS : TRIAL_FIELDS;
  }, [sourceType, selectedViewId, savedQueries]);

  const handleRunQuery = () => {
    try {
      const query: QueryDefinition = {
        filters: filters.filter((f) => f.property),
        projections: projections.filter((p) => p),
        group_by: groupBy.filter((g) => g),
        aggregations: aggregations.filter((a) => a.property && a.alias),
        sort: sortInstructions.filter((s) => s.property),
        limit: limit ? Number(limit) : undefined,
      };

      if (sourceType === "view") {
        query.sourceViewId = selectedViewId;
      } else {
        query.table = sourceType;
      }

      if (setOp !== "none") {
        const sub: QueryDefinition = {
          filters: subQueryFilters.filter((f) => f.property),
        };
        if (subQuerySourceType === "view") {
          sub.sourceViewId = subQueryViewId;
        } else {
          sub.table = subQuerySourceType;
        }

        if (setOp === "union") query.union = sub;
        if (setOp === "intersect") query.intersect = sub;
        if (setOp === "except") query.except = sub;
      }

      const runResults = executeQuery(scans, query, savedQueries);
      setResults(runResults);
      toast.success(`Query executed. Returned ${runResults.length} records.`);
    } catch (e: any) {
      toast.error(`Query Execution Error: ${e.message}`);
    }
  };

  const handleExportPython = () => {
    try {
      const query: QueryDefinition = {
        filters: filters.filter((f) => f.property),
        projections: projections.filter((p) => p),
        group_by: groupBy.filter((g) => g),
        aggregations: aggregations.filter((a) => a.property && a.alias),
        sort: sortInstructions.filter((s) => s.property),
        limit: limit ? Number(limit) : undefined,
      };
      if (sourceType === "view") {
        query.sourceViewId = selectedViewId;
      } else {
        query.table = sourceType;
      }

      if (setOp !== "none") {
        const sub: QueryDefinition = {
          filters: subQueryFilters.filter((f) => f.property),
        };
        if (subQuerySourceType === "view") {
          sub.sourceViewId = subQueryViewId;
        } else {
          sub.table = subQuerySourceType;
        }
        if (setOp === "union") query.union = sub;
        if (setOp === "intersect") query.intersect = sub;
        if (setOp === "except") query.except = sub;
      }

      const script = translateQueryToPython(query, savedQueries);
      const blob = new Blob([script], { type: "text/x-python" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("href", url);
      a.setAttribute("download", `pandas_pipeline_${sourceType}.py`);
      a.click();
      toast.success("Exported executable Python Pandas script!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate Python Pandas code.");
    }
  };

  // Compute Pivot results
  const pivotResults = useMemo(() => {
    if (results.length === 0 || !pivotRowKey || !pivotColKey) return null;
    try {
      return executePivot(results, {
        rowKey: pivotRowKey,
        colKey: pivotColKey,
        valueKey: pivotValueKey,
        aggType: pivotAggType,
      });
    } catch (e: any) {
      console.error("Pivot execution failed:", e);
      return null;
    }
  }, [results, pivotRowKey, pivotColKey, pivotValueKey, pivotAggType]);

  const handleSaveQuery = async () => {
    if (!newQueryName.trim()) {
      toast.error("Please enter a name for the query");
      return;
    }
    try {
      const id = "view_" + Math.random().toString(36).substr(2, 9);
      const query: QueryDefinition = {
        filters: filters.filter((f) => f.property),
        projections: projections.filter((p) => p),
        group_by: groupBy.filter((g) => g),
        aggregations: aggregations.filter((a) => a.property && a.alias),
        sort: sortInstructions.filter((s) => s.property),
        limit: limit ? Number(limit) : undefined,
      };

      if (sourceType === "view") {
        query.sourceViewId = selectedViewId;
      } else {
        query.table = sourceType;
      }

      if (setOp !== "none") {
        const sub: QueryDefinition = {
          filters: subQueryFilters.filter((f) => f.property),
        };
        if (subQuerySourceType === "view") {
          sub.sourceViewId = subQueryViewId;
        } else {
          sub.table = subQuerySourceType;
        }
        if (setOp === "union") query.union = sub;
        if (setOp === "intersect") query.intersect = sub;
        if (setOp === "except") query.except = sub;
      }

      await saveQuery(id, newQueryName, query);
      setNewQueryName("");
      toast.success("Query saved to local views store!");
      loadSavedQueries();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save query configuration");
    }
  };

  const handleDeleteQuery = async (id: string) => {
    try {
      await deleteSavedQuery(id);
      toast.success("Query view deleted.");
      loadSavedQueries();
      if (selectedViewId === id) setSelectedViewId("");
      if (subQueryViewId === id) setSelectedViewId("");
    } catch (e) {
      console.error(e);
    }
  };

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
      setSubQuerySourceType(
        q.union.sourceViewId ? "view" : q.union.table || "scans",
      );
      setSubQueryViewId(q.union.sourceViewId || "");
      setSubQueryFilters(q.union.filters || []);
    } else if (q.intersect) {
      setSetOp("intersect");
      setSubQuerySourceType(
        q.intersect.sourceViewId ? "view" : q.intersect.table || "scans",
      );
      setSubQueryViewId(q.intersect.sourceViewId || "");
      setSubQueryFilters(q.intersect.filters || []);
    } else if (q.except) {
      setSetOp("except");
      setSubQuerySourceType(
        q.except.sourceViewId ? "view" : q.except.table || "scans",
      );
      setSubQueryViewId(q.except.sourceViewId || "");
      setSubQueryFilters(q.except.filters || []);
    } else {
      setSetOp("none");
      setSubQueryFilters([]);
    }
    toast.info(`Loaded view: ${saved.name}`);
  };

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
            await saveQuery(parsed.id, parsed.name, parsed.query);
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

  const chartData = useMemo(() => {
    if (results.length === 0) return null;
    const firstRow = results[0];
    const numericKeys = Object.keys(firstRow).filter(
      (key) =>
        typeof firstRow[key] === "number" && key !== "id" && key !== "number",
    );
    const xAxisKey =
      Object.keys(firstRow).find(
        (key) =>
          typeof firstRow[key] === "string" ||
          key === "createdAt" ||
          key.startsWith("createdAt_"),
      ) || "targetModel";

    if (numericKeys.length === 0) return null;

    // Detect if temporal (LineChart suited)
    const isTemporal =
      xAxisKey === "createdAt" || xAxisKey.startsWith("createdAt_");

    // Standard mapped data
    const formattedData = results.map((row) => {
      const item = { ...row };
      if (item.createdAt && typeof item.createdAt === "string") {
        item.createdAt = item.createdAt.split("T")[0];
      }
      return item;
    });

    // Smart Pie Chart Aggregations
    let isPieRecommended = false;
    let pieData = formattedData;

    if (numericKeys.length === 1) {
      const metricKey = numericKeys[0];
      const sorted = [...formattedData].sort(
        (a, b) => (Number(b[metricKey]) || 0) - (Number(a[metricKey]) || 0),
      );
      const totalSum = sorted.reduce(
        (sum, row) => sum + (Number(row[metricKey]) || 0),
        0,
      );

      if (sorted.length <= 5) {
        isPieRecommended = true;
        pieData = sorted;
      } else if (totalSum > 0) {
        // Find minor slices contributing < 5% of total sum
        const minorThreshold = totalSum * 0.05;
        const minorStartIndex = sorted.findIndex(
          (row) => (Number(row[metricKey]) || 0) < minorThreshold,
        );

        // Group only if outliers exist and we keep at least the top 3 items intact
        if (minorStartIndex !== -1 && minorStartIndex >= 3) {
          const majorItems = sorted.slice(0, minorStartIndex);
          const minorItems = sorted.slice(minorStartIndex);
          const minorSum = minorItems.reduce(
            (sum, row) => sum + (Number(row[metricKey]) || 0),
            0,
          );

          if (minorSum > 0) {
            pieData = [
              ...majorItems,
              {
                [xAxisKey]: "Other",
                [metricKey]: Number(minorSum.toFixed(2)),
              },
            ];
          } else {
            pieData = majorItems;
          }
        } else {
          // Keep all (evenly split / low variance)
          pieData = sorted;
        }
        isPieRecommended = true;
      }
    }

    return {
      data: formattedData,
      pieData,
      xAxisKey,
      keys: numericKeys,
      isTemporal,
      isPieRecommended,
    };
  }, [results]);

  const resolvedChartType = useMemo(() => {
    if (chartTypeSelection !== "auto") return chartTypeSelection;
    if (chartData?.isTemporal) return "line";
    if (chartData?.isPieRecommended) return "pie";
    return "bar";
  }, [chartTypeSelection, chartData]);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Client-Side Analysis Console
          </h1>
          <p className="text-muted-foreground text-sm">
            Query, group, aggregate, and perform set algebra on local scans.
            Powered by IndexedDB.
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
          <Badge
            variant="outline"
            className="px-3 py-1 bg-white/5 border-white/10 text-white gap-1"
          >
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Views and Schema Explorer */}
        <div className="lg:col-span-1 space-y-6">
          {/* Saved Queries Section */}
          {SavedViews(
            handleExportQueries,
            fileInputRef,
            handleImportQueries,
            savedQueries,
            loadSavedQueryDef,
            handleDeleteQuery,
          )}

          {/* Schema Explorer */}
          {SchemaExplorer(useFriendlyNames)}
        </div>

        {/* Query Builder Console */}
        <div className="lg:col-span-3 space-y-6">
          {/* Preset Buttons */}
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

          {QueryComposer(
            newQueryName,
            setNewQueryName,
            handleSaveQuery,
            handleExportPython,
            setSourceType,
            sourceType,
            selectedViewId,
            setSelectedViewId,
            savedQueries,
            currentFields,
            projections,
            setProjections,
            useFriendlyNames,
            setFilters,
            filters,
            getUniqueFieldValues,
            setGroupBy,
            groupBy,
            setAggregations,
            aggregations,
            setSetOp,
            setOp,
            setSubQuerySourceType,
            subQuerySourceType,
            subQueryViewId,
            setSubQueryViewId,
            setSubQueryFilters,
            subQueryFilters,
            setSortInstructions,
            sortInstructions,
            limit,
            setLimit,
            handleRunQuery,
          )}

          {/* Results Output */}
          {results.length > 0 && (
            <div className="space-y-6">
              {/* Tab selector for results */}
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
                  {/* Flat Charts */}
                  {chartData &&
                    FlatCharts(
                      setChartTypeSelection,
                      chartTypeSelection,
                      resolvedChartType,
                      chartData,
                    )}

                  {/* Flat Data Table */}
                  {FlatDataTable(results, currentFields, useFriendlyNames)}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Pivot Config Bar */}
                  {PivotTableControls(
                    pivotRowKey,
                    setPivotRowKey,
                    currentFields,
                    useFriendlyNames,
                    pivotColKey,
                    setPivotColKey,
                    pivotValueKey,
                    setPivotValueKey,
                    pivotAggType,
                    setPivotAggType,
                    enablePivotHeatmap,
                    setEnablePivotHeatmap,
                  )}

                  {/* Pivot Recharts Stacked Chart */}
                  {pivotResults &&
                    pivotResults.pivotedData.length > 0 &&
                    PivotChart(pivotRowKey, pivotColKey, pivotResults)}

                  {/* Pivot Grid Table */}
                  {pivotResults &&
                    PivotTable(
                      pivotResults,
                      enablePivotHeatmap,
                      pivotValueKey,
                      currentFields,
                      pivotRowKey,
                      useFriendlyNames,
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
