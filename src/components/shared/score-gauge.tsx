"use client";

import { getRiskStyle } from "@/lib/risk-utils";
import { RiskLevel } from "@/lib/enums";

interface ScoreGaugeProps {
  score: number;
  riskLevel: RiskLevel;
  size?: number;
}

export function ScoreGauge({ score, riskLevel, size = 160 }: ScoreGaugeProps) {
  const style = getRiskStyle(riskLevel);
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={style.hex}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
        <span
          className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.bgClass} ${style.textClass}`}
        >
          {style.label}
        </span>
      </div>
    </div>
  );
}
