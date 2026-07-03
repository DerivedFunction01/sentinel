# Replace Dashboard Static Charts with Interactive PlotlyJS Charts

Replace the dashboard overview's static SVG charts with interactive PlotlyJS charts.
- Risk Distribution donut → Plotly donut
- Score Trend line → Plotly line chart
- Model Usage tab → single Plotly dual-axis chart (bars = scan count, line = defense rate %)
- Remove Attack Success tab entirely

## User Review Required

None — all data is already available in `computeDashboardStats` and `ScanSummary`.

## Proposed Changes

### Dependencies
#### [MODIFY] [package.json](file:///home/denny/lu/sent2/package.json)
Add `react-plotly.js` and `plotly.js-dist-min` as dependencies.

### Data layer
#### [MODIFY] [scan-db.ts](file:///home/denny/lu/sent2/src/lib/scan-db.ts)
Enrich each model usage entry with `defenseRate: number` computed from existing `scans`, `breaches`, and `totalTrials` fields in `computeDashboardStats`.

### Chart components
#### [MODIFY] [risk-donut.tsx](file:///home/denny/lu/sent2/src/components/shared/risk-donut.tsx)
Replace SVG donut with `Plotly` donut chart using `data` and existing risk color mappings.

#### [MODIFY] [score-trend.tsx](file:///home/denny/lu/sent2/src/components/shared/score-trend.tsx)
Replace SVG line chart with `Plotly` line chart with hover tooltips showing scan label and score.

### Dashboard page
#### [MODIFY] [page.tsx](file:///home/denny/lu/sent2/src/app/dashboard/page.tsx)
Replace the `analytics()` helper:
- Remove `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` usage
- Replace both tabs with a single Plotly dual-axis chart component
- Pass `stats.modelUsage` (which now includes `defenseRate`) to the chart
- Bar axis → scan count per model
- Line axis → defense rate % per model

Remove attack success table rendering and related type imports.

## Verification Plan

- Run `npm install` to confirm Plotly dependencies install cleanly.
- Start the dev server and navigate to `/dashboard`:
  - Donut chart renders with risk distribution segments and total count
  - Score trend shows interactive hover tooltips per point
  - Analytics card shows a single dual-axis chart with bars (scan count) and line (defense rate %), ordered left-to-right by scan count desc
  - No tabs or Attack Success table remain
- Verify mobile layout remains usable (cards stack, charts resize).
