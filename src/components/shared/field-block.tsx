"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CodeHighlight } from "@/components/shared/code-highlight";

export interface FieldBlockProps {
  /** Lucide icon component to show in the header. */
  icon: React.ComponentType<{ className?: string }>;
  /** Field title shown next to the icon. */
  title: string;
  /** Optional sub-title / helper text below the title. */
  description?: string;
  /** Optional pill badge rendered after the title (e.g. "NEW"). */
  badge?: string;
  /** Controlled textarea value. */
  value: string;
  /** Called whenever the textarea content changes. */
  onChange: (v: string) => void;
  /** Textarea placeholder text. */
  placeholder: string;
  /** Tailwind min-height class, e.g. "min-h-32". */
  minHeight: string;
  /** When true, renders the Write/Preview toggle and uses monospace font. */
  monospace?: boolean;
  /** When true, shows a character count next to the title. */
  showCharCount?: boolean;
  /** When provided, a "Use sample" button is rendered. */
  onUseSample?: () => void;
}

/**
 * Reusable labeled textarea with optional syntax-highlighted preview,
 * character count, badge, description, and a "Use sample" shortcut.
 *
 * Used by both the PenTest Scan page and the Agent Deployment page.
 */
export function FieldBlock({
  icon: Icon,
  title,
  description,
  badge,
  value,
  onChange,
  placeholder,
  minHeight,
  monospace,
  showCharCount,
  onUseSample,
}: FieldBlockProps) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  // Determine syntax-highlighting language based on the block title.
  const language = title.toLowerCase().includes("json") ? "json" : "plaintext";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {/* Left side: icon + title + optional extras */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-400" />
            <Label className="text-sm font-semibold">{title}</Label>
            {badge && (
              <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                {badge}
              </span>
            )}
            {showCharCount && (
              <span className="text-xs text-muted-foreground">
                ({value.length} chars)
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {/* Right side: Write / Preview toggle (only for monospace / code fields) */}
        {monospace && (
          <div className="flex rounded-md bg-muted/65 p-0.5 border border-white/5">
            <button
              onClick={() => setTab("write")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                tab === "write"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Write
            </button>
            <button
              onClick={() => setTab("preview")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                tab === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Preview
            </button>
          </div>
        )}
      </div>

      {tab === "write" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${minHeight} max-h-80 resize-y overflow-y-auto scrollbar-thin ${
            monospace ? "font-mono text-xs" : "text-xs"
          }`}
          placeholder={placeholder}
        />
      ) : (
        <CodeHighlight
          code={value || "// No content to preview"}
          language={language}
          className={`${minHeight} max-h-80 overflow-y-auto scrollbar-thin`}
        />
      )}

      {onUseSample && tab === "write" && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onUseSample}
        >
          <Sparkles className="mr-1 h-3 w-3" />
          Use sample
        </Button>
      )}
    </div>
  );
}
