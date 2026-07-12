/**
 *  Central Enum Registry
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
  Breached = "BREACHED",
  Defended = "DEFENDED",
  Unknown = "UNKNOWN",
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
export enum ProgressStepStatus {
  Completed = "completed",
  Running = "running",
  Pending = "pending",
  Failed = "failed",
  Unknown = "unknown",
}

/** Filter applied to the trial-by-trial breakdown in the report view. */
export enum TrialFilter {
  All = "all",
  Breached = "breached",
  Defended = "defended",
  Unknown = "unknown",
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
      const lowerWord = word.toLowerCase();
      if (lowerWord === "openai") return "OpenAI";
      if (lowerWord === "gpt") return "GPT";
      if (lowerWord === "ai") return "AI";
      // Fixes "mistralai" -> "Mistral AI"
      if (lowerWord === "mistralai") return "Mistral AI";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  const formattedModel = modelName
    .split("-")
    .map((word) => {
      const lowerWord = word.toLowerCase();
      if (lowerWord === "gpt") return "GPT";
      if (lowerWord === "llm") return "LLM";
      if (lowerWord === "ai") return "AI";

      // Dynamic fix: If a word ends with "ai" but isn't JUST "ai" (e.g., "mistralai")
      if (lowerWord.endsWith("ai") && lowerWord.length > 2) {
        const base = lowerWord.slice(0, -2);
        return base.charAt(0).toUpperCase() + base.slice(1) + " AI";
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  return provider ? `${formattedProvider} ${formattedModel}` : formattedModel;
}

export enum Granularity {
  Compact = "compact",
  Detailed = "detailed",
}

export enum CredentialMode {
  FICTIONAL = "fictional",
  EXACT = "exact",
  NULL = "null",
}

/**
 * Restriction category — classifies the nature of a restriction for downstream
 * enforcement decisions. The seed extractor outputs one of these three values
 * directly (no separate LLM call needed).
 *
 *   dynamic_policy  — Business-specific rule that varies per firm (pricing,
 *                     transactions, vertical services). → tool-gated enforcement.
 *   out_of_scope    — The restricted asset/service doesn't belong in this
 *                     business model (e.g., a grocery store refusing medical
 *                     advice). → conversational hard refusal, no tools.
 *   strict_refusal  — Absolute invariant hazards applying to ALL deployments
 *                     across ALL domains (PII leakage, system prompt extraction).
 *                     → conversational hard refusal, no tools.
 */
export enum RestrictionCategory {
  DYNAMIC_POLICY = "dynamic_policy",
  OUT_OF_SCOPE = "out_of_scope",
  STRICT_REFUSAL = "strict_refusal",
}

/**
 * @deprecated Use RestrictionCategory instead. This enum is kept temporarily
 * for backward compatibility during migration.
 */
export enum RestrictionBehavior {
  HARD_REFUSAL = "hard_refusal",
  HARD_REDIRECT = "hard_redirect",
  TOOL_GATED_REFUSAL = "tool_gated_refusal",
  TOOL_HANDOFF = "tool_handoff",
  COMPLEX_PIPELINE = "complex_pipeline",
  DISCLAIMER_APPEND = "disclaimer_append",
  ALLOWED_BOUNDARIES = "allowed_boundaries",
}