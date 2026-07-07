import {
  QueryDefinition,
  FilterCondition,
  Aggregation,
  SortInstruction,
} from "./client-query-engine";

function escapeString(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatValue(val: any, type?: string): string {
  if (val === undefined || val === null) return "None";
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return `"${escapeString(String(val))}"`;
}

function compileFilterCondition(f: FilterCondition, varName: string): string {
  const prop = f.property;
  if (!prop) return "";
  const op = f.operator;
  const val = f.value;

  switch (op) {
    case "eq":
      return `${varName}[${varName}[${formatValue(prop)}] == ${formatValue(val)}]`;
    case "neq":
      return `${varName}[${varName}[${formatValue(prop)}] != ${formatValue(val)}]`;
    case "gt":
      return `${varName}[${varName}[${formatValue(prop)}] > ${Number(val) || 0}]`;
    case "lt":
      return `${varName}[${varName}[${formatValue(prop)}] < ${Number(val) || 0}]`;
    case "geq":
      return `${varName}[${varName}[${formatValue(prop)}] >= ${Number(val) || 0}]`;
    case "leq":
      return `${varName}[${varName}[${formatValue(prop)}] <= ${Number(val) || 0}]`;
    case "like":
      return `${varName}[${varName}[${formatValue(prop)}].astype(str).str.contains(${formatValue(val)}, case=False, na=False)]`;
    case "not_like":
      return `${varName}[~${varName}[${formatValue(prop)}].astype(str).str.contains(${formatValue(val)}, case=False, na=False)]`;
    case "in_set": {
      const items = String(val)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const pyList = `[${items.map((i) => formatValue(i)).join(", ")}]`;
      return `${varName}[${varName}[${formatValue(prop)}].isin(${pyList})]`;
    }
    case "not_in_set": {
      const items = String(val)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const pyList = `[${items.map((i) => formatValue(i)).join(", ")}]`;
      return `${varName}[~${varName}[${formatValue(prop)}].isin(${pyList})]`;
    }
    case "between": {
      const parts = String(val).split(",");
      const minVal = parts[0] ? parts[0].trim() : "";
      const maxVal = parts[1] ? parts[1].trim() : "";
      return `${varName}[(${varName}[${formatValue(prop)}] >= ${formatValue(minVal)}) & (${varName}[${formatValue(prop)}] <= ${formatValue(maxVal)})]`;
    }
    case "not_between": {
      const parts = String(val).split(",");
      const minVal = parts[0] ? parts[0].trim() : "";
      const maxVal = parts[1] ? parts[1].trim() : "";
      return `${varName}[~((${varName}[${formatValue(prop)}] >= ${formatValue(minVal)}) & (${varName}[${formatValue(prop)}] <= ${formatValue(maxVal)}))]`;
    }
    default:
      return "";
  }
}

function compileQueryBody(
  query: QueryDefinition,
  savedQueries: any[],
  indent: string,
  varName: string = "df",
  freshVar: () => string = () => "df_right",
): string[] {
  const parts: string[] = [];

  // Find target source
  if (query.sourceViewId) {
    const parent = savedQueries.find((q) => q.id === query.sourceViewId);
    if (parent) {
      const parentNameSafe = parent.name.replace(/[^a-zA-Z0-9_]/g, "_");
      parts.push(`${indent}# Load parent view: ${parent.name}`);
      parts.push(
        `${indent}${varName} = get_view_${parentNameSafe}(scans_list)`,
      );
    } else {
      parts.push(
        `${indent}# Parent view ${query.sourceViewId} not found, falling back to scans`,
      );
      parts.push(`${indent}${varName} = pd.DataFrame(scans_list)`);
    }
  } else {
    const targetTable = query.table || "scans";
    parts.push(
      `${indent}# Prepare Base DataFrame (Source Table: ${targetTable})`,
    );
    if (targetTable === "trials") {
      parts.push(`${indent}trials_rows = []`);
      parts.push(`${indent}for s in scans_list:`);
      parts.push(`${indent}    trials_list = s.get("trials", [])`);
      parts.push(`${indent}    if isinstance(trials_list, str):`);
      parts.push(`${indent}        trials_list = json.loads(trials_list)`);
      parts.push(`${indent}    for t in trials_list:`);
      parts.push(`${indent}        t["targetModel"] = s.get("targetModel")`);
      parts.push(`${indent}        t["createdAt"] = s.get("createdAt")`);
      parts.push(`${indent}        trials_rows.append(t)`);
      parts.push(`${indent}${varName} = pd.DataFrame(trials_rows)`);
    } else {
      parts.push(`${indent}${varName} = pd.DataFrame(scans_list)`);
    }
  }
  parts.push("");

  // Check if any date components are queried
  const allFieldsStr = JSON.stringify(query);
  const referencesDateComponents =
    allFieldsStr.includes("createdAt_year") ||
    allFieldsStr.includes("createdAt_month") ||
    allFieldsStr.includes("createdAt_day");

  if (referencesDateComponents) {
    parts.push(`${indent}# Project Virtual Date Fields`);
    parts.push(`${indent}if "createdAt" in ${varName}.columns:`);
    parts.push(
      `${indent}    ${varName}["createdAt_dt"] = pd.to_datetime(${varName}["createdAt"])`,
    );
    parts.push(
      `${indent}    ${varName}["createdAt_year"] = ${varName}["createdAt_dt"].dt.year`,
    );
    parts.push(
      `${indent}    ${varName}["createdAt_month"] = ${varName}["createdAt_dt"].dt.month`,
    );
    parts.push(
      `${indent}    ${varName}["createdAt_day"] = ${varName}["createdAt_dt"].dt.day`,
    );
    parts.push("");
  }

  // Explode tags[] -> tag if the virtual "tag" field is referenced
  const allFieldsReferenced = [
    ...(query.filters ?? []).map((f) => f.property),
    ...(query.projections ?? []),
    ...(query.group_by ?? []),
    ...(query.sort ?? []).map((s) => s.property),
  ];
  const referencesTag = allFieldsReferenced.includes("tag");

  if (referencesTag) {
    parts.push(
      `${indent}# Explode tags[] array -> one row per tag (virtual 'tag' field)`,
    );
    parts.push(`${indent}if "tags" in ${varName}.columns:`);
    parts.push(
      `${indent}    ${varName} = ${varName}.explode("tags").rename(columns={"tags": "tag"})`,
    );
    parts.push(
      `${indent}    ${varName} = ${varName}[${varName}["tag"].notna() & (${varName}["tag"] != "")]`,
    );
    parts.push("");
  }

  // Filters
  if (query.filters && query.filters.length > 0) {
    parts.push(`${indent}# Apply WHERE Filter Conditions`);
    for (const f of query.filters) {
      const code = compileFilterCondition(f, varName);
      if (code) {
        parts.push(`${indent}${varName} = ${code}`);
      }
    }
    parts.push("");
  }

  // Group By
  if (query.group_by && query.group_by.length > 0) {
    parts.push(`${indent}# Group By & Aggregation Steps`);
    const aggDict: string[] = [];
    if (query.aggregations && query.aggregations.length > 0) {
      for (const agg of query.aggregations) {
        const prop = agg.property === "*" ? "id" : agg.property;
        // Map engine function names to pandas aggfunc strings or lambdas
        let pyFunc: string;
        switch (agg.function) {
          case "count":
            pyFunc = '"count"';
            break;
          case "count_distinct":
            pyFunc = '"nunique"';
            break;
          case "sum":
            pyFunc = '"sum"';
            break;
          case "avg":
            pyFunc = '"mean"';
            break;
          case "min":
            pyFunc = '"min"';
            break;
          case "max":
            pyFunc = '"max"';
            break;
          case "std_dev":
            pyFunc = '"std"';
            break;
          case "median":
            pyFunc = '"median"';
            break;
          case "q1":
            pyFunc = "lambda x: x.quantile(0.25)";
            break;
          case "q3":
            pyFunc = "lambda x: x.quantile(0.75)";
            break;
          case "range":
            pyFunc = "lambda x: x.max() - x.min()";
            break;

          default:
            pyFunc = `"${agg.function}"`;
        }
        const groupPrefix =
          query.group_by && query.group_by.length
            ? query.group_by.join("_") + "_"
            : "";
        const aliasBase = agg.property === "*" ? "count" : agg.property;
        const alias = agg.alias || `${groupPrefix}${aliasBase}_${agg.function}`;
        aggDict.push(
          `${indent}    ${alias}=pd.NamedAgg(column="${prop}", aggfunc=${pyFunc})`,
        );
      }
    } else {
      aggDict.push(
        `${indent}    count=pd.NamedAgg(column="id", aggfunc="size")`,
      );
    }
    const groupKeys = query.group_by.map((g) => `"${g}"`).join(", ");
    parts.push(`${indent}${varName} = ${varName}.groupby([${groupKeys}]).agg(`);
    parts.push(aggDict.join(",\n"));
    parts.push(`${indent}).reset_index()`);
    parts.push("");
  } else if (query.projections && query.projections.length > 0) {
    parts.push(`${indent}# SELECT Projected Columns`);
    const projKeys = query.projections.map((p) => `"${p}"`).join(", ");
    parts.push(`${indent}${varName} = ${varName}[[${projKeys}]]`);
    parts.push("");
  }

  // Sort
  if (query.sort && query.sort.length > 0) {
    parts.push(`${indent}# ORDER BY Sorting instructions`);
    const sortKeys = query.sort.map((s) => `"${s.property}"`).join(", ");
    const ascendingKeys = query.sort
      .map((s) => (s.direction === "asc" ? "True" : "False"))
      .join(", ");
    parts.push(
      `${indent}${varName} = ${varName}.sort_values(by=[${sortKeys}], ascending=[${ascendingKeys}])`,
    );
    parts.push("");
  }

  // Limit
  if (query.limit !== undefined) {
    parts.push(`${indent}# LIMIT Constraint`);
    parts.push(`${indent}${varName} = ${varName}.head(${query.limit})`);
    parts.push("");
  }

  // Set Algebra (UNION / INTERSECT / EXCEPT) — applied after LIMIT, matching engine order
  const setOps: Array<
    ["union" | "intersect" | "except", keyof QueryDefinition]
  > = [
    ["union", "union"],
    ["intersect", "intersect"],
    ["except", "except"],
  ];
  for (const [op, key] of setOps) {
    const sub = query[key] as QueryDefinition | undefined;
    if (!sub) continue;
    const rightVar = freshVar();
    parts.push(`${indent}# Set Operation: ${op.toUpperCase()}`);
    parts.push(
      ...compileQueryBody(sub, savedQueries, indent, rightVar, freshVar),
    );
    if (op === "union") {
      parts.push(
        `${indent}${varName} = pd.concat([${varName}, ${rightVar}], ignore_index=True)`,
      );
      parts.push(
        `${indent}${varName} = ${varName}.drop_duplicates(subset="id") if "id" in ${varName}.columns else ${varName}.drop_duplicates()`,
      );
    } else if (op === "intersect") {
      parts.push(
        `${indent}${varName} = ${varName}[${varName}["id"].isin(${rightVar}["id"])] if "id" in ${varName}.columns else ${varName}.merge(${rightVar}, how="inner")`,
      );
    } else if (op === "except") {
      parts.push(
        `${indent}${varName} = ${varName}[~${varName}["id"].isin(${rightVar}["id"])] if "id" in ${varName}.columns else ${varName}[~${varName}.index.isin(${rightVar}.index)]`,
      );
    }
    parts.push("");
  }

  return parts;
}

function gatherAncestorViews(
  viewId: string,
  savedQueries: any[],
  visited = new Set<string>(),
): any[] {
  if (visited.has(viewId)) return [];
  visited.add(viewId);

  const parent = savedQueries.find((q) => q.id === viewId);
  if (!parent) return [];

  const ancestors: any[] = [];
  if (parent.query.sourceViewId) {
    ancestors.push(
      ...gatherAncestorViews(parent.query.sourceViewId, savedQueries, visited),
    );
  }
  ancestors.push(parent);
  return ancestors;
}

export function translateQueryToPython(
  query: QueryDefinition,
  savedQueries: any[] = [],
  pivotConfig?: {
    rowKey: string;
    colKey: string;
    valueKey: string;
    aggType: "count" | "sum" | "avg";
    enableHeatmap: boolean;
  } | null,
): string {
  const parts: string[] = [];

  // Variable name generators for uniquely-named intermediate frames
  let varCounter = 1;
  const freshVar = () => `df${++varCounter}`;
  let pivotCounter = 0;
  const freshPivotVar = () => `df_pivot${++pivotCounter}`;

  parts.push("#!/usr/bin/env python3");
  parts.push('"""');
  parts.push("Automatically generated Pandas Data Pipeline");
  parts.push("Generated by the Client-Side Analysis Console Code Exporter");
  parts.push('"""');
  parts.push("import pandas as pd");
  parts.push("import json");
  parts.push("from pathlib import Path");
  parts.push("");
  parts.push("# 1. Load active scans from JSONL / local DB backup file");
  parts.push("def load_scans_data(filepath: str):");
  parts.push("    scans = []");
  parts.push("    try:");
  parts.push('        with open(filepath, "r", encoding="utf-8") as f:');
  parts.push("            for line in f:");
  parts.push("                if line.strip():");
  parts.push("                    scans.append(json.loads(line))");
  parts.push("    except FileNotFoundError:");
  parts.push(
    '        print(f"File not found: {filepath}. Please supply a valid backup file.")',
  );
  parts.push("    return scans");
  parts.push("");
  parts.push(
    '# Replace with your local backup file path (e.g. download via "Export Local DB" button)',
  );
  parts.push('FILENAME = "scans_export.jsonl"');
  parts.push("scans_list = load_scans_data(FILENAME)");
  parts.push("");

  // Recursively compile parent views if referenced
  const ancestors = query.sourceViewId
    ? gatherAncestorViews(query.sourceViewId, savedQueries)
    : [];
  if (ancestors.length > 0) {
    parts.push("# --- Recursive Parent View Helper Functions ---");
    for (const parent of ancestors) {
      const parentNameSafe = parent.name.replace(/[^a-zA-Z0-9_]/g, "_");
      parts.push(`def get_view_${parentNameSafe}(scans_list):`);
      parts.push(
        ...compileQueryBody(parent.query, savedQueries, "    ", "df", freshVar),
      );
      parts.push("    return df");
      parts.push("");
    }
  }

  parts.push("# --- Execute Main Pipeline ---");
  parts.push(...compileQueryBody(query, savedQueries, "", "df", freshVar));

  // Pivot Matrix (optional, separate variable each time)
  let pivotVarName: string | null = null;
  if (pivotConfig && pivotConfig.rowKey && pivotConfig.colKey) {
    pivotVarName = freshPivotVar();
    const aggfunc =
      pivotConfig.aggType === "avg"
        ? '"mean"'
        : pivotConfig.aggType === "sum"
          ? '"sum"'
          : '"count"';
    parts.push("# --- Pivot Matrix ---");
    if (pivotConfig.valueKey === "*") {
      parts.push(`df["__pivot_count"] = 1`);
      parts.push(
        `${pivotVarName} = pd.pivot_table(df, index="${pivotConfig.rowKey}", columns="${pivotConfig.colKey}", values="__pivot_count", aggfunc="sum")`,
      );
    } else {
      parts.push(
        `${pivotVarName} = pd.pivot_table(df, index="${pivotConfig.rowKey}", columns="${pivotConfig.colKey}", values=${formatValue(pivotConfig.valueKey)}, aggfunc=${aggfunc})`,
      );
    }
    if (pivotConfig.enableHeatmap) {
      parts.push(
        "# enableHeatmap is a UI-only overlay; the matrix above is the underlying data",
      );
    }
    parts.push("");
  }

  parts.push("# Output Pipeline Results");
  parts.push("print(f'Pipeline completed. Returned {len(df)} rows:')");
  parts.push("print(df.head(20))");
  if (pivotVarName) {
    parts.push(
      `print(f'Pivot matrix (${pivotConfig!.rowKey} x ${pivotConfig!.colKey}):')`,
    );
    parts.push(`print(${pivotVarName}.head(20))`);
  }
  parts.push("");

  return parts.join("\n");
}
