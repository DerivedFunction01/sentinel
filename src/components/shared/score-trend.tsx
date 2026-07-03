"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ScoreTrendPoint } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dynamically import Plotly with SSR disabled to avoid "self is not defined" error
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/20 rounded" />
});

type TimePeriod = "all" | "weekly" | "monthly" | "annually";

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  const [period, setPeriod] = useState<TimePeriod>("all");

  if (data.length === 0) return null;

  // Filter data based on selected period
  const now = new Date();
  const filteredData = data.filter((d) => {
    const scanDate = new Date(d.date);
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

  const labels = filteredData.map((d) => d.date);
  const scores = filteredData.map((d) => d.score);

  const trace = {
    type: "scatter",
    mode: "lines+markers",
    x: labels,
    y: scores,
    marker: { color: "#3B82F6", size: 7 },
    line: { color: "#3B82F6", width: 2.5, shape: "spline" },
    fill: "tozeroy",
    fillcolor: "rgba(59,130,246,0.15)",
    hovertemplate: "%{x}<br>Score: %{y}<extra></extra>",
  };

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#A1A1AA", size: 11 },
    margin: { t: 20, r: 20, b: 60, l: 50 },
    xaxis: {
      type: "date",
      tickangle: -45,
      tickfont: { size: 10 },
      showgrid: false,
      dtick: "86400000", // Show one tick per day
      tickformat: "%b %d",
    },
    yaxis: {
      range: [0, 100],
      showgrid: true,
      gridcolor: "rgba(255,255,255,0.06)",
      zeroline: false,
      tickformat: ".0f",
    },
    showlegend: false,
    autosize: true,
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

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
          <Plot data={[trace]} layout={layout} config={config} style={{ width: "100%", height: "100%" }} useResizeHandler />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No data for selected period.
          </p>
        )}
      </div>
    </div>
  );
}
