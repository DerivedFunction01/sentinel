"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AttackEntry {
  category: string;
  breached: number;
  defended: number;
  rate: number;
}

interface AttackChartProps {
  data: AttackEntry[];
}

export function AttackSuccessChart({ data }: AttackChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No scans yet.</p>
    );
  }

  return (
    <div className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            angle={-45}
            textAnchor="end"
            height={120}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "hsl(var(--popover-foreground))" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px" }}
            verticalAlign="bottom"
            height={36}
          />
          <Bar
            dataKey="breached"
            name="Breached"
            fill="#EF4444"
            opacity={0.85}
          />
          <Bar
            dataKey="defended"
            name="Defended"
            fill="#10B981"
            opacity={0.85}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}