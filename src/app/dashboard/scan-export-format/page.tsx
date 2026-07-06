import { ScanExportDocs } from "@/components/shared/scan-export-docs";

export default function ScanExportFormatPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Scan Export Format Guide
        </h1>
        <p className="text-sm text-muted-foreground">
          Python snippets for loading, parsing, and analyzing ToolRegistry scan
          exports (JSONL.gz).
        </p>
      </div>
      <ScanExportDocs />
    </div>
  );
}
