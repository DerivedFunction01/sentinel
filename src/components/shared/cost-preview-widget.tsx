"use client";

import React, { useEffect, useRef, useMemo } from "react";
import {
  Coins,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Paperclip,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  getCachedCostEstimate,
  setCachedCostEstimate,
  type CostEstimateEntry,
} from "@/lib/indexed-db";

interface PrompConfigLike {
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: string;
  mockResponses: string;
  allowNoToolsFallback?: boolean;
  cachedSeedInfo?: unknown;
}

interface CostPreviewWidgetProps {
  prompts: PrompConfigLike[];
  targetModels: string[];
  attackerModel: string;
  judgeModel: string;
  hardenerModel: string;
  seedExtractorModel: string;
  extractorModel: string;
  enableHardening: boolean;
  tokens: number | null;
}

const DEBOUNCE_MS = 600;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildCacheKey(props: {
  prompts: PrompConfigLike[];
  targetModels: string[];
  attackerModel: string;
  judgeModel: string;
  hardenerModel: string;
  seedExtractorModel: string;
  extractorModel: string;
  enableHardening: boolean;
}): string {
  const parts = [
    props.targetModels.sort().join(","),
    props.attackerModel,
    props.judgeModel,
    props.hardenerModel,
    props.seedExtractorModel,
    props.extractorModel,
    props.enableHardening ? "1" : "0",
    props.prompts
      .map((p) => [
        (p.systemPrompt || "").length,
        (p.forbiddenTask || "").length,
        (p.judgeInstructions || "").length,
        (p.tools || "").length,
        (p.mockResponses || "").length,
      ])
      .join(";"),
  ];
  return `cost-estimate|${parts.join("|")}`;
}

export function CostPreviewWidget({
  prompts,
  targetModels,
  attackerModel,
  judgeModel,
  hardenerModel,
  seedExtractorModel,
  extractorModel,
  enableHardening,
  tokens,
}: CostPreviewWidgetProps) {
  const [upfrontHold, setUpfrontHold] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cacheHit, setCacheHit] = React.useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cacheKey = useMemo(
    () =>
      buildCacheKey({
        prompts,
        targetModels,
        attackerModel,
        judgeModel,
        hardenerModel,
        seedExtractorModel,
        extractorModel,
        enableHardening,
      }),
    [
      prompts,
      targetModels,
      attackerModel,
      judgeModel,
      hardenerModel,
      seedExtractorModel,
      extractorModel,
      enableHardening,
    ],
  );

  const payload = useMemo(
    () => ({
      prompts,
      targetModels,
      attackerModel,
      judgeModel,
      hardenerModel,
      seedExtractorModel,
      extractorModel,
      enableHardening,
    }),
    [
      prompts,
      targetModels,
      attackerModel,
      judgeModel,
      hardenerModel,
      seedExtractorModel,
      extractorModel,
      enableHardening,
    ],
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(null);
    setUpfrontHold(null);
    setCacheHit(false);

    timerRef.current = setTimeout(async () => {
      setLoading(true);

      try {
        const cached = await getCachedCostEstimate(cacheKey);
        const now = Date.now();
        if (cached && now - cached.timestamp < CACHE_TTL_MS) {
          setUpfrontHold(cached.upfrontHold);
          setCacheHit(true);
          setLoading(false);
          return;
        }

        const res = await fetch("/api/scan/estimate-hold", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to estimate cost.");
          setUpfrontHold(null);
        } else if (
          data.upfrontHold !== undefined &&
          data.upfrontHold !== null
        ) {
          setUpfrontHold(data.upfrontHold);
          await setCachedCostEstimate({
            key: cacheKey,
            upfrontHold: data.upfrontHold,
            timestamp: now,
          });
        }
      } catch {
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // lint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, payload]);

  const formatter = new Intl.NumberFormat("en-US");
  const tokensFormatted =
    upfrontHold !== null ? formatter.format(upfrontHold) : null;
  const usd =
    upfrontHold !== null ? (upfrontHold / 1_000_000).toFixed(2) : null;
  const totalScans = targetModels.length * prompts.length;

  const warningState = (() => {
    if (loading || upfrontHold === null || tokens === null || tokens === 0) {
      return "neutral";
    }
    if (upfrontHold > tokens) return "error";
    if (upfrontHold > tokens * 0.8) return "warning";
    return "ok";
  })();

  return (
    <Card className="border-slate-700/60 bg-slate-900/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-5 w-5 text-amber-400" />
          Cost Estimate
          {cacheHit && (
            <span className="ml-2 rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-300">
              Cached
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Pre-launch token hold estimate based on current configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Upfront Hold
              </span>
              <div className="flex items-baseline gap-3">
                {loading ? (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    Calculating
                  </span>
                ) : tokensFormatted && usd ? (
                  <>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {tokensFormatted} tokens
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (${usd} USD)
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Update configuration
                  </span>
                )}
              </div>
            </div>

            {/* Balance */}
            <div className="flex items-baseline justify-between gap-4 rounded-md bg-slate-800/60 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Your balance
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  tokens === 0
                    ? "text-red-400"
                    : tokens === null
                      ? "text-slate-400"
                      : "text-emerald-300"
                }`}
              >
                {tokens !== null
                  ? `${formatter.format(tokens)} tokens`
                  : "Loading..."}
              </span>
            </div>

            {/* Warning / Error State */}
            {!loading && upfrontHold !== null && (
              <div
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed ${
                  warningState === "error"
                    ? "border-red-500/50 bg-red-500/10 text-red-200"
                    : warningState === "warning"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {warningState === "error" && tokens !== null ? (
                  <>
                    <AlertCircle className="mt-[2px] h-4 w-4 shrink-0" />
                    <span>
                      Insufficient tokens. You need{" "}
                      <span className="font-semibold">
                        {formatter.format(upfrontHold - tokens)}
                      </span>{" "}
                      more tokens to launch this scan.
                    </span>
                  </>
                ) : warningState === "warning" && tokens !== null ? (
                  <>
                    <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
                    <span>
                      Your balance is{" "}
                      <span className="font-semibold">
                        {Math.round((1 - upfrontHold / tokens) * 100)}%
                      </span>{" "}
                      lower than the hold. Consider adding more tokens.
                    </span>
                  </>
                ) : warningState === "ok" && tokens !== null ? (
                  <>
                    <Coins className="mt-[2px] h-4 w-4 shrink-0" />
                    <span>
                      You have enough tokens to launch (
                      <span className="font-semibold">
                        {formatter.format(tokens - upfrontHold)}
                      </span>{" "}
                      will remain).
                    </span>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="space-y-2 text-xs text-muted-foreground">
            <Paperclip className="mr-1 inline h-3.5 w-3.5" />
            <p className="inline">Hold breakdown</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                {targetModels.length} model{plural(targetModels.length)}
              </li>
              <li>
                {prompts.length} prompt{plural(prompts.length)}
              </li>
              <li>
                {totalScans} scan{plural(totalScans)}
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function plural(n: number) {
  return n === 1 ? "" : "s";
}
