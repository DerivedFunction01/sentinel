"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { toast } from "sonner";
import {
  executeQuery,
  QueryDefinition,
  FilterCondition,
  Aggregation,
  SortInstruction,
} from "@/lib/dataframe/client-query-engine";
import { saveQuery, deleteSavedQuery, getSavedQueries } from "@/lib/indexed-db";
import { translateQueryToPython } from "@/lib/dataframe/python-compiler";
import { SCAN_FIELDS, TRIAL_FIELDS } from "./constants";

export type FieldDef = {
  name: string;
  label: string;
  type: string;
  desc: string;
};

/** Infer the selectable column names a saved view produces. */
function computeSelectableColumns(query: QueryDefinition, savedQueries: any[]): string[] {
  const table =
    query.table ||
    (query.sourceViewId
      ? savedQueries.find((q) => q.id === query.sourceViewId)?.query?.table
      : undefined) ||
    "scans";
  const schema = table === "trials" ? TRIAL_FIELDS : SCAN_FIELDS;

  if (query.sourceViewId) {
    const parent = savedQueries.find((q) => q.id === query.sourceViewId);
    if (parent) {
      if (parent.selectableColumns && parent.selectableColumns.length) {
        return parent.selectableColumns;
      }
      return computeSelectableColumns(parent.query, savedQueries);
    }
  }

  if (query.projections && query.projections.length > 0) {
    return query.projections.filter((p) => p);
  }
  if (query.group_by && query.group_by.length > 0) {
    const cols = [...query.group_by];
    if (query.aggregations) {
      query.aggregations.forEach((a) => {
        if (a.alias) cols.push(a.alias);
      });
    }
    return cols;
  }
  return schema.map((f) => f.name);
}

// ─── Context Shape ─────────────────────────────────────────────────────────────

export interface QueryContextValue {
  // Source
  sourceType: "scans" | "trials" | "view";
  setSourceType: (v: "scans" | "trials" | "view") => void;
  selectedViewId: string;
  setSelectedViewId: (v: string) => void;

  // Query clauses
  filters: FilterCondition[];
  setFilters: (v: FilterCondition[]) => void;
  projections: string[];
  setProjections: (v: string[]) => void;
  groupBy: string[];
  setGroupBy: (v: string[]) => void;
  aggregations: Aggregation[];
  setAggregations: (v: Aggregation[]) => void;
  sortInstructions: SortInstruction[];
  setSortInstructions: (v: SortInstruction[]) => void;
  limit: number | "";
  setLimit: (v: number | "") => void;

  // Set algebra
  setOp: "none" | "union" | "intersect" | "except";
  setSetOp: (v: "none" | "union" | "intersect" | "except") => void;
  subQuerySourceType: "scans" | "trials" | "view";
  setSubQuerySourceType: (v: "scans" | "trials" | "view") => void;
  subQueryViewId: string;
  setSubQueryViewId: (v: string) => void;
  subQueryFilters: FilterCondition[];
  setSubQueryFilters: (v: FilterCondition[]) => void;

  // Save-view name
  newQueryName: string;
  setNewQueryName: (v: string) => void;

  // Pivot config
  pivotConfig: PivotConfig;
  setPivotConfig: (v: PivotConfig) => void;
  includePivotConfig: boolean;
  setIncludePivotConfig: (v: boolean) => void;

  // Derived
  currentFields: FieldDef[];
  getUniqueFieldValues: (property: string) => string[];

  // Actions
  handleRunQuery: () => void;
  handleSaveQuery: () => Promise<void>;
  handleSavePivotView: (pivotConfig: PivotConfig) => Promise<void>;
  handleExportPython: () => void;

  // Shared data (from provider)
  savedQueries: any[];
  refreshSavedQueries: () => Promise<void>;
}

/** Pivot configuration shape stored alongside a saved query. */
export interface PivotConfig {
  rowKey: string;
  colKey: string;
  valueKey: string;
  aggType: "count" | "sum" | "avg";
  enableHeatmap: boolean;
}

const QueryContext = createContext<QueryContextValue | null>(null);

export function useQueryContext(): QueryContextValue {
  const ctx = useContext(QueryContext);
  if (!ctx) throw new Error("useQueryContext must be used inside QueryProvider");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

interface QueryProviderProps {
  children: ReactNode;
  scans: any[];
  savedQueries: any[];
  refreshSavedQueries: () => Promise<void>;
  onResults: (results: any[]) => void;
}

export function QueryProvider({
  children,
  scans,
  savedQueries,
  refreshSavedQueries,
  onResults,
}: QueryProviderProps) {
  // ── Source ────────────────────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<"scans" | "trials" | "view">(
    "scans",
  );
  const [selectedViewId, setSelectedViewId] = useState("");

  // ── Query clauses ─────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [projections, setProjections] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregations, setAggregations] = useState<Aggregation[]>([]);
  const [sortInstructions, setSortInstructions] = useState<SortInstruction[]>(
    [],
  );
  const [limit, setLimit] = useState<number | "">("");

  // ── Set algebra ───────────────────────────────────────────────────────────
  const [setOp, setSetOp] = useState<"none" | "union" | "intersect" | "except">(
    "none",
  );
  const [subQuerySourceType, setSubQuerySourceType] = useState<
    "scans" | "trials" | "view"
  >("scans");
  const [subQueryViewId, setSubQueryViewId] = useState("");
  const [subQueryFilters, setSubQueryFilters] = useState<FilterCondition[]>([]);

  // ── Save-view name ────────────────────────────────────────────────────────
  const [newQueryName, setNewQueryName] = useState("");

  // ── Pivot config ──────────────────────────────────────────────────────────
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>({
    rowKey: "targetModel",
    colKey: "riskLevel",
    valueKey: "*",
    aggType: "count",
    enableHeatmap: false,
  });
  const [includePivotConfig, setIncludePivotConfig] = useState(true);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentFields = useMemo<FieldDef[]>(() => {
    if (sourceType === "view") {
      const parent = savedQueries.find((q) => q.id === selectedViewId);
      const base =
        parent?.query?.table === "trials" ? TRIAL_FIELDS : SCAN_FIELDS;
      if (parent?.selectableColumns?.length) {
        return parent.selectableColumns.map((name) => {
          const match = base.find((f) => f.name === name);
          return match ?? { name, label: name, type: "string", desc: name };
        });
      }
      return base.filter((f: any) => !f.hidden);
    }
    return (sourceType === "scans" ? SCAN_FIELDS : TRIAL_FIELDS).filter((f: any) => !f.hidden);
  }, [sourceType, selectedViewId, savedQueries]);

  const getUniqueFieldValues = useCallback(
    (property: string): string[] => {
      if (!property || scans.length === 0) return [];
      const values = new Set<string>();
      const targetTable =
        sourceType === "view"
          ? savedQueries.find((q) => q.id === selectedViewId)?.query?.table ||
            "scans"
          : sourceType;

      if (targetTable === "scans") {
        for (const scan of scans) {
          const val = scan[property];
          if (val !== undefined && val !== null && val !== "") {
            if (Array.isArray(val)) val.forEach((v) => values.add(String(v)));
            else values.add(String(val));
          }
        }
      } else {
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
    },
    [scans, sourceType, selectedViewId, savedQueries],
  );

  // ── Build current QueryDefinition from state ──────────────────────────────
  const buildQuery = useCallback((): QueryDefinition => {
    const normalized = aggregations.map((a) => {
      if (a.alias) return a;
      const groupPrefix = groupBy.length ? groupBy.join("_") + "_" : "";
      const prop = a.property === "*" ? "count" : a.property;
      return { ...a, alias: `${groupPrefix}${prop}_${a.function}` };
    });
    const query: QueryDefinition = {
      filters: filters.filter((f) => f.property),
      projections: projections.filter((p) => p),
      group_by: groupBy.filter((g) => g),
      aggregations: normalized.filter((a) => a.property && a.alias),
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
      if (subQuerySourceType === "view") sub.sourceViewId = subQueryViewId;
      else sub.table = subQuerySourceType;
      if (setOp === "union") query.union = sub;
      if (setOp === "intersect") query.intersect = sub;
      if (setOp === "except") query.except = sub;
    }
    return query;
  }, [
    filters, projections, groupBy, aggregations, sortInstructions, limit,
    sourceType, selectedViewId, setOp, subQuerySourceType, subQueryViewId, subQueryFilters,
  ]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRunQuery = useCallback(() => {
    try {
      const query = buildQuery();
      const runResults = executeQuery(scans, query, savedQueries);
      onResults(runResults);
      toast.success(`Query executed. Returned ${runResults.length} records.`);
    } catch (e: any) {
      toast.error(`Query Execution Error: ${e.message}`);
    }
  }, [buildQuery, scans, savedQueries, onResults]);

  const handleSaveQuery = useCallback(async () => {
    if (!newQueryName.trim()) {
      toast.error("Please enter a name for the query");
      return;
    }
    try {
      const id = "view_" + Math.random().toString(36).substr(2, 9);
      const selectableColumns = computeSelectableColumns(buildQuery(), savedQueries);
      await saveQuery(
        id,
        newQueryName,
        buildQuery(),
        includePivotConfig ? pivotConfig : null,
        selectableColumns,
      );
      setNewQueryName("");
      toast.success("Query saved to local views store!");
      await refreshSavedQueries();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save query configuration");
    }
  }, [newQueryName, buildQuery, refreshSavedQueries]);

  const handleSavePivotView = useCallback(async (pivotConfig: PivotConfig) => {
    if (!newQueryName.trim()) {
      toast.error("Please enter a name for the pivot view");
      return;
    }
    try {
      const id = "view_" + Math.random().toString(36).substr(2, 9);
      const selectableColumns = computeSelectableColumns(buildQuery(), savedQueries);
      await saveQuery(id, newQueryName, buildQuery(), pivotConfig, selectableColumns);
      setNewQueryName("");
      toast.success("Pivot view saved!");
      await refreshSavedQueries();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save pivot view");
    }
  }, [newQueryName, buildQuery, refreshSavedQueries]);

  const handleExportPython = useCallback(() => {
    try {
      const script = translateQueryToPython(buildQuery(), savedQueries, pivotConfig);
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
  }, [buildQuery, savedQueries, sourceType]);

  // ── Context value ─────────────────────────────────────────────────────────
  const value: QueryContextValue = {
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
    pivotConfig, setPivotConfig,
    includePivotConfig, setIncludePivotConfig,
    currentFields,
    getUniqueFieldValues,
    handleRunQuery,
    handleSaveQuery,
    handleSavePivotView,
    handleExportPython,
    savedQueries,
    refreshSavedQueries,
  };

  return <QueryContext.Provider value={value}>{children}</QueryContext.Provider>;
}
