"use client";

import { useState } from "react";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileCode } from "lucide-react";
import { toast } from "sonner";
import { SECTIONS, SectionId } from "./scan_export_code_samples";

export function ScanExportDocs({ className = "" }: { className?: string }) {
  const [activeSection, setActiveSection] = useState<SectionId>("loading");
  const [copied, setCopied] = useState(false);

  const active = SECTIONS.find((s) => s.id === activeSection);

  const handleCopy = () => {
    if (!active) return;
    navigator.clipboard.writeText(active.code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FileCode className="h-4 w-4 text-blue-400" />
            Scan Export Format — Python Usage Guide
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="gap-2"
            disabled={!active}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="flex gap-1 flex-wrap">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeSection === section.id
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {active && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {active.description}
            </p>
            <CodeHighlight
              code={active.code}
              language="python"
              className="bg-zinc-950/60 p-3"
            />
          </div>
        )}
      </div>
    </div>
  );
}
