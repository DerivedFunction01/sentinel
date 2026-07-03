"use client";

import type { RiskDistributionSegment } from "@/lib/types";
import { getRiskStyle } from "@/lib/risk-utils";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full animate-pulse bg-muted/20 rounded-full" />
  ),
});
interface RiskDonutProps {
  data: RiskDistributionSegment[];
}

export function RiskDonut({ data }: RiskDonutProps) {
  const total = data.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const labels = data.map((s) => getRiskStyle(s.level).label);
  const counts = data.map((s) => s.count);
  const colors = data.map((s) => getRiskStyle(s.level).hex);

  const trace = {
    type: "pie",
    labels,
    values: counts,
    hole: 0.55,
    marker: { colors, line: { color: "rgba(0,0,0,0)", width: 1 } },
    textinfo: "percent",
    textfont: { size: 11, color: "#A1A1AA" },
    hovertemplate: "%{label}: %{value} scans<extra></extra>",
    showlegend: true,
  };

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#A1A1AA", size: 11 },
    margin: { t: 20, r: 20, b: 20, l: 20 },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: -0.25,
      xanchor: "center",
      x: 0.5,
      font: { size: 11 },
    },
    autosize: true,
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      <div className="relative w-full max-w-[240px] aspect-square">
        <Plot
          data={[trace]}
          layout={layout}
          config={config}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
          className="absolute inset-0"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Total Scans
          </span>
        </div>
      </div>
    </div>
  );
}
