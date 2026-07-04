"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { getRiskStyle } from "@/lib/risk-utils";
import { RiskLevel } from "@/lib/enums";

interface ScoreGaugeProps {
  score: number;
  riskLevel: RiskLevel;
  size?: number;
}

export function ScoreGauge({ score, riskLevel, size = 160 }: ScoreGaugeProps) {
  const style = getRiskStyle(riskLevel);
  const data = [
    { name: "score", value: score },
    { name: "remaining", value: 100 - score },
  ];

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size / 2 - 12}
            outerRadius={size / 2 - 2}
            paddingAngle={0}
            dataKey="value"
            stroke="transparent"
            startAngle={90}
            endAngle={-270}
          >
            <Cell key="score" fill={style.hex} />
            <Cell key="remaining" fill="currentColor" className="text-muted/20" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
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
