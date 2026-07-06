import { Card } from "@/components/ui/card";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { Scan } from "@/lib/types";
import { TrialVerdict } from "@/lib/enums";

interface SummaryHeroProps {
  scan: Scan;
  vocabulary?: Array<{ id: string; name: string }>;
}

export function SummaryHero({ scan, vocabulary }: SummaryHeroProps) {
  const totalToolCalls = scan.trials.reduce(
    (sum, trial) => sum + (trial.toolCalls?.length || 0),
    0,
  );
  const numericRate = scan.totalTrials > 0 ? totalToolCalls / scan.totalTrials : 0;
  const toolCallRate = numericRate.toFixed(1);

  let hasTools = false;
  try {
    const toolsRaw = scan.tools as any;
    if (Array.isArray(toolsRaw)) {
      hasTools = toolsRaw.length > 0;
    } else if (typeof toolsRaw === "string" && toolsRaw.trim()) {
      const parsed = JSON.parse(toolsRaw);
      hasTools = Array.isArray(parsed) && parsed.length > 0;
    }
  } catch {
    // ignore
  }

  const toolTrials = scan.trials.filter(
    (t: any) => t.toolCalls && t.toolCalls.length > 0,
  );
  const noToolTrials = scan.trials.filter(
    (t: any) => !t.toolCalls || t.toolCalls.length === 0,
  );
  const toolBreached = toolTrials.filter(
    (t: any) => t.verdict === TrialVerdict.Breached,
  ).length;
  const noToolBreached = noToolTrials.filter(
    (t: any) => t.verdict === TrialVerdict.Breached,
  ).length;
  const toolDefenseRate =
    toolTrials.length > 0
      ? Math.round(((toolTrials.length - toolBreached) / toolTrials.length) * 100)
      : 0;
  const noToolDefenseRate =
    noToolTrials.length > 0
      ? Math.round(
          ((noToolTrials.length - noToolBreached) / noToolTrials.length) * 100,
        )
      : 0;

  const defendedCountVal = scan.defendedCount ?? scan.trials.filter((t: any) => t.verdict === TrialVerdict.Defended).length;
  const unknownCountVal = scan.unknownCount ?? scan.trials.filter((t: any) => t.verdict === TrialVerdict.Unknown).length;

  const stats = [
    {
      label: "Target Model",
      value: scan.modelName,
      colorType: "default",
    },
    {
      label: "Total Trials",
      value: scan.totalTrials,
      colorType: "default",
    },
    { label: "Breaches", value: scan.breaches, colorType: "default" },
    {
      label: "Breach Rate",
      value: `${scan.breachRate}%`,
      colorType: "default",
    },
    {
      label: "Defended",
      value: defendedCountVal,
      colorType: defendedCountVal > 0 ? "green" : "default",
    },
    {
      label: "Unknown",
      value: unknownCountVal,
      colorType: unknownCountVal > 0 ? "amber" : "default",
    },
    {
      label: "Tool Call Rate",
      value: `${toolCallRate}/trial`,
      colorType:
        numericRate >= 1.0 && hasTools
          ? "green"
          : totalToolCalls > 0 && scan.breaches > 0
            ? "red"
            : "default",
    },
    {
      label: "Defense Rate (w/ tools)",
      value: `${toolDefenseRate}%`,
      colorType:
        toolTrials.length === 0
          ? "default"
          : toolDefenseRate >= 80
            ? "green"
            : toolDefenseRate >= 50
              ? "amber"
              : "red",
    },
    {
      label: "Defense Rate (no tools)",
      value: `${noToolDefenseRate}%`,
      colorType:
        noToolTrials.length === 0
          ? "default"
          : noToolDefenseRate >= 80
            ? "green"
            : noToolDefenseRate >= 50
              ? "amber"
              : "red",
    },
  ];

  return (
    <section id="summary" className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <span className="h-3.5 w-3.5 rounded-full bg-blue-400/20" />
        Report · Pentest Scan
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {scan.summary}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {scan.summaryDetail}
          </p>
          {scan.tags && scan.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {scan.tags.map((tagStr: string) => {
                const parts = tagStr.split("~");
                const fallbackName = parts[1] || parts[0] || tagStr;
                const vocabEntry = vocabulary?.find((v) => v.id === parts[0]);
                const displayName = vocabEntry?.name || fallbackName;
                return (
                  <span
                    key={tagStr}
                    className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-0.5 text-[11px] font-medium text-slate-300"
                  >
                    {displayName}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6">
          <ScoreGauge score={scan.score} riskLevel={scan.riskLevel} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => {
          let cardClass = "";
          let textClass = "text-foreground";
          if (stat.colorType === "red") {
            cardClass = "border-red-500/30";
            textClass = "text-red-400";
          } else if (stat.colorType === "green") {
            cardClass = "border-emerald-500/30 bg-emerald-500/5";
            textClass = "text-emerald-400";
          } else if (stat.colorType === "amber") {
            cardClass = "border-amber-500/30 bg-amber-500/5";
            textClass = "text-amber-400";
          }

          return (
            <Card key={stat.label} className={`p-4 ${cardClass}`}>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-sm font-bold ${textClass}`}>
                {stat.value}
              </p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
