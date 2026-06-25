/**
 * ToolRegistry — Shared helpers for risk levels, scores, and styling.
 */
import { RiskLevel, TrialVerdict, JudgeLabel } from "@/lib/enums";

interface RiskStyle {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
  hex: string;
}

const RISK_STYLES: Record<RiskLevel, RiskStyle> = {
  [RiskLevel.Low]: {
    label: "Low Risk",
    textClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-500/10",
    borderClass: "border-emerald-200 dark:border-emerald-500/30",
    dotClass: "bg-emerald-500",
    hex: "#10B981",
  },
  [RiskLevel.Medium]: {
    label: "Medium Risk",
    textClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-500/10",
    borderClass: "border-amber-200 dark:border-amber-500/30",
    dotClass: "bg-amber-500",
    hex: "#F59E0B",
  },
  [RiskLevel.High]: {
    label: "High Risk",
    textClass: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-500/10",
    borderClass: "border-orange-200 dark:border-orange-500/30",
    dotClass: "bg-orange-500",
    hex: "#F97316",
  },
  [RiskLevel.Critical]: {
    label: "Critical Risk",
    textClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-50 dark:bg-red-500/10",
    borderClass: "border-red-200 dark:border-red-500/30",
    dotClass: "bg-red-500",
    hex: "#EF4444",
  },
  [RiskLevel.Unknown]: {
    label: "Unknown Risk",
    textClass: "text-gray-600 dark:text-gray-400",
    bgClass: "bg-gray-50 dark:bg-gray-500/10",
    borderClass: "border-gray-200 dark:border-gray-500/30",
    dotClass: "bg-gray-500",
    hex: "#9CA3AF",
  },
};

export function getRiskStyle(level: RiskLevel | string | undefined): RiskStyle {
  const l = level?.toLowerCase() as RiskLevel;
  if (!l || !RISK_STYLES[l]) {
    return RISK_STYLES[RiskLevel.Unknown];
  }
  return RISK_STYLES[l];
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return RiskLevel.Low;
  if (score >= 60) return RiskLevel.Medium;
  if (score >= 40) return RiskLevel.High;
  return RiskLevel.Critical;
}

export function getVerdictStyle(verdict: TrialVerdict) {
  if (verdict === TrialVerdict.Breached) {
    return {
      label: "Breached",
      textClass: "text-red-600 dark:text-red-400",
      bgClass: "bg-red-50 dark:bg-red-500/10",
      borderClass: "border-red-200 dark:border-red-500/30",
    };
  }
  return {
    label: "Defended",
    textClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-500/10",
    borderClass: "border-emerald-200 dark:border-emerald-500/30",
  };
}

export function getJudgeLabelStyle(label: JudgeLabel) {
  if (label === JudgeLabel.Leaked) {
    return {
      label: "LEAKED",
      textClass: "text-red-600 dark:text-red-400",
      bgClass: "bg-red-50 dark:bg-red-500/10",
      borderClass: "border-red-200 dark:border-red-500/30",
    };
  }
  return {
    label: "DEFENDED",
    textClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-500/10",
    borderClass: "border-emerald-200 dark:border-emerald-500/30",
  };
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}
