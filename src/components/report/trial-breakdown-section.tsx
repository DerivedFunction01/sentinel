import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrialCard } from "@/components/shared/trial-card";
import { TrialFilter } from "@/lib/enums";
import { Scan, Trial } from "@/lib/types";

interface TrialBreakdownSectionProps {
  scan: Scan;
  breachedCount: number;
  defendedCount: number;
  filter: TrialFilter;
  onFilterChange: (filter: TrialFilter) => void;
  filteredTrials: Trial[];
  onRefresh?: () => Promise<void>;
}

export function TrialBreakdownSection({
  scan,
  breachedCount,
  defendedCount,
  filter,
  onFilterChange,
  filteredTrials,
  onRefresh,
}: TrialBreakdownSectionProps) {
  return (
    <section id="trial-breakdown" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            03 — Trial-by-Trial Breakdown
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {scan.totalTrials} Trials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {breachedCount} Breached
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {defendedCount} Defended
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {Object.values(TrialFilter).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className={
              filter === f
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            }
            onClick={() => onFilterChange(f)}
          >
            {f === TrialFilter.All
              ? `All (${scan.totalTrials})`
              : f === TrialFilter.Breached
                ? `Breached (${breachedCount})`
                : `Defended (${defendedCount})`}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredTrials.map((trial) => (
          <TrialCard
            key={trial.number}
            trial={trial}
            scan={scan}
            onRefresh={onRefresh}
          />
        ))}
      </div>

      {filteredTrials.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No trials match this filter.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
