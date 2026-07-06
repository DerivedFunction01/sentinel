/**
 * ToolRegistry — Domain Types
 */
import type {
  CredentialMode,
  DashboardRoute,
  Granularity,
  RiskLevel,
  RestrictionCategory,
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

export interface TrialTurn {
  role: "user" | "assistant" | "tool";
  content?: string;
  name?: string; // tool name if role === "tool"
  toolCalls?: ToolCall[]; // tool calls initiated by assistant in this turn
}

/** One adversarial trial in a scan. */
export interface Trial {
  number: number;
  verdict: TrialVerdict;
  attack: string;
  response: string;
  judgeLabel: TrialVerdict;
  judgeVerdict: string;
  toolCalls?: ToolCall[];
  transcript?: TrialTurn[];
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
// Type alias for backward compatibility and enriched data support
export type BreachedAttack = {
  attack: string;
  judgeReasoning: string;
  verdict: TrialVerdict;
};

 export interface RestrictionThing {
   forbiddenTask: string;
   thingName: string;
   thingDescription: string;
   thingNameVariants: string[];
   thingDescriptionVariants: string[];
   credentials: string[];
   businessScenarios: string[];
   ontologySection?: string;
   isPresent: boolean;
   /** How this restriction should be enforced */
   category: RestrictionCategory;
   /** Concrete user scenarios generated for this specific restriction/debugging */
   concreteScenarios?: string[];
   /** Tool protection detection - true if existing tools handle this restriction */
   coversRestriction?: boolean;
   /** Array of tool names that cover this restriction (if coversRestriction is true) */
   protectedByTools?: string[];
 }

export interface SeedInfo {
  things: RestrictionThing[];
  personaDescription: string;
  businessFeatures: string[];
  businessCategories: string[];
  isGenerative: boolean;
  extractorModel?: string;
  extractedAt?: string;
  relevantFiles?: string[];
  coreSystemPrompt?: string;
}

export interface AttackEntry {
  patternId: string;
  attackDescription: string;
  entropyLabel: string;
  framingLabel: string;
  attackText: string;
  targetForbiddenTask?: string;
  credentialContext?: {
    credential: string;
    instruction: CredentialMode;
  };
}

export interface AttackSet {
  seedInfo: SeedInfo;
  attacks: AttackEntry[];
}

export interface ToolRecommendationItem {
  name: string;
  granularity: Granularity;
  compatibilityScore: number;
  rationale: string;
  toolJson: ToolDef;
  mockResponse: unknown;
  businessCategories?: string[];
  replaces?: string;
}

/** Overlap information between a candidate database example and an existing tool. */
export interface OverlapInfo {
  score: number; // 0-100: degree of overlap with existing tools
  replaceExisting?: string; // tool function name to replace (if score >= 70 and replacement is preferred)
  merge?: boolean; // merge params into existing tool vs full replacement
  rationale?: string; // explanation of the overlap decision
}

export interface HardeningTrace {
  step0?: {
    query?: string;
    tags?: string[];
    retrievedExamples?: any[];
    usedBusinessCategories?: string[];
  };
  attackSummary?: {
    promptSent?: string;
    output?: string;
  };
  step1?: {
    promptSent?: string;
    outputPrompt?: string;
    changedSentencesRaw?: string;
  };
  compaction?: {
    promptSent?: string;
    outputPrompt?: string;
  };
  step2?: {
    promptSent?: string;
    outputPrompt?: string;
    skipped?: boolean;
    reason?: string;
  };
  toolExtraction?: {
    promptSent?: string;
    rawOutput?: string;
  };
  optDetector?: {
    promptSent?: string;
    output?: {
      language: string;
      optimizationPrompt: string | null;
      cleanedPrompt: string;
    };
  };
  optTranslator?: {
    promptSent?: string;
    output?: string;
  };
}

export interface ToolRecommendation {
  compatibilityScore?: number;
  rationale?: string;
  tools: ToolRecommendationItem[] | ToolDef[];
  mockToolResponses?: Record<string, unknown>;
  granularity?: Granularity;
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
  metadata?: ScanMetadata;
  tags?: string[];
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
  toolCallRate?: string;
  tags?: string[];
}

/** A single rephrased pair: original restriction → capability + mock policy. */
export interface RephrasedRestrictionPair {
  original: string;
  toolRequirement: string; // "discount policy and procedures" (user-facing capability)
  mockPolicy: string; // "Do not give discounts" (what the mock response enforces)
}
export interface ScanMetadata {
  seedExtraction?: SeedInfo;

  // Attack pattern summarization
  attackSummary?: {
    summarizedPatterns: string;
    breachedAttacks: BreachedAttack[];
    summarizedAt?: string;
  };
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
  userTags?: Array<{ id: string; name: string }>;
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
  date: string;
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
