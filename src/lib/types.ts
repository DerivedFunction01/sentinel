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
  /** The specific thing synonym or variant targeted by this trial. */
  targetThing?: string;
  /** The raw seed prompt template before attack generator optimization. */
  seedTemplate?: string;
}

export interface ToolRecommendationItem {
  name: string;
  granularity: "compact" | "detailed";
  compatibilityScore: number;
  rationale: string;
  toolJson: ToolDef;
  mockResponse: unknown;
  replaces?: string;
}

export interface HardeningTrace {
  step0?: {
    query?: string;
    tags?: string[];
    retrievedExamples?: any[];
  };
  step1?: {
    promptSent?: string;
    outputPrompt?: string;
  };
  step2?: {
    promptSent?: string;
    outputPrompt?: string;
  };
  toolExtraction?: {
    promptSent?: string;
    rawOutput?: string;
  };
}

export interface ToolRecommendation {
  compatibilityScore?: number;
  rationale?: string;
  tools: ToolRecommendationItem[] | ToolDef[];
  mockToolResponses?: Record<string, unknown>;
  granularity?: "compact" | "detailed";
  extractorModel: string;
  extractorModelName: string;
}

export interface HardenedPrompt {
  id: string;
  scanId: string;
  modelId: string;
  modelName: string;
  prompt: string;
  createdAt: string;
  toolRecommendation?: ToolRecommendation | null;
  compatibilityScore?: number | null;
  granularity?: string | null;
  extractorModel?: string | null;
}

/** A complete pentest scan. */
export interface Scan {
  id: string;
  issuedDate: string;
  targetModel: string; // OpenRouter model id, e.g. "anthropic/claude-3.5-haiku"
  modelName: string; // human-readable name from the Model table
  attackerModel: string; // OpenRouter model id used for attack generation
  attackerModelName: string; // human-readable name
  judgeModel: string; // OpenRouter model id used for judging
  judgeModelName: string; // human-readable name
  hardenerModel: string; // OpenRouter model id used for prompt hardening
  hardenerModelName: string; // human-readable name
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
  hardenedPrompts: HardenedPrompt[];
  apiCost: number;
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
