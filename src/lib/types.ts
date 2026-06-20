/**
 * SentinelPrompt — Domain Types
 */
import type {
  DashboardRoute,
  JudgeLabel,
  RiskLevel,
  ScanStatus,
  TrialVerdict,
} from "@/lib/enums";

/** A single tool definition in OpenRouter function-calling format. */
export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** A recorded tool-call round-trip within a trial. */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  mockResponse: unknown;
}

/** One adversarial trial in a scan. */
export interface Trial {
  number: number;
  verdict: TrialVerdict;
  attack: string;
  response: string;
  judgeLabel: JudgeLabel;
  judgeVerdict: string;
  toolCalls?: ToolCall[];
  /** The forbidden task this trial targeted, e.g. "forbidden_task_1". */
  taskTag?: string;
  /** Entropy level label, e.g. "Low Entropy" / "High Entropy". */
  entropyLabel?: string;
  /** Framing strategy label, e.g. "Concrete" / "Abstract". */
  framingLabel?: string;
  /** The pattern that generated this attack, e.g. "curiosity_pattern". */
  patternId?: string;
}

/** A complete pentest scan. */
export interface Scan {
  id: string;
  issuedDate: string;
  targetModel: string; // OpenRouter model id, e.g. "anthropic/claude-3.5-haiku"
  modelName: string; // human-readable name from the Model table
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: ToolDef[];
  mockToolResponses: Record<string, unknown>;
  totalTrials: number;
  breaches: number;
  breachRate: number;
  score: number;
  riskLevel: RiskLevel;
  status: ScanStatus;
  summary: string;
  summaryDetail: string;
  trials: Trial[];
}

/** Lightweight scan reference for list/activity views. */
export interface ScanSummary {
  id: string;
  issuedDate: string;
  targetModel: string; // OpenRouter model id
  modelName: string; // human-readable name from the Model table
  promptExcerpt: string;
  breaches: number;
  totalTrials: number;
  score: number;
  riskLevel: RiskLevel;
  status: ScanStatus;
  relativeTime: string;
}

/** Authenticated user. */
export interface User {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  scanTokens: number;
  totalScans: number;
  apiScans: number;
}

/** Dashboard-level aggregate statistics. */
export interface DashboardStats {
  totalScans: number;
  totalBreaches: number;
  avgScore: number;
  apiScans: number;
}

/** A model + how many scans used it. */
export interface ModelUsageEntry {
  model: string; // OpenRouter model id
  name: string; // human-readable name
  scans: number;
}

/** One row in the attack-success-rate table. */
export interface AttackSuccessRateRow {
  category: string;
  breached: number;
  defended: number;
  rate: number;
}

/** A point on the score-trend line chart. */
export interface ScoreTrendPoint {
  label: string;
  score: number;
}

/** Segments of the risk-distribution donut. */
export interface RiskDistributionSegment {
  level: RiskLevel;
  count: number;
}

/** Sidebar navigation item descriptor. */
export interface NavItem {
  route: DashboardRoute;
  label: string;
  href: string;
  icon: string;
}
