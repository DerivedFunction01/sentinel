"use client";

import dynamic from "next/dynamic";
import type { PlotData } from "plotly.js-dist-min";

interface AttackEntry {
  category: string;
  breached: number;
  defended: number;
  rate: number;
}

interface AttackChartProps {
  data: AttackEntry[];
}

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/20 rounded" />
});

export function AttackSuccessChart({ data }: AttackChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No scans yet.</p>
    );
  }

  const categories = data.map((d) => d.category);
  const breached = data.map((d) => d.breached);
  const defended = data.map((d) => d.defended);

  const traces: Partial<PlotData>[] = [
    {
      type: "bar",
      name: "Breached",
      x: categories,
      y: breached,
      marker: { color: "#EF4444", opacity: 0.85 },
      hovertemplate: "%{x}<br>Breached: %{y}<extra></extra>",
    },
    {
      type: "bar",
      name: "Defended",
      x: categories,
      y: defended,
      marker: { color: "#10B981", opacity: 0.85 },
      hovertemplate: "%{x}<br>Defended: %{y}<extra></extra>",
    },
  ];

  const layout = {
    barmode: "group",
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#A1A1AA", size: 11 },
    margin: { t: 10, r: 20, b: 120, l: 50 },
    xaxis: {
      tickangle: -45,
      tickfont: { size: 10 },
      showgrid: false,
    },
    yaxis: {
      title: { text: "Count", font: { size: 10 } },
      showgrid: true,
      gridcolor: "rgba(255,255,255,0.06)",
      zeroline: false,
      tickformat: ".0f",
    },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "center",
      x: 0.5,
      font: { size: 10 },
    },
    autosize: true,
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div className="w-full h-full min-h-[220px]">
      <Plot data={traces} layout={layout} config={config} style={{ width: "100%", height: "100%" }} useResizeHandler />
    </div>
  );
}