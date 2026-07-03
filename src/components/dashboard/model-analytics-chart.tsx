"use client";

interface ModelEntry {
  model: string;
  scans: number;
  name: string;
  totalTrials: number;
  totalBreaches: number;
  defenseRate: number;
}

interface ModelScansChartProps {
  data: ModelEntry[];
}

export function ModelScansChart({ data }: ModelScansChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No scans yet.</p>
    );
  }

  const maxScans = Math.max(...data.map((d) => d.scans), 1);

  return (
    <div className="h-full overflow-y-auto space-y-3 pr-1">
      {data.map(({ model, name, scans }) => {
        const pct = (scans / maxScans) * 100;
        return (
          <div key={model}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium truncate">{name}</span>
              <span className="text-xs text-white/40">{scans} scans</span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ModelDefenseChartProps {
  data: ModelEntry[];
}

export function ModelDefenseChart({ data }: ModelDefenseChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No scans yet.</p>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="grid grid-cols-[1fr_80px_80px_90px] gap-3 text-[10px] uppercase tracking-wider text-white/30 font-medium pb-1 border-b border-white/[0.05]">
        <span>Model</span>
        <span className="text-center">Breached</span>
        <span className="text-center">Defended</span>
        <span className="text-right">Rate</span>
      </div>
      {data.map(({ model, name, totalTrials, totalBreaches, defenseRate }) => {
        const totalDefended = totalTrials - totalBreaches;
        return (
          <div
            key={model}
            className="grid grid-cols-[1fr_80px_80px_90px] gap-3 items-center py-1.5 border-b border-white/[0.03]"
          >
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground truncate block">{name}</span>
              <span className="text-[10px] text-white/20">{totalTrials} trials</span>
            </div>
            <span className="text-xs text-red-400 text-center font-medium">{totalBreaches}</span>
            <span className="text-xs text-green-400 text-center font-medium">{totalDefended}</span>
            <div className="flex items-center justify-end gap-2">
              <div className="w-12 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${defenseRate}%` }}
                />
              </div>
              <span className="text-xs font-medium text-emerald-400">{defenseRate}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
