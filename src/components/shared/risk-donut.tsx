"use client";

import type { RiskDistributionSegment } from "@/lib/types";
import { getRiskStyle } from "@/lib/risk-utils";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface RiskDonutProps {
  data: RiskDistributionSegment[];
}

export function RiskDonut({ data }: RiskDonutProps) {
  const total = data.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const chartData = data.map((seg) => ({
    name: getRiskStyle(seg.level).label,
    value: seg.count,
    color: getRiskStyle(seg.level).hex,
  }));

  return (
    <div className="flex w-full h-full items-center justify-center gap-4">
      <div className="relative w-[160px] shrink-0">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={78}
              paddingAngle={2}
              dataKey="value"
              stroke="transparent"
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Total Scans
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-xs">
        {data.map((seg) => (
          <div key={seg.level} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: getRiskStyle(seg.level).hex }}
            />
            <span className={getRiskStyle(seg.level).textClass}>
              {getRiskStyle(seg.level).label}
            </span>
            <span className="text-muted-foreground">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}