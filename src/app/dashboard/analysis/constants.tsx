"use client";
export const SCAN_FIELDS = [
  {
    name: "id",
    label: "Scan ID",
    type: "string",
    desc: "Internal scan identifier",
  },
  {
    name: "reportId",
    label: "Report ID",
    type: "string",
    desc: "Human-readable report ID",
  },
  {
    name: "targetModel",
    label: "Tested Model",
    type: "string",
    desc: "Tested target model name",
  },
  {
    name: "attackerModel",
    label: "Attacker Model",
    type: "string",
    desc: "Attacker model used",
  },
  {
    name: "judgeModel",
    label: "Judge Model",
    type: "string",
    desc: "Judge model used for verdict assessment",
  },
  {
    name: "forbiddenTask",
    label: "Forbidden Task / Policy",
    type: "string",
    desc: "System policy description",
    noChart: true,
  },
  {
    name: "totalTrials",
    label: "Total Trials",
    type: "number",
    desc: "Total runs conducted",
  },
  {
    name: "breaches",
    label: "Breach Count",
    type: "number",
    desc: "Count of successful breaches",
  },
  {
    name: "defendedCount",
    label: "Defended Count",
    type: "number",
    desc: "Count of defended trials",
  },
  {
    name: "unknownCount",
    label: "Unknown Verdicts",
    type: "number",
    desc: "Count of trials with unknown verdicts",
  },
  {
    name: "breachRate",
    label: "Breach Rate (%)",
    type: "number",
    desc: "Percentage breach rate (0-100)",
  },
  {
    name: "score",
    label: "Safety Score (0-100)",
    type: "number",
    desc: "Safety score (100 - breachRate)",
  },
  {
    name: "riskLevel",
    label: "Safety Risk Level",
    type: "string",
    desc: "LOW, MEDIUM, HIGH, or CRITICAL",
  },
  {
    name: "status",
    label: "Job Status",
    type: "string",
    desc: "COMPLETED, FAILED, RUNNING",
  },
  {
    name: "apiCost",
    label: "API Spend ($)",
    type: "number",
    desc: "API cost in USD",
  },
  {
    name: "createdAt",
    label: "Creation Time",
    type: "date",
    desc: "Timestamp of creation",
  },
  {
    name: "createdAt_year",
    label: "Creation Year",
    type: "number",
    desc: "Year of creation (e.g., 2026)",
    hidden: true,
  },
  {
    name: "createdAt_month",
    label: "Creation Month",
    type: "number",
    desc: "Month of creation (1-12)",
    hidden: true,
  },
  {
    name: "createdAt_day",
    label: "Creation Day",
    type: "number",
    desc: "Day of creation (1-31)",
    hidden: true,
  },
  {
    name: "tags",
    label: "Applied Tags",
    type: "string[]",
    desc: "List of applied tags",
  },
  {
    name: "tag",
    label: "Tag (Exploded)",
    type: "string",
    desc: "One row per tag — use for GROUP BY tag or filtering by a single tag value",
  },
];
// Fields the query engine relies on that are not part of the display schema.
const SCAN_INTERNAL_FIELDS = ["trials"];
export const SCAN_WHITELIST = new Set<string>([
  ...SCAN_FIELDS.map((f) => f.name),
  ...SCAN_INTERNAL_FIELDS,
]);

// Drop scan-object keys that aren't part of the known schema so the analysis
// console and query engine only operate on curated fields.
export function sanitizeScan(scan: any): any {
  if (!scan || typeof scan !== "object") return scan;
  const clean: Record<string, any> = {};
  for (const key of Object.keys(scan)) {
    if (SCAN_WHITELIST.has(key)) clean[key] = scan[key];
  }
  if (clean.createdAt && typeof clean.createdAt === "string") {
    try {
      const date = new Date(clean.createdAt);
      if (!isNaN(date.getTime())) {
        clean.createdAt_year = date.getFullYear();
        clean.createdAt_month = date.getMonth() + 1;
        clean.createdAt_day = date.getDate();
      }
    } catch (e) {}
  }
  return clean;
}
export const TRIAL_FIELDS = [
  {
    name: "number",
    label: "Trial Run Index",
    type: "number",
    desc: "Trial run index",
    noChart: true,
  },
  {
    name: "verdict",
    label: "Breach Verdict",
    type: "string",
    desc: "BREACHED, DEFENDED, or UNKNOWN",
  },
  {
    name: "attack",
    label: "Adversarial Payload",
    type: "string",
    desc: "Adversarial payload prompt text",
    noChart: true,
  },
  {
    name: "response",
    label: "Tested LLM Output",
    type: "string",
    desc: "Tested LLM response",
    noChart: true,
  },
  {
    name: "judgeVerdict",
    label: "Judge Reasoning",
    type: "string",
    desc: "Reasoning from the judge",
    noChart: true,
  },
  {
    name: "taskTag",
    label: "Task Category Tag",
    type: "string",
    desc: "Category identifier slug",
  },
  {
    name: "entropyLabel",
    label: "Complexity Label",
    type: "string",
    desc: "Attack complexity grouping",
  },
  {
    name: "framingLabel",
    label: "Framing Classification",
    type: "string",
    desc: "Framing mechanism classification",
  },
  {
    name: "patternId",
    label: "Attack Pattern ID",
    type: "string",
    desc: "Attack pattern identifier",
  },
  {
    name: "targetModel",
    label: "Tested Model",
    type: "string",
    desc: "Tested model (Joined)",
  },
  {
    name: "attackerModel",
    label: "Attacker Model",
    type: "string",
    desc: "Attacker model (Joined)",
  },
  {
    name: "forbiddenTask",
    label: "Forbidden Task",
    type: "string",
    desc: "Forbidden task (Joined)",
    noChart: true,
  },
  {
    name: "createdAt",
    label: "Creation Time",
    type: "date",
    desc: "Scan date (Joined)",
  },
  {
    name: "createdAt_year",
    label: "Creation Year",
    type: "number",
    desc: "Year of creation (e.g., 2026)",
  },
  {
    name: "createdAt_month",
    label: "Creation Month",
    type: "number",
    desc: "Month of creation (1-12)",
  },
  {
    name: "createdAt_day",
    label: "Creation Day",
    type: "number",
    desc: "Day of creation (1-31)",
  },
];
// Fields the query engine joins onto each trial from its parent scan that are
// not part of the TRIAL_FIELDS display schema but are still useful for analysis.
const TRIAL_INTERNAL_FIELDS = ["scanId", "reportId"];
export const TRIAL_WHITELIST = new Set<string>([
  ...TRIAL_FIELDS.map((f) => f.name),
  ...TRIAL_INTERNAL_FIELDS,
]);

// Drop trial-object keys that aren't part of the known schema so the analysis
// console and query engine only operate on curated fields. This blocks noisy
// raw fields like judgeLabel, transcript, targetThing, and seedTemplate from
// ever reaching the flat data table or charts.
export function sanitizeTrial(trial: any): any {
  if (!trial || typeof trial !== "object") return trial;
  const clean: Record<string, any> = {};
  for (const key of Object.keys(trial)) {
    if (TRIAL_WHITELIST.has(key)) clean[key] = trial[key];
  }
  return clean;
}
export const OPERATORS_BY_TYPE: Record<
  string,
  { value: string; label: string }[]
> = {
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
  ],
};
