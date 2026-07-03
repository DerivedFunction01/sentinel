"use client";

import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Sparkles,
  Trash2,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Scan } from "@/lib/types";

interface ReportHeaderProps {
  scan: Scan;
  refreshing?: boolean;
  onRefresh?: () => Promise<void>;
  onDelete?: () => void;
  isAutoReevaluating?: boolean;
  onAutoReevaluate?: () => void;
  setConvertTarget?: (target: "hardening" | "reevaluation") => void;
  setConvertOpen?: (open: boolean) => void;
  reevaluationTokens?: number | null;
  onTag?: () => void;
}

export function ReportHeader({
  scan,
  refreshing,
  onRefresh,
  onDelete,
  isAutoReevaluating,
  onAutoReevaluate,
  setConvertTarget,
  setConvertOpen,
  reevaluationTokens,
  onTag,
}: ReportHeaderProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/reports">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Reports
            </Link>
          </Button>
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              Security Insights Report
            </p>
            <p className="text-xs text-muted-foreground">
              Scan #{scan.id} · {scan.issuedDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="hidden border-amber-500/30 text-amber-400 sm:inline-flex"
          >
            CONFIDENTIAL
          </Badge>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          )}
          {onAutoReevaluate && scan.breaches > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAutoReevaluate}
              disabled={isAutoReevaluating || refreshing}
              className={cn(
                "flex items-center gap-1.5",
                scan.breachRate >= 80
                  ? "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 shadow-[0_0_8px_rgba(234,179,8,0.15)] animate-pulse"
                  : "border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800/55",
              )}
            >
              {isAutoReevaluating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Auto Re-evaluate</span>
            </Button>
          )}
          {onAutoReevaluate &&
            scan.breaches > 0 &&
            setConvertTarget &&
            setConvertOpen && (
              <button
                type="button"
                onClick={() => {
                  setConvertTarget("reevaluation");
                  setConvertOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-600/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/20 transition-colors"
                title="Convert scan tokens to re-evaluation tokens"
              >
                <Sparkles className="h-3 w-3" />
                {reevaluationTokens === null ? "…" : reevaluationTokens} re-eval
              </button>
            )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-950/20"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          {onTag && (
            <Button
              variant="outline"
              size="sm"
              onClick={onTag}
              className="border-blue-500/30 text-blue-400 hover:text-blue-300 hover:bg-blue-950/20"
            >
              <Tags className="mr-1.5 h-3.5 w-3.5" />
              Tags
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
