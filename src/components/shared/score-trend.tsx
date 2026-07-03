"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ScoreTrendPoint } from "@/lib/types";

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No data for selected period.
      </p>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date ?? d.label,
    score: d.score,
  }));

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0">
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <YAxis
                domain={[0, 100]}
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
                formatter={(value) => [`Score: ${value.toFixed(0)}`, ""]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{
                  r: 4,
                  fill: "#3B82F6",
                  stroke: "#0a0e1a",
                  strokeWidth: 2,
                }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No data for selected period.
          </p>
        )}
      </div>
    </div>
  );
}
