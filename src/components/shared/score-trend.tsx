"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type TimePeriod = "all" | "weekly" | "monthly" | "annually";

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  const [period, setPeriod] = useState<TimePeriod>("all");

  if (data.length === 0) return null;

  const now = new Date();
  const filteredData = data.filter((d) => {
    const scanDate = new Date(d.date);
    const validDate = !isNaN(scanDate.getTime());
    switch (period) {
      case "weekly":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return scanDate >= weekAgo;
      case "monthly":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return scanDate >= monthAgo;
      case "annually":
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return scanDate >= yearAgo;
      default:
        return true;
    }
  });

  const chartData = filteredData.map((d) => ({
    date: d.date ?? d.label,
    score: d.score,
  }));

  return (
    <div className="w-full h-full flex flex-col">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as TimePeriod)} className="mb-2">
        <TabsList className="h-7 p-0.5 bg-muted/65 border border-white/5">
          <TabsTrigger value="all" className="text-[10px] px-2 py-1">All</TabsTrigger>
          <TabsTrigger value="weekly" className="text-[10px] px-2 py-1">Weekly</TabsTrigger>
          <TabsTrigger value="monthly" className="text-[10px] px-2 py-1">Monthly</TabsTrigger>
          <TabsTrigger value="annually" className="text-[10px] px-2 py-1">Annually</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex-1 min-h-0">
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
                formatter={(value: number) => [`Score: ${value.toFixed(0)}`, ""]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#3B82F6", stroke: "#0a0e1a", strokeWidth: 2 }}
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