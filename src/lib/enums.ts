/**
 * SentinelPrompt — Central Enum Registry
 *
 * All categorical values live here as string enums so new additions are
 * single-line enum extensions rather than scattered string literals.
 */

/** Sidebar navigation routes inside the authenticated dashboard. */
export enum DashboardRoute {
  Overview = "overview",
  PenTestScan = "pentest-scan",
  Reports = "reports",
  Settings = "settings",
}

/** Risk classification derived from the security score. */
export enum RiskLevel {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

/** Per-trial outcome produced by the Judge LLM. */
export enum TrialVerdict {
  Breached = "breached",
  Defended = "defended",
}

/** Label the Judge assigns to its own verdict. */
export enum JudgeLabel {
  Leaked = "LEAKED",
  Defended = "DEFENDED",
}

/** Lifecycle state of a scan. */
export enum ScanStatus {
  Completed = "completed",
  Running = "running",
  Pending = "pending",
  Failed = "failed",
}

/** Filter applied to the trial-by-trial breakdown in the report view. */
export enum TrialFilter {
  All = "all",
  Breached = "breached",
  Defended = "defended",
}

/** Report section identifiers — used by the floating mini-TOC. */
export enum ReportSection {
  Summary = "summary",
  ScanConfiguration = "scan-configuration",
  TrialBreakdown = "trial-breakdown",
}

/** Landing-page section anchors — used by the header nav for smooth-scroll. */
export enum LandingSection {
  Hero = "hero",
  HowItWorks = "how-it-works",
  WhatYouGet = "what-you-get",
  Research = "research",
  Products = "products",
  CTA = "cta",
}

/**
 * User role hierarchy — drives access to admin areas.
 *
 *  USER            — regular user, sees dashboard + API integration + agent deployment
 *  CUSTOMER_ADMIN  — org-level admin, sees customer admin panel (API, users, billing, email, system)
 *  SUPER_ADMIN     — platform admin, sees the super admin panel (all token requests, all users)
 */
export enum UserRole {
  User = "USER",
  CustomerAdmin = "CUSTOMER_ADMIN",
  SuperAdmin = "SUPER_ADMIN",
}

/** Convenience: any role at or above customer admin. */
export const ADMIN_ROLES: UserRole[] = [UserRole.CustomerAdmin, UserRole.SuperAdmin];

/** Routes available to customer admins (org-level management). */
export enum CustomerAdminRoute {
  Overview = "overview",
  ApiAdmin = "api-admin",
  UserManagement = "user-management",
  BillingManagement = "billing-management",
  EmailCenter = "email-center",
  SystemManagement = "system-management",
}

/** Routes available to super admins (platform-level management). */
export enum SuperAdminRoute {
  Overview = "overview",
  TokenRequests = "token-requests",
  UserManagement = "user-management",
}

/** Routes available to regular users (beyond the core dashboard). */
export enum UserExtendedRoute {
  ApiIntegration = "api-integration",
  AgentDeployment = "agent-deployment",
}

/** Token request lifecycle. */
export enum TokenRequestStatus {
  Pending = "PENDING",
  Approved = "APPROVED",
  Denied = "DENIED",
}

/** Supported target AI models offered in the scan configuration dropdown. */
export enum TargetModel {
  Claude35Haiku = "anthropic/claude-3.5-haiku",
  Claude35Sonnet = "anthropic/claude-3.5-sonnet",
  Claude4Sonnet = "anthropic/claude-sonnet-4",
  ClaudeHaiku45 = "anthropic/claude-haiku-4.5",
  ClaudeSonnet46 = "anthropic/claude-sonnet-4.6",
  CommandA = "cohere/command-a",
  CommandRPlus = "cohere/command-r-plus",
  DeepSeekChat = "deepseek/deepseek-chat",
  DeepSeekR1 = "deepseek/deepseek-r1",
  Gemini25Flash = "google/gemini-2.5-flash",
  Gemini25Pro = "google/gemini-2.5-pro",
  GPT4o = "openai/gpt-4o",
  GPT4oMini = "openai/gpt-4o-mini",
  Llama40Scout = "meta-llama/llama-4-scout-17b-16e-instruct",
}

/** Friendly display name lookup for target models. */
export const TARGET_MODEL_LABELS: Record<TargetModel, string> = {
  [TargetModel.Claude35Haiku]: "Anthropic Claude 3.5 Haiku",
  [TargetModel.Claude35Sonnet]: "Anthropic Claude 3.5 Sonnet",
  [TargetModel.Claude4Sonnet]: "Anthropic Claude 4 Sonnet",
  [TargetModel.ClaudeHaiku45]: "Anthropic Claude Haiku 4.5",
  [TargetModel.ClaudeSonnet46]: "Anthropic Claude Sonnet 4.6",
  [TargetModel.CommandA]: "Cohere Command A",
  [TargetModel.CommandRPlus]: "Cohere Command R+",
  [TargetModel.DeepSeekChat]: "DeepSeek Chat",
  [TargetModel.DeepSeekR1]: "DeepSeek R1",
  [TargetModel.Gemini25Flash]: "Google Gemini 2.5 Flash",
  [TargetModel.Gemini25Pro]: "Google Gemini 2.5 Pro",
  [TargetModel.GPT4o]: "OpenAI GPT-4o",
  [TargetModel.GPT4oMini]: "OpenAI GPT-4o mini",
  [TargetModel.Llama40Scout]: "Meta Llama 4 Scout 17B",
};

/** Models flagged with an "AI Suggest" sub-label in the dropdown. */
export const AI_SUGGEST_MODELS: ReadonlySet<TargetModel> = new Set([
  TargetModel.DeepSeekR1,
]);
