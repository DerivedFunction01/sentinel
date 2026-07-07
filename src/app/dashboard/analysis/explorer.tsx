"use client";

import { useRef } from "react";
import {
  Trash2,
  FileCode,
  Download,
  FolderHeart,
  Upload,
  ChevronRight,
  Grid3x3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { saveQuery, deleteSavedQuery } from "@/lib/indexed-db";
import { SCAN_FIELDS, TRIAL_FIELDS } from "./constants";

// ─── SchemaExplorer ────────────────────────────────────────────────────────────

interface SchemaExplorerProps {
  useFriendlyNames: boolean;
}

export function SchemaExplorer({ useFriendlyNames }: SchemaExplorerProps) {
  const renderField = (f: { name: string; label: string; type: string; desc: string }) => (
    <div key={f.name} className="text-xs">
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="text-slate-200 font-semibold">
          {useFriendlyNames ? f.label || f.name : f.name}
          {useFriendlyNames && (
            <span className="text-muted-foreground text-[9px] font-normal font-sans ml-1">
              ({f.name})
            </span>
          )}
        </span>
        <span className="text-slate-400 italic">({f.type})</span>
      </div>
      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
    </div>
  );

  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FileCode className="h-4 w-4 text-blue-400" />
          Schema Dictionary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
        <div>
          <h3 className="text-xs font-bold text-emerald-400 uppercase mb-2">scans Table</h3>
          <div className="space-y-2">
            {SCAN_FIELDS.filter((f: any) => !f.hidden).map(renderField)}
          </div>
        </div>
        <div className="border-t border-white/5 pt-4">
          <h3 className="text-xs font-bold text-purple-400 uppercase mb-2">trials Table</h3>
          <div className="space-y-2">
            {TRIAL_FIELDS.filter((f: any) => !f.hidden).map(renderField)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SavedViews ────────────────────────────────────────────────────────────────

interface SavedViewsProps {
  savedQueries: any[];
  loadSavedQueryDef: (saved: any) => void;
  handleDeleteQuery: (id: string) => Promise<void>;
  handleExportQueries: () => void;
  handleImportQueries: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SavedViews({
  savedQueries,
  loadSavedQueryDef,
  handleDeleteQuery,
  handleExportQueries,
  handleImportQueries,
}: SavedViewsProps) {
  // fileInputRef lives here — no need to hoist to page.tsx
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FolderHeart className="h-4 w-4 text-pink-400" />
            Saved Views
          </span>
          <div className="flex gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleExportQueries}
              title="Export Configurations"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              title="Import Configurations"
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".jsonl"
              onChange={handleImportQueries}
            />
          </div>
        </CardTitle>
        <CardDescription className="text-xs">
          Custom views saved in local IndexedDB store.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar">
        {savedQueries.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">
            No custom views saved yet.
          </p>
        ) : (
          savedQueries.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between group rounded p-1.5 hover:bg-white/5 transition-colors"
            >
              <button
                onClick={() => loadSavedQueryDef(q)}
                className="text-xs font-semibold text-slate-200 truncate flex-1 text-left flex items-center gap-1 hover:text-white"
              >
                <ChevronRight className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                {q.name}
                {q.pivotConfig && (
                  <Grid3x3
                    className="h-3 w-3 text-pink-400/70 shrink-0"
                    aria-label="Includes pivot matrix configuration"
                  />
                )}
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDeleteQuery(q.id)}
                className="h-6 w-6 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
