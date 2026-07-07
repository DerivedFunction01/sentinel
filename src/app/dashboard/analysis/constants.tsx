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
    name: "forbiddenTask",
    label: "Forbidden Task / Policy",
    type: "string",
    desc: "System policy description",
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
  return clean;
}
export const TRIAL_FIELDS = [
  {
    name: "number",
    label: "Trial Run Index",
    type: "number",
    desc: "Trial run index",
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
  },
  {
    name: "response",
    label: "Tested LLM Output",
    type: "string",
    desc: "Tested LLM response",
  },
  {
    name: "judgeVerdict",
    label: "Judge Reasoning",
    type: "string",
    desc: "Reasoning from the judge",
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
    name: "targetThing",
    label: "Target Variant Thing",
    type: "string",
    desc: "Variant subject name",
  },
  {
    name: "targetModel",
    label: "Tested Model",
    type: "string",
    desc: "Tested model (Joined)",
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
