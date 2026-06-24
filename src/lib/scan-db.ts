/**
 * SentinelPrompt — DB helpers for Scan records.
 *
 * Converts Prisma Scan rows (which store JSON fields as strings) into the
 * typed Scan/Trial structures used by the UI.
 */
import { db } from "@/lib/db";
import {
  JudgeLabel,
  RiskLevel,
  ScanStatus,
  TrialVerdict,
  formatModelName,
} from "@/lib/enums";
import type { Scan, ScanSummary, ToolDef, Trial } from "@/lib/types";

/** Convert a Prisma Scan row to the typed Scan structure. */
export function deserializeScan(row: {
  id: string;
  reportId: string;
  userId: string;
  targetModel: string;
  attackerModel: string;
  judgeModel: string;
  hardenerModel: string;
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: string;
  mockToolResponses: string;
  trials: string;
  score: number;
  riskLevel: string;
  totalTrials: number;
  breaches: number;
  breachRate: number;
  summary: string;
  summaryDetail: string;
  hardenedPrompts?: Array<{
    id: string;
    scanId: string;
    modelId: string;
    modelName: string;
    prompt: string;
    toolRecommendation?: string | null;
    compatibilityScore?: number | null;
    granularity?: string | null;
    extractorModel?: string | null;
    createdAt: Date;
  }>;
  status: string;
  createdAt: Date;
}): Scan {
  let tools: ToolDef[] = [];
  let mockToolResponses: Record<string, unknown> = {};
  let trials: Trial[] = [];
  try {
    tools = JSON.parse(row.tools) as ToolDef[];
  } catch {
    /* keep empty */
  }
  try {
    mockToolResponses = JSON.parse(row.mockToolResponses) as Record<
      string,
      unknown
    >;
  } catch {
    /* keep empty */
  }
  try {
    const raw = JSON.parse(row.trials) as Array<Record<string, unknown>>;
    trials = raw.map((t) => ({
      number: t.number as number,
      verdict: t.verdict as TrialVerdict,
      attack: t.attack as string,
      response: t.response as string,
      judgeLabel: t.judgeLabel as JudgeLabel,
      judgeVerdict: t.judgeVerdict as string,
      toolCalls: t.toolCalls as Trial["toolCalls"],
      taskTag: t.taskTag as string | undefined,
      entropyLabel: t.entropyLabel as string | undefined,
      framingLabel: t.framingLabel as string | undefined,
      patternId: t.patternId as string | undefined,
    }));
  } catch {
    /* keep empty */
  }

  return {
    id: row.reportId,
    issuedDate: row.createdAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    targetModel: row.targetModel,
    attackerModel: row.attackerModel || "",
    judgeModel: row.judgeModel || "",
    hardenerModel: row.hardenerModel || DEFAULT_MODEL,
    systemPrompt: row.systemPrompt,
    forbiddenTask: row.forbiddenTask,
    judgeInstructions: row.judgeInstructions,
    tools,
    mockToolResponses,
    trials,
    totalTrials: row.totalTrials,
    breaches: row.breaches,
    breachRate: row.breachRate,
    score: row.score,
    riskLevel: row.riskLevel as RiskLevel,
    status: row.status as ScanStatus,
    summary: row.summary,
    summaryDetail: row.summaryDetail,
    hardenedPrompts: (row.hardenedPrompts || []).map((hp) => {
      let recObj: any = null;
      if (hp.toolRecommendation) {
        try {
          recObj = JSON.parse(hp.toolRecommendation);
        } catch {}
      }
      return {
        id: hp.id,
        scanId: hp.scanId,
        modelId: hp.modelId,
        modelName: hp.modelName,
        prompt: hp.prompt,
        toolRecommendation: recObj,
        compatibilityScore: hp.compatibilityScore,
        granularity: hp.granularity,
        extractorModel: hp.extractorModel,
        createdAt: hp.createdAt.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      };
    }),
    apiCost: (row as any).apiCost || 0,
    modelName: "", // filled by caller via lookupModelNames
    attackerModelName: "", // filled by caller via lookupModelNames
    judgeModelName: "", // filled by caller via lookupModelNames
    hardenerModelName: "", // filled by caller via lookupModelNames
  };
}

/** Look up human-readable model names for a set of model ids. */
async function lookupModelNames(
  ids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  const models = await db.model.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  const map: Record<string, string> = {};
  for (const m of models) map[m.id] = m.name;
  return map;
}

/** Fetch a single scan by its reportId, scoped to a user. */
export async function getScanByReportId(
  reportId: string,
  userId: string,
): Promise<Scan | null> {
  const row = await db.scan.findFirst({
    where: { reportId, userId },
    include: { hardenedPrompts: true },
  });
  if (!row) return null;
  const scan = deserializeScan(row);
  const allIds = [
    scan.targetModel,
    scan.attackerModel,
    scan.judgeModel,
    scan.hardenerModel,
  ].filter(Boolean);
  const names = await lookupModelNames(allIds);
  scan.modelName = names[scan.targetModel] || formatModelName(scan.targetModel);
  scan.attackerModelName =
    names[scan.attackerModel] || formatModelName(scan.attackerModel);
  scan.judgeModelName =
    names[scan.judgeModel] || formatModelName(scan.judgeModel);
  scan.hardenerModelName =
    names[scan.hardenerModel] || formatModelName(scan.hardenerModel);
  return scan;
}

/** Fetch a user's recent scans (for the overview activity feed + reports list). */
export async function getUserScans(userId: string): Promise<ScanSummary[]> {
  const rows = await db.scan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const names = await lookupModelNames(rows.map((r) => r.targetModel));
  return rows.map((row) => ({
    id: row.reportId,
    issuedDate: row.createdAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    targetModel: row.targetModel,
    modelName: names[row.targetModel] || formatModelName(row.targetModel),
    promptExcerpt: row.systemPrompt.slice(0, 80),
    breaches: row.breaches,
    totalTrials: row.totalTrials,
    score: row.score,
    riskLevel: row.riskLevel as RiskLevel,
    status: row.status as ScanStatus,
    relativeTime: formatRelativeTime(row.createdAt),
  }));
}

/** Fetch all scans across all users (admin only). */
export async function getAllScans(): Promise<ScanSummary[]> {
  const rows = await db.scan.findMany({
    orderBy: { createdAt: "desc" },
  });
  const names = await lookupModelNames(rows.map((r) => r.targetModel));
  return rows.map((row) => ({
    id: row.reportId,
    issuedDate: row.createdAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    targetModel: row.targetModel,
    modelName: names[row.targetModel] || formatModelName(row.targetModel),
    promptExcerpt: row.systemPrompt.slice(0, 80),
    breaches: row.breaches,
    totalTrials: row.totalTrials,
    score: row.score,
    riskLevel: row.riskLevel as RiskLevel,
    status: row.status as ScanStatus,
    relativeTime: formatRelativeTime(row.createdAt),
  }));
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Compute dashboard aggregate stats from a list of scan summaries. */
export function computeDashboardStats(scans: ScanSummary[]) {
  const totalScans = scans.length;
  const totalBreaches = scans.reduce((s, sc) => s + sc.breaches, 0);
  const avgScore =
    totalScans > 0
      ? Math.round(scans.reduce((s, sc) => s + sc.score, 0) / totalScans)
      : 0;

  // Risk distribution
  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 } as Record<
    string,
    number
  >;
  for (const s of scans)
    riskCounts[s.riskLevel] = (riskCounts[s.riskLevel] || 0) + 1;
  const riskDistribution = [
    { level: RiskLevel.Low, count: riskCounts["low"] || 0 },
    { level: RiskLevel.Medium, count: riskCounts["medium"] || 0 },
    { level: RiskLevel.High, count: riskCounts["high"] || 0 },
    { level: RiskLevel.Critical, count: riskCounts["critical"] || 0 },
  ].filter((s) => s.count > 0);

  // Score trend (oldest → newest)
  const scoreTrend = [...scans]
    .reverse()
    .map((s, i) => ({ label: `Scan ${i + 1}`, score: s.score }));

  // Model usage — group by model id, keep the display name
  const modelMap = {} as Record<string, { name: string; scans: number }>;
  for (const s of scans) {
    if (!modelMap[s.targetModel]) {
      modelMap[s.targetModel] = {
        name: s.modelName || s.targetModel,
        scans: 0,
      };
    }
    modelMap[s.targetModel].scans++;
  }
  const modelUsage = Object.entries(modelMap)
    .map(([model, info]) => ({ model, scans: info.scans, name: info.name }))
    .sort((a, b) => b.scans - a.scans);

  // Attack success rate (aggregated across all scans)
  const totalTrials = scans.reduce((s, sc) => s + sc.totalTrials, 0);
  const totalDefended = totalTrials - totalBreaches;
  const rate =
    totalTrials > 0 ? Math.round((totalBreaches / totalTrials) * 100) : 0;
  const attackSuccessRate =
    totalTrials > 0
      ? [
          {
            category: "Forbidden Task 1 — All scans",
            breached: totalBreaches,
            defended: totalDefended,
            rate,
          },
        ]
      : [];

  return {
    totalScans,
    totalBreaches,
    avgScore,
    apiScans: 0,
    riskDistribution,
    scoreTrend,
    modelUsage,
    attackSuccessRate,
  };
}
