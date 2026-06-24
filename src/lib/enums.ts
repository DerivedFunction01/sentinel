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
  Unknown = "unknown",
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
  CompletedWithFailures = "completed_with_failures",
  PartialFailure = "partial_failure",
  Unknown = "unknown",
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
export const ADMIN_ROLES: UserRole[] = [
  UserRole.CustomerAdmin,
  UserRole.SuperAdmin,
];

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
  ToolExamples = "tool-examples",
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

/**
 * Tool example category — determines the primary use-case context.
 *   standard    — general-purpose tools for everyday operations
 *   regulatory  — high-stakes tools with compliance or legal implications
 *   meta        — tools that govern agent behaviour itself (clarify, connect_agent, etc.)
 */
export enum ToolExampleCategory {
  Standard = "standard",
  Regulatory = "regulatory",
  Meta = "meta",
}

/** Format OpenRouter model id to a friendly name dynamically */
export function formatModelName(modelId: string): string {
  if (!modelId) return "";
  const parts = modelId.split("/");
  const provider = parts[0] || "";
  const modelName = parts[1] || parts[0];

  const formattedProvider = provider
    .split("-")
    .map((word) => {
      if (word.toLowerCase() === "openai") return "OpenAI";
      if (word.toLowerCase() === "gpt") return "GPT";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  const formattedModel = modelName
    .split("-")
    .map((word) => {
      if (word.toLowerCase() === "gpt") return "GPT";
      if (word.toLowerCase() === "llm") return "LLM";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  return provider ? `${formattedProvider} ${formattedModel}` : formattedModel;
}
export enum BusinessCategory {
  GENERAL = "GENERAL",
  BUSINESS_UNIVERSAL = "BUSINESS_UNIVERSAL",
  RETAIL_HOSPITALITY_RESTAURANT = "RETAIL_HOSPITALITY_RESTAURANT",
  LAW_FIRM = "LAW_FIRM",
  BANKING_FINANCE = "BANKING_FINANCE",
  MEDICAL_HOSPITAL = "MEDICAL_HOSPITAL",
  ACCOUNTING_FIRM = "ACCOUNTING_FIRM",
  CYBER_FIRM = "CYBER_FIRM",
  CIVICS_VOTING = "CIVICS_VOTING",
  PRIVACY = "PRIVACY",
}
export enum Granularity {
  Compact = "compact",
  Detailed = "detailed",
}
