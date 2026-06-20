"use client";

import { getRiskStyle } from "@/lib/risk-utils";
import type { RiskDistributionSegment } from "@/lib/types";

interface RiskDonutProps {
  data: RiskDistributionSegment[];
}

export function RiskDonut({ data }: RiskDonutProps) {
  const total = data.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const radius = 70;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  // Functional accumulation — no mutation after render
  const { segments } = data.reduce(
    (acc, seg) => {
      const fraction = seg.count / total;
      const dash = fraction * circumference;
      const segment = {
        level: seg.level,
        count: seg.count,
        style: getRiskStyle(seg.level),
        dash,
        gap: circumference - dash,
        offset: -acc.cumulative,
      };
      return {
        cumulative: acc.cumulative + dash,
        segments: [...acc.segments, segment],
      };
    },
    { cumulative: 0, segments: [] as Array<ReturnType<typeof getRiskStyle> & { count: number; dash: number; gap: number; offset: number }> },
  );

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full -rotate-90"
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={seg.style.hex}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground">total scans</span>
        </div>
      </div>
      <div className="space-y-3">
        {segments.map((seg) => (
          <div key={seg.level} className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: seg.style.hex }}
            />
            <span className={`text-sm font-medium ${seg.style.textClass}`}>
              {seg.style.label}
            </span>
            <span className="text-sm text-muted-foreground">
              {seg.count} scan{seg.count !== 1 ? "s" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
