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
  GitBranch
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  executeQuery, 
  executePivot,
  QueryDefinition, 
  PivotDefinition,
  FilterCondition, 
  Aggregation, 
  SortInstruction 
} from "@/lib/client-query-engine";
import { 
  getAllCachedScanDetails, 
  setCachedScanDetail, 
  clearCachedReports,
  getSavedQueries,
  saveQuery,
  deleteSavedQuery
} from "@/lib/indexed-db";
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
  Cell
} from "recharts";

const SCAN_FIELDS = [
  { name: "id", type: "string", desc: "Internal scan cuid" },
  { name: "reportId", type: "string", desc: "Human-readable report ID" },
  { name: "targetModel", type: "string", desc: "Tested target model name" },
  { name: "attackerModel", type: "string", desc: "Attacker model used" },
  { name: "forbiddenTask", type: "string", desc: "System restriction description" },
  { name: "totalTrials", type: "number", desc: "Total runs conducted" },
  { name: "breaches", type: "number", desc: "Count of successful breaches" },
  { name: "defendedCount", type: "number", desc: "Count of defended trials" },
  { name: "unknownCount", type: "number", desc: "Count of trials with unknown verdicts" },
  { name: "breachRate", type: "number", desc: "Percentage breach rate (0-100)" },
  { name: "score", type: "number", desc: "Safety score (100 - breachRate)" },
  { name: "riskLevel", type: "string", desc: "LOW, MEDIUM, HIGH, or CRITICAL" },
  { name: "status", type: "string", desc: "COMPLETED, FAILED, RUNNING" },
  { name: "apiCost", type: "number", desc: "API cost in USD" },
  { name: "createdAt", type: "date", desc: "Timestamp of creation" },
  { name: "createdAt_year", type: "number", desc: "Year of creation (e.g., 2026)" },
  { name: "createdAt_month", type: "number", desc: "Month of creation (1-12)" },
  { name: "createdAt_day", type: "number", desc: "Day of creation (1-31)" },
  { name: "tags", type: "string[]", desc: "List of applied tags" },
];

const TRIAL_FIELDS = [
  { name: "number", type: "number", desc: "Trial run index" },
  { name: "verdict", type: "string", desc: "BREACHED, DEFENDED, or UNKNOWN" },
  { name: "attack", type: "string", desc: "Adversarial payload prompt text" },
  { name: "response", type: "string", desc: "Tested LLM response" },
  { name: "judgeVerdict", type: "string", desc: "Reasoning from the judge" },
  { name: "taskTag", type: "string", desc: "Category identifier slug" },
  { name: "entropyLabel", type: "string", desc: "Attack complexity grouping" },
  { name: "framingLabel", type: "string", desc: "Framing mechanism classification" },
  { name: "patternId", type: "string", desc: "Attack pattern identifier" },
  { name: "targetThing", type: "string", desc: "Variant subject name" },
  { name: "targetModel", type: "string", desc: "Tested model (Joined)" },
  { name: "createdAt", type: "date", desc: "Scan date (Joined)" },
  { name: "createdAt_year", type: "number", desc: "Year of creation (e.g., 2026)" },
  { name: "createdAt_month", type: "number", desc: "Month of creation (1-12)" },
  { name: "createdAt_day", type: "number", desc: "Day of creation (1-31)" },
];

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: "eq", label: "=" },
    { value: "neq", label: "!=" },
    { value: "like", label: "LIKE" },
    { value: "not_like", label: "NOT LIKE" },
    { value: "in_set", label: "IN SET" },
    { value: "not_in_set", label: "NOT IN SET" },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "neq", label: "!=" },
    { value: "gt", label: ">" },
    { value: "geq", label: ">=" },
    { value: "lt", label: "<" },
    { value: "leq", label: "<=" },
    { value: "between", label: "BETWEEN" },
    { value: "not_between", label: "NOT BETWEEN" },
  ],
  "string[]": [
    { value: "in_set", label: "CONTAINS ANY" },
    { value: "not_in_set", label: "CONTAINS NONE" },
  ],
  date: [
    { value: "eq", label: "=" },
    { value: "neq", label: "!=" },
    { value: "gt", label: ">" },
    { value: "geq", label: ">=" },
    { value: "lt", label: "<" },
    { value: "leq", label: "<=" },
    { value: "between", label: "BETWEEN" },
  ]
};

const PRESETS = [
  {
    name: "Model Performance Summary",
    desc: "Calculate average breach rate, cost, and totals grouped by tested model.",
    query: {
      table: "scans",
      group_by: ["targetModel"],
      aggregations: [
        { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
        { function: "sum", property: "totalTrials", alias: "total_trials" },
        { function: "sum", property: "breaches", alias: "total_breaches" },
        { function: "sum", property: "defendedCount", alias: "total_defenses" },
        { function: "sum", property: "apiCost", alias: "total_cost" },
      ],
      sort: [{ property: "avg_breach_rate", direction: "desc" }]
    } as QueryDefinition,
  },
  {
    name: "Vulnerable Attack Patterns",
    desc: "Examine execution runs grouped by attack pattern.",
    query: {
      table: "trials",
      filters: [],
      group_by: ["patternId"],
      aggregations: [
        { function: "count", property: "number", alias: "total_runs" },
      ],
      sort: [{ property: "total_runs", direction: "desc" }]
    } as QueryDefinition,
  },
  {
    name: "Weak Points (High Risk Task Tags)",
    desc: "Analyze breach count distributions across different task categories.",
    query: {
      table: "trials",
      filters: [{ property: "verdict", operator: "eq", value: "BREACHED" }],
      group_by: ["taskTag"],
      aggregations: [
        { function: "count", property: "number", alias: "breach_count" }
      ],
      sort: [{ property: "breach_count", direction: "desc" }]
    } as QueryDefinition,
  },
  {
    name: "Daily Spend & Safety Trends",
    desc: "Daily rolling average safety score and API costs.",
    query: {
      table: "scans",
      group_by: ["createdAt"],
      aggregations: [
        { function: "avg", property: "score", alias: "avg_safety_score" },
        { function: "sum", property: "apiCost", alias: "total_spend" }
      ],
      sort: [{ property: "createdAt", direction: "asc" }]
    } as QueryDefinition,
  },
  {
    name: "High Cost Scans (> $5.00)",
    desc: "Locate scans consuming significant API credits.",
    query: {
      table: "scans",
      filters: [{ property: "apiCost", operator: "gt", value: "5.0" }],
      sort: [{ property: "apiCost", direction: "desc" }]
    } as QueryDefinition,
  },
  {
    name: "Attacker Model Breakdown",
    desc: "Determine which attacker models achieve the highest breach rate.",
    query: {
      table: "scans",
      group_by: ["attackerModel"],
      aggregations: [
        { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
        { function: "sum", property: "breaches", alias: "total_breaches" }
      ],
      sort: [{ property: "avg_breach_rate", direction: "desc" }]
    } as QueryDefinition,
  },
  {
    name: "Critical Risk Scans",
    desc: "Retrieve scans classified as CRITICAL safety risk.",
    query: {
      table: "scans",
      filters: [{ property: "riskLevel", operator: "eq", value: "CRITICAL" }],
      sort: [{ property: "score", direction: "asc" }]
    } as QueryDefinition,
  }
];

interface FilterRowProps {
  f: FilterCondition;
  idx: number;
  currentFilters: FilterCondition[];
  setCurrentFilters: (filters: FilterCondition[]) => void;
  currentFields: any[];
  getUniqueFieldValues: (property: string) => string[];
}

function FilterRow({ f, idx, currentFilters, setCurrentFilters, currentFields, getUniqueFieldValues }: FilterRowProps) {
  const field = currentFields.find(cf => cf.name === f.property);
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
    const items = String(f.value || "").split(",").filter(s => s.trim());
    const newItems = [...items, tempInput.trim()];
    const newFilters = [...currentFilters];
    newFilters[idx].value = newItems.join(",");
    setCurrentFilters(newFilters);
    setTempInput("");
  };

  const handleRemoveItem = (itemIdx: number) => {
    const items = String(f.value || "").split(",").filter(s => s.trim());
    const newItems = items.filter((_, i) => i !== itemIdx);
    const newFilters = [...currentFilters];
    newFilters[idx].value = newItems.join(",");
    setCurrentFilters(newFilters);
  };

  const inputType = type === "date" ? "date" : type === "number" ? "number" : "text";

  return (
    <div className="flex gap-2 items-start md:items-center flex-wrap md:flex-nowrap bg-white/[0.01] border border-white/5 p-2 rounded-lg">
      <select
        value={f.property}
        onChange={(e) => {
          const newFilters = [...currentFilters];
          newFilters[idx].property = e.target.value;
          const targetField = currentFields.find(cf => cf.name === e.target.value);
          if (targetField) {
            const validOps = OPERATORS_BY_TYPE[targetField.type] || OPERATORS_BY_TYPE.string;
            newFilters[idx].operator = validOps[0].value as any;
            newFilters[idx].value = "";
          }
          setCurrentFilters(newFilters);
        }}
        className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white shrink-0"
      >
        <option value="">-- select property --</option>
        {currentFields.map(field => (
          <option key={field.name} value={field.name}>{field.name}</option>
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
          const targetField = currentFields.find(cf => cf.name === f.property);
          const ops = targetField ? (OPERATORS_BY_TYPE[targetField.type] || OPERATORS_BY_TYPE.string) : OPERATORS_BY_TYPE.string;
          return ops.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
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
            {String(f.value || "").split(",").filter(s => s.trim()).map((item, itemIdx) => (
              <Badge key={itemIdx} variant="secondary" className="text-[10px] bg-white/10 text-white gap-1 py-0.5">
                {item}
                <button type="button" onClick={() => handleRemoveItem(itemIdx)} className="text-red-400 hover:text-red-300 font-bold">×</button>
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
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs text-white flex-1"
            />
            {suggestions.length > 0 && (
              <datalist id={`set-suggestions-${idx}-${f.property}`}>
                {suggestions.map(val => (
                  <option key={val} value={val} />
                ))}
              </datalist>
            )}
            <Button size="icon" variant="outline" type="button" onClick={handleAddItem} className="h-7 w-7 border-white/10">+</Button>
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
              {suggestions.map(val => (
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
        onClick={() => setCurrentFilters(currentFilters.filter((_, i) => i !== idx))}
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function AnalysisConsolePage() {
  const [scans, setScans] = useState<any[]>([]);
  const [savedQueries, setSavedQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  
  // Results view toggler
  const [resultsTab, setResultsTab] = useState<"flat" | "pivot">("flat");

  // Chart selectors
  const [chartTypeSelection, setChartTypeSelection] = useState<"auto" | "bar" | "line" | "pie">("auto");
  const [enablePivotHeatmap, setEnablePivotHeatmap] = useState(false);

  // Query state
  const [sourceType, setSourceType] = useState<"scans" | "trials" | "view">("scans");
  const [selectedViewId, setSelectedViewId] = useState<string>("");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [projections, setProjections] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregations, setAggregations] = useState<Aggregation[]>([]);
  const [sortInstructions, setSortInstructions] = useState<SortInstruction[]>([]);
  const [limit, setLimit] = useState<number | "">("");

  // Set operation state
  const [setOp, setSetOp] = useState<"none" | "union" | "intersect" | "except">("none");
  const [subQuerySourceType, setSubQuerySourceType] = useState<"scans" | "trials" | "view">("scans");
  const [subQueryViewId, setSubQueryViewId] = useState<string>("");
  const [subQueryFilters, setSubQueryFilters] = useState<FilterCondition[]>([]);

  // Pivot table states
  const [pivotRowKey, setPivotRowKey] = useState<string>("targetModel");
  const [pivotColKey, setPivotColKey] = useState<string>("riskLevel");
  const [pivotValueKey, setPivotValueKey] = useState<string>("*");
  const [pivotAggType, setPivotAggType] = useState<"count" | "sum" | "avg">("count");

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

    const targetTable = sourceType === "view"
      ? (savedQueries.find(q => q.id === selectedViewId)?.query?.table || "scans")
      : sourceType;

    if (targetTable === "scans") {
      for (const scan of scans) {
        let val = scan[property];
        if (val !== undefined && val !== null && val !== "") {
          if (Array.isArray(val)) {
            val.forEach(v => values.add(String(v)));
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
        toast.success(`Successfully cached ${data.scans.length} scans!`, { id: toastId });
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
      const parent = savedQueries.find(q => q.id === selectedViewId);
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
        filters: filters.filter(f => f.property),
        projections: projections.filter(p => p),
        group_by: groupBy.filter(g => g),
        aggregations: aggregations.filter(a => a.property && a.alias),
        sort: sortInstructions.filter(s => s.property),
        limit: limit ? Number(limit) : undefined
      };

      if (sourceType === "view") {
        query.sourceViewId = selectedViewId;
      } else {
        query.table = sourceType;
      }

      if (setOp !== "none") {
        const sub: QueryDefinition = {
          filters: subQueryFilters.filter(f => f.property)
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

  // Compute Pivot results
  const pivotResults = useMemo(() => {
    if (results.length === 0 || !pivotRowKey || !pivotColKey) return null;
    try {
      return executePivot(results, {
        rowKey: pivotRowKey,
        colKey: pivotColKey,
        valueKey: pivotValueKey,
        aggType: pivotAggType
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
        filters: filters.filter(f => f.property),
        projections: projections.filter(p => p),
        group_by: groupBy.filter(g => g),
        aggregations: aggregations.filter(a => a.property && a.alias),
        sort: sortInstructions.filter(s => s.property),
        limit: limit ? Number(limit) : undefined
      };

      if (sourceType === "view") {
        query.sourceViewId = selectedViewId;
      } else {
        query.table = sourceType;
      }

      if (setOp !== "none") {
        const sub: QueryDefinition = {
          filters: subQueryFilters.filter(f => f.property)
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

  const loadPreset = (preset: typeof PRESETS[0]) => {
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
      setSubQuerySourceType(q.union.sourceViewId ? "view" : (q.union.table || "scans"));
      setSubQueryViewId(q.union.sourceViewId || "");
      setSubQueryFilters(q.union.filters || []);
    } else if (q.intersect) {
      setSetOp("intersect");
      setSubQuerySourceType(q.intersect.sourceViewId ? "view" : (q.intersect.table || "scans"));
      setSubQueryViewId(q.intersect.sourceViewId || "");
      setSubQueryFilters(q.intersect.filters || []);
    } else if (q.except) {
      setSetOp("except");
      setSubQuerySourceType(q.except.sourceViewId ? "view" : (q.except.table || "scans"));
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
    const lines = savedQueries.map(q => JSON.stringify(q)).join("\n");
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
        const lines = text.split("\n").filter(l => l.trim());
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
      key => typeof firstRow[key] === "number" && key !== "id" && key !== "number"
    );
    const xAxisKey = Object.keys(firstRow).find(
      key => typeof firstRow[key] === "string" || key === "createdAt" || key.startsWith("createdAt_")
    ) || "targetModel";

    if (numericKeys.length === 0) return null;

    // Detect if temporal (LineChart suited)
    const isTemporal = xAxisKey === "createdAt" || xAxisKey.startsWith("createdAt_");

    // Standard mapped data
    const formattedData = results.map(row => {
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
      const sorted = [...formattedData].sort((a, b) => (Number(b[metricKey]) || 0) - (Number(a[metricKey]) || 0));
      const totalSum = sorted.reduce((sum, row) => sum + (Number(row[metricKey]) || 0), 0);

      if (sorted.length <= 5) {
        isPieRecommended = true;
        pieData = sorted;
      } else if (totalSum > 0) {
        // Find minor slices contributing < 5% of total sum
        const minorThreshold = totalSum * 0.05;
        const minorStartIndex = sorted.findIndex(row => (Number(row[metricKey]) || 0) < minorThreshold);

        // Group only if outliers exist and we keep at least the top 3 items intact
        if (minorStartIndex !== -1 && minorStartIndex >= 3) {
          const majorItems = sorted.slice(0, minorStartIndex);
          const minorItems = sorted.slice(minorStartIndex);
          const minorSum = minorItems.reduce((sum, row) => sum + (Number(row[metricKey]) || 0), 0);

          if (minorSum > 0) {
            pieData = [
              ...majorItems,
              {
                [xAxisKey]: "Other",
                [metricKey]: Number(minorSum.toFixed(2))
              }
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
      isPieRecommended
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
            Query, group, aggregate, and perform set algebra on local scans. Powered by IndexedDB.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-white/5 border-white/10 text-white gap-1">
            <Database className="h-3 w-3 text-blue-400" />
            {scans.length} Scans Cached
          </Badge>
          <Button 
            onClick={handleSync} 
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Local Cache
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Views and Schema Explorer */}
        <div className="lg:col-span-1 space-y-6">
          {/* Saved Queries Section */}
          <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FolderHeart className="h-4 w-4 text-pink-400" />
                  Saved Views
                </span>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleExportQueries} title="Export Configurations">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => fileInputRef.current?.click()} title="Import Configurations">
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".jsonl" onChange={handleImportQueries} />
                </div>
              </CardTitle>
              <CardDescription className="text-xs">
                Custom views saved in local IndexedDB store.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar">
              {savedQueries.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">No custom views saved yet.</p>
              ) : (
                savedQueries.map(q => (
                  <div key={q.id} className="flex items-center justify-between group rounded p-1.5 hover:bg-white/5 transition-colors">
                    <button onClick={() => loadSavedQueryDef(q)} className="text-xs font-semibold text-slate-200 truncate flex-1 text-left flex items-center gap-1 hover:text-white">
                      <ChevronRight className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                      {q.name}
                    </button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteQuery(q.id)} className="h-6 w-6 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Schema Explorer */}
          <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FileCode className="h-4 w-4 text-blue-400" />
                Schema Dictionary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
              <div>
                <h3 className="text-xs font-bold text-emerald-400 uppercase mb-2">scans Table</h3>
                <div className="space-y-2">
                  {SCAN_FIELDS.map(f => (
                    <div key={f.name} className="text-xs">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-slate-200 font-semibold">{f.name}</span>
                        <span className="text-slate-400 italic">({f.type})</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/5 pt-4">
                <h3 className="text-xs font-bold text-purple-400 uppercase mb-2">trials Table</h3>
                <div className="space-y-2">
                  {TRIAL_FIELDS.map(f => (
                    <div key={f.name} className="text-xs">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-slate-200 font-semibold">{f.name}</span>
                        <span className="text-slate-400 italic">({f.type})</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <Button size="sm" onClick={handleSaveQuery} className="bg-pink-600 hover:bg-pink-500 text-white text-xs gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    Save View
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Table selection */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-slate-300">FROM DATASET:</span>
                <div className="flex bg-muted p-1 rounded-md">
                  {["scans", "trials", "view"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSourceType(t as any)}
                      className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                        sourceType === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
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
                    {savedQueries.map(q => (
                      <option key={q.id} value={q.id}>{q.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Columns selection (SELECT) */}
              <div className="space-y-2 border-t border-white/5 pt-4">
                <span className="text-xs font-medium text-slate-300 uppercase tracking-wider block">Columns (SELECT)</span>
                <p className="text-[10px] text-muted-foreground italic">Leave all unchecked to SELECT * (all fields).</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {currentFields.map((f) => {
                    const isChecked = projections.includes(f.name);
                    return (
                      <label key={f.name} className="flex items-center gap-1.5 p-1.5 rounded border border-white/5 hover:bg-white/5 cursor-pointer transition-colors text-xs text-slate-300 select-none">
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
                        <span className="truncate">{f.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Filters (WHERE)</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFilters([...filters, { property: "", operator: "eq", value: "" }])}
                    className="border-white/10 text-xs px-2.5 h-7"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Filter
                  </Button>
                </div>
                <div className="space-y-2">
                  {filters.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No filters active. Selecting all records.</p>
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
                    />
                  ))}
                </div>
              </div>

              {/* Aggregations & Group By */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Group By</span>
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
                          {currentFields.map(field => (
                            <option key={field.name} value={field.name}>{field.name}</option>
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Aggregations</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAggregations([...aggregations, { function: "count", property: "*", alias: "" }])}
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
                          {currentFields.map(field => (
                            <option key={field.name} value={field.name}>{field.name}</option>
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
                          onClick={() => setAggregations(aggregations.filter((_, i) => i !== idx))}
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
                  <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Set Algebra:</span>
                  <div className="flex bg-muted p-1 rounded-md">
                    {["none", "union", "intersect", "except"].map((op) => (
                      <button
                        key={op}
                        onClick={() => setSetOp(op as any)}
                        className={`px-3 py-1 text-xs rounded-md font-medium uppercase transition-colors ${
                          setOp === op ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
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
                      <span className="text-xs font-medium text-slate-300">SUBQUERY SOURCE:</span>
                      <div className="flex bg-muted p-0.5 rounded">
                        {["scans", "trials", "view"].map((t) => (
                          <button
                            key={t}
                            onClick={() => setSubQuerySourceType(t as any)}
                            className={`px-2.5 py-0.5 text-[10px] rounded font-medium capitalize transition-colors ${
                              subQuerySourceType === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
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
                          {savedQueries.map(q => (
                            <option key={q.id} value={q.id}>{q.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 uppercase">Subquery Filters (WHERE)</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSubQueryFilters([...subQueryFilters, { property: "", operator: "eq", value: "" }])}
                        className="border-white/10 text-xs px-2 h-6"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Sub-Filter
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {subQueryFilters.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No subquery filters added yet.</p>
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
                        />
                      ))}
                    </div>

                    {/* Shape Mismatch Warning */}
                    {sourceType !== subQuerySourceType && (
                      <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs rounded">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>Warning: Operations between different datasets ({sourceType} × {subQuerySourceType}) might produce misaligned schema shapes.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sorting and Limit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Order By</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSortInstructions([...sortInstructions, { property: "", direction: "asc" }])}
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
                          {currentFields.map(field => (
                            <option key={field.name} value={field.name}>{field.name}</option>
                          ))}
                          {aggregations.map(agg => (
                            <option key={agg.alias} value={agg.alias}>{agg.alias} (aggregated)</option>
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
                          onClick={() => setSortInstructions(sortInstructions.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-medium text-slate-300 uppercase tracking-wider block">Limit</span>
                  <input
                    type="number"
                    value={limit}
                    placeholder="None (Return all records)"
                    onChange={(e) => setLimit(e.target.value ? Number(e.target.value) : "")}
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
                  {chartData && (
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
                                chartTypeSelection === type ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
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
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey={chartData.xAxisKey} stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <Tooltip 
                                  contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px" }} 
                                  labelClassName="text-slate-400 font-bold text-xs"
                                />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                {chartData.keys.map((key, i) => (
                                  <Line 
                                    key={key} 
                                    type="monotone"
                                    dataKey={key} 
                                    stroke={i % 2 === 0 ? "#3b82f6" : "#e11d48"} 
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                  />
                                ))}
                              </LineChart>
                            ) : resolvedChartType === "pie" ? (
                              <PieChart>
                                <Tooltip 
                                  contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px" }} 
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
                                    const colors = ["#3b82f6", "#e11d48", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
                                    return <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />;
                                  })}
                                </Pie>
                              </PieChart>
                            ) : (
                              <BarChart data={chartData.data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey={chartData.xAxisKey} stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <Tooltip 
                                  contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px" }} 
                                  labelClassName="text-slate-400 font-bold text-xs"
                                />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                {chartData.keys.map((key, i) => (
                                  <Bar 
                                    key={key} 
                                    dataKey={key} 
                                    fill={i % 2 === 0 ? "#3b82f6" : "#e11d48"} 
                                    radius={[4, 4, 0, 0]} 
                                  />
                                ))}
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Flat Data Table */}
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
                            csvRows.push(headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","));
                          }
                          const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
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
                            {Object.keys(results[0]).map((key) => (
                              <th key={key} className="px-4 py-2.5">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                          {results.slice(0, 100).map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-white/[0.02]">
                              {Object.keys(row).map((key, cIdx) => (
                                <td key={cIdx} className="px-4 py-2 max-w-[250px] truncate">
                                  {typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key])}
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
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Pivot Config Bar */}
                  <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Rows Dimension</label>
                        <select
                          value={pivotRowKey}
                          onChange={(e) => setPivotRowKey(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full"
                        >
                          {currentFields.map(f => (
                            <option key={f.name} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Columns Dimension</label>
                        <select
                          value={pivotColKey}
                          onChange={(e) => setPivotColKey(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full"
                        >
                          {currentFields.map(f => (
                            <option key={f.name} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Aggregated Value</label>
                        <select
                          value={pivotValueKey}
                          onChange={(e) => setPivotValueKey(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full"
                        >
                          <option value="*">Row Count (*)</option>
                          {currentFields.map(f => (
                            <option key={f.name} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Aggregation Function</label>
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

                  {/* Pivot Recharts Stacked Chart */}
                  {pivotResults && pivotResults.pivotedData.length > 0 && (
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
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey={pivotRowKey} stroke="#94a3b8" fontSize={10} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                              <Tooltip 
                                contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px" }}
                                labelClassName="text-slate-400 font-bold text-xs"
                              />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              {pivotResults.columns.map((col, idx) => {
                                const colors = ["#3b82f6", "#e11d48", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
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
                  )}

                  {/* Pivot Grid Table */}
                  {pivotResults && (() => {
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
                                <th className="px-4 py-2.5 uppercase tracking-wider text-blue-400">{pivotRowKey}</th>
                                {pivotResults.columns.map(col => (
                                  <th key={col} className="px-4 py-2.5">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                              {pivotResults.pivotedData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02]">
                                  <td className="px-4 py-2 font-semibold text-white">{row[pivotRowKey]}</td>
                                  {pivotResults.columns.map(col => {
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
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
