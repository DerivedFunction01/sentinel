"use client";

import dynamic from "next/dynamic";
import type { PlotData } from "plotly.js-dist-min";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/20 rounded" />
});

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

  const labels = data.map((d) => d.name);
  const scanCounts = data.map((d) => d.scans);
  const defenseRates = data.map((d) => d.defenseRate);

  const traces: Partial<PlotData>[] = [
    {
      type: "bar",
      name: "Scans",
      x: labels,
      y: scanCounts,
      marker: {
        color: "#3B82F6",
        opacity: 0.85,
      },
      hovertemplate: "%{x}<br>Scans: %{y}<extra></extra>",
      yaxis: "y",
    },
    {
      type: "scatter",
      mode: "lines+markers",
      name: "Defense Rate",
      x: labels,
      y: defenseRates,
      marker: { color: "#10B981", size: 8 },
      line: { color: "#10B981", width: 2 },
      hovertemplate: "%{x}<br>Defense Rate: %{y}%<extra></extra>",
      yaxis: "y2",
    },
  ];

  const layout = {
    barmode: "group",
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#A1A1AA", size: 11 },
    margin: { t: 10, r: 40, b: 120, l: 50 },
    xaxis: {
      tickangle: -45,
      tickfont: { size: 10 },
      showgrid: false,
    },
    yaxis: {
      title: { text: "Scans", font: { size: 10 } },
      showgrid: true,
      gridcolor: "rgba(255,255,255,0.06)",
      zeroline: false,
    },
    yaxis2: {
      title: { text: "Defense Rate %", font: { size: 10 } },
      overlaying: "y",
      side: "right",
      range: [0, 100],
      showgrid: false,
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
