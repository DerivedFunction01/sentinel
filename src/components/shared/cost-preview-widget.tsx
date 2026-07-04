"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { Coins, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { getCachedCostEstimate, setCachedCostEstimate } from "@/lib/indexed-db";

/**
 * A single item in the cost estimation formula.
 * Mirrors the CostEstimationItem interface on the backend.
 */
export interface CostEstimationItem {
  modelId: string;
  type: "prompt" | "completion";
  /** Server will tokenize this string with tiktoken */
  text?: string;
  /** Pre-computed token count (used when text is not provided) */
  tokensCount?: number;
  /**
   * Additional pre-computed token count added on top of tokenized `text`.
   * Use for stable template overhead (system prompt templates, few-shot examples, etc.)
   */
  additionalTokens?: number;
  /** Quantity multiplier e.g. number of trials (default: 1) */
  multiplier?: number;
}

export interface CostPreviewWidgetProps {
  /** The array of pricing formula items to pass to the estimator */
  items: CostEstimationItem[];
  /** User's current scanTokens balance */
  tokens: number | null;
  /** Optional label shown in the breakdown footer (e.g. "2 models × 3 prompts") */
  label?: string;
}

const DEBOUNCE_MS = 600;
const CACHE_TTL_MS = 5 * 60 * 1000;

function buildCacheKey(items: CostEstimationItem[]): string {
  const fingerprint = items
    .map(
      (i) =>
        `${i.modelId}:${i.type}:${i.text !== undefined ? i.text.length : (i.tokensCount ?? 0)}:${i.multiplier ?? 1}`,
    )
    .join("|");
  return `cost-estimate-v2|${fingerprint}`;
}

export function CostPreviewWidget({
  items,
  tokens,
  label,
}: CostPreviewWidgetProps) {
  const [upfrontHold, setUpfrontHold] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cacheHit, setCacheHit] = React.useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cacheKey = useMemo(() => buildCacheKey(items), [items]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(null);
    setUpfrontHold(null);
    setCacheHit(false);

    if (items.length === 0) return;

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
          body: JSON.stringify({ items }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const formatter = new Intl.NumberFormat("en-US");
  const tokensFormatted =
    upfrontHold !== null ? formatter.format(upfrontHold) : null;
  const usd =
    upfrontHold !== null ? (upfrontHold / 1_000_000).toFixed(4) : null;

  const warningState = (() => {
    if (loading || upfrontHold === null || tokens === null || tokens === 0) {
      return "neutral";
    }
    if (upfrontHold > tokens) return "error";
    if (upfrontHold > tokens * 0.8) return "warning";
    return "ok";
  })();

  return (
    <Card className="border-slate-600 bg-slate-800 text-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-100">
          <Coins className="h-5 w-5 text-amber-400" />
          Cost Estimate
          {cacheHit && (
            <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-300">
              Cached
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-slate-400">
          Pre-launch token hold estimate (includes 15% safety buffer)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* Hold line */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Upfront Hold
              </span>
              <div className="flex items-baseline gap-3">
                {loading ? (
                  <span className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    Calculating…
                  </span>
                ) : tokensFormatted && usd ? (
                  <>
                    <span className="text-sm font-semibold text-white tabular-nums">
                      {tokensFormatted} tokens
                    </span>
                    <span className="text-xs text-slate-400">
                      (${usd} USD)
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-slate-400">
                    {error ? "Estimate failed" : "Update configuration"}
                  </span>
                )}
              </div>
            </div>

            {/* Balance row */}
            <div className="flex items-baseline justify-between gap-4 rounded-md bg-slate-700 px-3 py-2">
              <span className="text-xs text-slate-400">
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
                  : "Loading…"}
              </span>
            </div>

            {/* Status banner */}
            {!loading && upfrontHold !== null && (
              <div
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed ${
                  warningState === "error"
                    ? "border-red-500/60 bg-red-950 text-red-200"
                    : warningState === "warning"
                      ? "border-amber-500/50 bg-amber-950 text-amber-100"
                      : "border-emerald-500/50 bg-emerald-950 text-emerald-100"
                }`}
              >
                {warningState === "error" && tokens !== null ? (
                  <>
                    <AlertCircle className="mt-[2px] h-4 w-4 shrink-0" />
                    <span>
                      Insufficient tokens — need{" "}
                      <span className="font-semibold">
                        {formatter.format(upfrontHold - tokens)}
                      </span>{" "}
                      more to proceed.
                    </span>
                  </>
                ) : warningState === "warning" && tokens !== null ? (
                  <>
                    <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
                    <span>
                      Balance is low — only{" "}
                      <span className="font-semibold">
                        {formatter.format(tokens - upfrontHold)}
                      </span>{" "}
                      tokens will remain.
                    </span>
                  </>
                ) : warningState === "ok" && tokens !== null ? (
                  <>
                    <Coins className="mt-[2px] h-4 w-4 shrink-0" />
                    <span>
                      Sufficient balance —{" "}
                      <span className="font-semibold">
                        {formatter.format(tokens - upfrontHold)}
                      </span>{" "}
                      tokens will remain after the hold.
                    </span>
                  </>
                ) : null}
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Optional breakdown label */}
          {label && <p className="text-xs text-slate-400">{label}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
