"use client";
import { QueryDefinition } from "@/lib/dataframe/client-query-engine";

export const PRESETS: { name: string; desc: string; query: QueryDefinition }[] =
  [
    // ─── Scan-level summaries ─────────────────────────────────────────────────

    {
      name: "Model Performance Summary",
      desc: "Average breach rate, cost and totals grouped by tested model.",
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
      name: "Model Comparison (Extended)",
      desc: "Min, max and count stats per target model — mirrors the 'Comparing Models' doc section.",
      query: {
        table: "scans",
        group_by: ["targetModel"],
        aggregations: [
          { function: "count", property: "*", alias: "scan_count" },
          { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
          { function: "min", property: "breachRate", alias: "min_breach_rate" },
          { function: "max", property: "breachRate", alias: "max_breach_rate" },
          { function: "avg", property: "score", alias: "avg_score" },
          { function: "sum", property: "totalTrials", alias: "total_trials" },
          { function: "sum", property: "apiCost", alias: "total_cost" },
        ],
        sort: [{ property: "avg_breach_rate", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Attacker Model Breakdown",
      desc: "Which attacker models achieve the highest breach rate.",
      query: {
        table: "scans",
        group_by: ["attackerModel"],
        aggregations: [
          { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
          { function: "sum", property: "breaches", alias: "total_breaches" },
          { function: "count", property: "*", alias: "scan_count" },
        ],
        sort: [{ property: "avg_breach_rate", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Attacker × Target Model Matrix",
      desc: "Cross-tabulate attacker and target models to find adversarially effective pairings.",
      query: {
        table: "scans",
        group_by: ["attackerModel", "targetModel"],
        aggregations: [
          { function: "count", property: "*", alias: "scan_count" },
          { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
        ],
        sort: [{ property: "avg_breach_rate", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Risk Level Distribution",
      desc: "Count scans at each risk level with average breach rate per band.",
      query: {
        table: "scans",
        group_by: ["riskLevel"],
        aggregations: [
          { function: "count", property: "*", alias: "scan_count" },
          { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
          { function: "sum", property: "apiCost", alias: "total_cost" },
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

    {
      name: "High Cost Scans (> $5.00)",
      desc: "Locate scans consuming significant API credits.",
      query: {
        table: "scans",
        filters: [{ property: "apiCost", operator: "gt", value: "5.0" }],
        sort: [{ property: "apiCost", direction: "desc" }],
      } as QueryDefinition,
    },

    // ─── Temporal / trend analysis ────────────────────────────────────────────

    {
      name: "Daily Spend & Safety Trends",
      desc: "Daily rolling average safety score and API costs (line chart recommended).",
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
      name: "Model Safety Timeline",
      desc: "Track how each model's safety score and breach rate change per scan date.",
      query: {
        table: "scans",
        group_by: ["targetModel", "createdAt"],
        aggregations: [
          { function: "avg", property: "score", alias: "avg_score" },
          { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
          { function: "count", property: "*", alias: "scan_count" },
        ],
        sort: [{ property: "createdAt", direction: "asc" }],
      } as QueryDefinition,
    },

    // ─── Tag analysis (virtual exploded `tag` field) ──────────────────────────

    {
      name: "Per-Tag Performance",
      desc: "Aggregate breach rate, trial counts and cost grouped by each tag. Uses the virtual 'tag' (exploded) field.",
      query: {
        table: "scans",
        group_by: ["tag"],
        aggregations: [
          { function: "count", property: "*", alias: "scan_count" },
          { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
          { function: "min", property: "breachRate", alias: "min_breach_rate" },
          { function: "max", property: "breachRate", alias: "max_breach_rate" },
          { function: "sum", property: "totalTrials", alias: "total_trials" },
          { function: "sum", property: "apiCost", alias: "total_cost" },
        ],
        sort: [{ property: "avg_breach_rate", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Tag × Model Breach Matrix",
      desc: "Pivot: average breach rate for every tag and model combination. Use the Pivot Matrix tab for a heatmap.",
      query: {
        table: "scans",
        group_by: ["tag", "targetModel"],
        aggregations: [
          { function: "count", property: "*", alias: "scan_count" },
          { function: "avg", property: "breachRate", alias: "avg_breach_rate" },
        ],
        sort: [{ property: "avg_breach_rate", direction: "desc" }],
      } as QueryDefinition,
    },

    // ─── Trial-level analysis ─────────────────────────────────────────────────

    {
      name: "Vulnerable Attack Patterns",
      desc: "Execution run count grouped by attack pattern identifier.",
      query: {
        table: "trials",
        group_by: ["patternId"],
        aggregations: [
          { function: "count", property: "number", alias: "total_runs" },
        ],
        sort: [{ property: "total_runs", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Weak Points (High Risk Task Tags)",
      desc: "Breach count distributions across different task categories.",
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
      name: "Breaches by Framing Style",
      desc: "Which framing / social-engineering classification yields the most breaches.",
      query: {
        table: "trials",
        filters: [{ property: "verdict", operator: "eq", value: "BREACHED" }],
        group_by: ["framingLabel"],
        aggregations: [
          { function: "count", property: "number", alias: "breach_count" },
        ],
        sort: [{ property: "breach_count", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Breaches by Complexity Level",
      desc: "Breach count by entropy / attack complexity label.",
      query: {
        table: "trials",
        filters: [{ property: "verdict", operator: "eq", value: "BREACHED" }],
        group_by: ["entropyLabel"],
        aggregations: [
          { function: "count", property: "number", alias: "breach_count" },
        ],
        sort: [{ property: "breach_count", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Pattern × Framing Combinations",
      desc: "Top attack pattern + framing pairs ranked by breach count.",
      query: {
        table: "trials",
        filters: [{ property: "verdict", operator: "eq", value: "BREACHED" }],
        group_by: ["patternId", "framingLabel"],
        aggregations: [
          { function: "count", property: "number", alias: "breach_count" },
        ],
        sort: [{ property: "breach_count", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Per-Model × Pattern Breaches",
      desc: "For each target model, which attack patterns succeed most often.",
      query: {
        table: "trials",
        filters: [{ property: "verdict", operator: "eq", value: "BREACHED" }],
        group_by: ["targetModel", "patternId"],
        aggregations: [
          { function: "count", property: "number", alias: "breach_count" },
        ],
        sort: [{ property: "breach_count", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "Defended Trials by Task Tag",
      desc: "Which task categories are most reliably defended.",
      query: {
        table: "trials",
        filters: [{ property: "verdict", operator: "eq", value: "DEFENDED" }],
        group_by: ["taskTag"],
        aggregations: [
          { function: "count", property: "number", alias: "defended_count" },
        ],
        sort: [{ property: "defended_count", direction: "desc" }],
      } as QueryDefinition,
    },

    {
      name: "All Trials (Flat View)",
      desc: "Full trial-level dataset with key categorical fields projected for inspection.",
      query: {
        table: "trials",
        projections: [
          "targetModel",
          "verdict",
          "patternId",
          "framingLabel",
          "entropyLabel",
          "taskTag",
          "targetThing",
          "createdAt",
        ],
        sort: [{ property: "targetModel", direction: "asc" }],
      } as QueryDefinition,
    },
  ];
