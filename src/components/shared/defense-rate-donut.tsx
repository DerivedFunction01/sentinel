"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface DefenseRateDonutProps {
  defended: number;
  breached: number;
  defenseRate: number;
  size?: number;
}

export function DefenseRateDonut({
  defended,
  breached,
  defenseRate,
  size = 140,
}: DefenseRateDonutProps) {
  const total = defended + breached;
  const data = [
    { name: "Defended", value: defended, color: "#34d399" },
    { name: "Breached", value: breached, color: "#f87171" },
  ];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.39}
            outerRadius={size * 0.46}
            paddingAngle={3}
            dataKey="value"
            stroke="transparent"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold text-foreground">
          {defenseRate}%
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Defended
        </span>
      </div>
    </div>
  );
}
