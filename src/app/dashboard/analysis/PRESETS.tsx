"use client";
import { QueryDefinition } from "@/lib/dataframe/client-query-engine";

export const PRESETS = [
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
      sort: [{ property: "avg_breach_rate", direction: "desc" }],
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
      sort: [{ property: "total_runs", direction: "desc" }],
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
        { function: "count", property: "number", alias: "breach_count" },
      ],
      sort: [{ property: "breach_count", direction: "desc" }],
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
        { function: "sum", property: "apiCost", alias: "total_spend" },
      ],
      sort: [{ property: "createdAt", direction: "asc" }],
    } as QueryDefinition,
  },
  {
    name: "High Cost Scans (> $5.00)",
    desc: "Locate scans consuming significant API credits.",
    query: {
      table: "scans",
      filters: [{ property: "apiCost", operator: "gt", value: "5.0" }],
      sort: [{ property: "apiCost", direction: "desc" }],
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
        { function: "sum", property: "breaches", alias: "total_breaches" },
      ],
      sort: [{ property: "avg_breach_rate", direction: "desc" }],
    } as QueryDefinition,
  },
  {
    name: "Critical Risk Scans",
    desc: "Retrieve scans classified as CRITICAL safety risk.",
    query: {
      table: "scans",
      filters: [{ property: "riskLevel", operator: "eq", value: "CRITICAL" }],
      sort: [{ property: "score", direction: "asc" }],
    } as QueryDefinition,
  },
];
