"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ModelEntry {
  model: string;
  scans: number;
  name: string;
  defenseRate: number;
}

interface AnalyticsChartProps {
  data: ModelEntry[];
}

export function ModelAnalyticsChart({ data }: AnalyticsChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No scans yet.</p>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name,
    scans: d.scans,
    defenseRate: d.defenseRate,
  }));

  return (
    <div className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            angle={-45}
            textAnchor="end"
            height={120}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            label={{
              value: "Scans",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "rgba(255,255,255,0.3)" },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            label={{
              value: "Defense Rate %",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 10, fill: "rgba(255,255,255,0.3)" },
            }}
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
            yAxisId="left"
            dataKey="scans"
            name="Scans"
            fill="#3B82F6"
            opacity={0.85}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="defenseRate"
            name="Defense Rate"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 4, fill: "#10B981", stroke: "#0a0e1a", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}