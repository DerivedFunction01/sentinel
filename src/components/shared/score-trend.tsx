"use client";

import type { ScoreTrendPoint } from "@/lib/types";

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (data.length === 0) return null;

  const width = 480;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 36 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxScore = 100;
  const minScore = 0;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartH - ((d.score - minScore) / (maxScore - minScore)) * chartH,
    ...d,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH}` +
    ` L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y =
            padding.top + chartH - ((val - minScore) / (maxScore - minScore)) * chartH;
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-muted/20"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Area */}
        <path d={areaPath} fill="url(#scoreArea)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#0B0F1A"
              stroke="#3B82F6"
              strokeWidth="2"
            />
            <text
              x={p.x}
              y={padding.top + chartH + 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
