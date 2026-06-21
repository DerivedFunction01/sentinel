"use client";

import { useState, useRef } from "react";
import {
  Code,
  Plus,
  Trash2,
  Tag,
  Braces,
  Database,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Download,
  Upload,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ToolExample {
  id: string;
  name: string;
  description: string;
  tags: string; // JSON string representing array of tags
  granularity: string;
  toolJson: string;
  mockResponse: string;
  isBuiltIn: boolean;
  createdAt: string;
}

interface ToolExamplesClientProps {
  initialExamples: ToolExample[];
}

export function ToolExamplesClient({ initialExamples }: ToolExamplesClientProps) {
  const [examples, setExamples] = useState<ToolExample[]>(initialExamples);
  const [name, setName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    window.location.href = "/api/admin/tool-examples/export";
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/tool-examples/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to import catalog");
        return;
      }

      toast.success(
        `Import complete! Imported: ${data.imported}, Skipped: ${data.skipped}, Errors: ${data.errors?.length || 0}`
      );

      // Refetch examples
      const refetchRes = await fetch("/api/admin/tool-examples");
      if (refetchRes.ok) {
        const updatedExamples = await refetchRes.json();
        setExamples(updatedExamples);
      }
    } catch {
      toast.error("An error occurred during import.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  const [description, setDescription] = useState("");
  const [tagsStr, setTagsStr] = useState(""); // comma-separated
  const [granularity, setGranularity] = useState<"compact" | "detailed">("compact");
  const [toolJson, setToolJson] = useState("");
  const [mockResponse, setMockResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleStartEdit = (ex: ToolExample) => {
    setEditingId(ex.id);
    setName(ex.name);
    setDescription(ex.description);
    let tagsList: string[] = [];
    try {
      tagsList = JSON.parse(ex.tags);
    } catch {}
    setTagsStr(tagsList.join(", "));
    setGranularity(ex.granularity as any);
    setToolJson(JSON.stringify(JSON.parse(ex.toolJson), null, 2));
    setMockResponse(JSON.stringify(JSON.parse(ex.mockResponse), null, 2));
    setToolJsonError(null);
    setMockResponseError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setTagsStr("");
    setToolJson("");
    setMockResponse("");
    setToolJsonError(null);
    setMockResponseError(null);
  };

  // JSON Validation States
  const [toolJsonError, setToolJsonError] = useState<string | null>(null);
  const [mockResponseError, setMockResponseError] = useState<string | null>(null);

  const validateJson = (val: string, setError: (err: string | null) => void) => {
    if (!val.trim()) {
      setError(null);
      return false;
    }
    try {
      JSON.parse(val);
      setError(null);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isToolJsonValid = validateJson(toolJson, setToolJsonError);
    const isMockValid = validateJson(mockResponse, setMockResponseError);

    if (!name.trim() || !description.trim() || !toolJson.trim() || !mockResponse.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (!isToolJsonValid || !isMockValid) {
      toast.error("Please resolve JSON syntax errors before saving.");
      return;
    }

    setIsSubmitting(true);
    const parsedTags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      const url = "/api/admin/tool-examples";
      const method = editingId ? "PATCH" : "POST";
      const bodyPayload = {
        id: editingId || undefined,
        name,
        description,
        tags: parsedTags,
        granularity,
        toolJson,
        mockResponse,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `Failed to ${editingId ? "update" : "create"} example schema`);
        return;
      }

      if (editingId) {
        setExamples((prev) => prev.map((ex) => (ex.id === editingId ? data : ex)));
        toast.success("Example schema successfully updated!");
        setEditingId(null);
      } else {
        setExamples((prev) => [data, ...prev]);
        toast.success("Example schema successfully created!");
      }
      
      // Reset form
      setName("");
      setDescription("");
      setTagsStr("");
      setToolJson("");
      setMockResponse("");
      setToolJsonError(null);
      setMockResponseError(null);
    } catch {
      toast.error(`An error occurred while ${editingId ? "updating" : "creating"} example schema.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this example?")) return;

    try {
      const res = await fetch(`/api/admin/tool-examples?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete example schema");
        return;
      }

      setExamples((prev) => prev.filter((ex) => ex.id !== id));
      toast.success("Example schema deleted.");
    } catch {
      toast.error("An error occurred while deleting example schema.");
    }
  };

  const getParsedTags = (tagsStr: string): string[] => {
    try {
      return JSON.parse(tagsStr);
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-500" />
          Tool Schema Examples
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the central catalog of reference schemas and mock tool responses utilized by the LLM tool recommendations pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Create Example Form */}
        <div className="lg:col-span-1">
          <Card className="border-blue-500/10 bg-black/40 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                {editingId ? (
                  <Pencil className="h-4 w-4 text-blue-400" />
                ) : (
                  <Plus className="h-4 w-4 text-blue-400" />
                )}
                {editingId ? "Edit Reference Schema" : "Add Reference Schema"}
              </CardTitle>
              <CardDescription>
                {editingId
                  ? "Update the details of the reference schema dynamically."
                  : "Create a reference schema that the model can draw inspiration from when running extraction scans."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tool / Function Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. commerce_transactions"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-black/60 border-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this reference tool does..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={3}
                    className="bg-black/60 border-muted resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g. commerce, transaction, discounts"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    className="bg-black/60 border-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="granularity">Granularity</Label>
                  <Select
                    value={granularity}
                    onValueChange={(val: any) => setGranularity(val)}
                  >
                    <SelectTrigger className="bg-black/60 border-muted">
                      <SelectValue placeholder="Select granularity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toolJson" className="flex items-center gap-1.5">
                      <Code className="h-3.5 w-3.5 text-blue-400" />
                      Tool Schema JSON *
                    </Label>
                    {toolJson && (
                      <span className="text-[10px] font-semibold">
                        {toolJsonError ? (
                          <span className="text-red-400 flex items-center gap-0.5">
                            <XCircle className="h-3 w-3" /> Invalid JSON
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Valid JSON
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="toolJson"
                    placeholder={`{\n  "type": "function",\n  "function": { ... }\n}`}
                    value={toolJson}
                    onChange={(e) => {
                      setToolJson(e.target.value);
                      validateJson(e.target.value, setToolJsonError);
                    }}
                    required
                    rows={6}
                    className={`font-mono text-xs bg-black/60 resize-none ${
                      toolJsonError ? "border-red-500/50 focus-visible:ring-red-500/30" : "border-muted"
                    }`}
                  />
                  {toolJsonError && (
                    <p className="text-[11px] text-red-400 font-mono mt-1 leading-normal">
                      {toolJsonError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mockResponse" className="flex items-center gap-1.5">
                      <Braces className="h-3.5 w-3.5 text-blue-400" />
                      Mock Response JSON *
                    </Label>
                    {mockResponse && (
                      <span className="text-[10px] font-semibold">
                        {mockResponseError ? (
                          <span className="text-red-400 flex items-center gap-0.5">
                            <XCircle className="h-3 w-3" /> Invalid JSON
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Valid JSON
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="mockResponse"
                    placeholder={`{\n  "status": "denied",\n  "reason": "..."\n}`}
                    value={mockResponse}
                    onChange={(e) => {
                      setMockResponse(e.target.value);
                      validateJson(e.target.value, setMockResponseError);
                    }}
                    required
                    rows={5}
                    className={`font-mono text-xs bg-black/60 resize-none ${
                      mockResponseError ? "border-red-500/50 focus-visible:ring-red-500/30" : "border-muted"
                    }`}
                  />
                  {mockResponseError && (
                    <p className="text-[11px] text-red-400 font-mono mt-1 leading-normal">
                      {mockResponseError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    {isSubmitting
                      ? editingId
                        ? "Updating..."
                        : "Creating..."
                      : editingId
                      ? "Update Example"
                      : "Save Example Schema"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Existing Examples List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Reference Catalog ({examples.length})
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".gz,.jsonl,.jsonl.gz,application/gzip"
                className="hidden"
              />
              <Button
                variant="outline"
                type="button"
                size="sm"
                onClick={handleImportClick}
                disabled={isImporting}
                className="text-xs flex items-center gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <Upload className="h-3.5 w-3.5" />
                {isImporting ? "Importing..." : "Import Catalog"}
              </Button>
              <Button
                variant="outline"
                type="button"
                size="sm"
                onClick={handleExport}
                className="text-xs flex items-center gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Download className="h-3.5 w-3.5" />
                Export Catalog
              </Button>
            </div>
          </div>

          {examples.length === 0 ? (
            <Card className="border-muted bg-black/20">
              <CardContent className="py-16 text-center">
                <Database className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No reference tool schemas found in the database. Add one to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {examples.map((ex) => {
                const tags = getParsedTags(ex.tags);
                const isExpanded = expandedId === ex.id;
                return (
                  <Card
                    key={ex.id}
                    className={`transition-all border bg-black/30 hover:bg-black/40 ${
                      isExpanded ? "border-blue-500/30" : "border-muted"
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-foreground">
                              {ex.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                ex.granularity === "compact"
                                  ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                                  : "border-purple-500/30 bg-purple-500/10 text-purple-400"
                              }
                            >
                              {ex.granularity}
                            </Badge>
                            {ex.isBuiltIn && (
                              <Badge variant="secondary" className="text-[10px] bg-muted/65 text-muted-foreground">
                                Built-in
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {ex.description}
                          </p>

                          {tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <Tag className="h-3 w-3 text-muted-foreground mr-1" />
                              {tags.map((tag, idx) => (
                                <Badge
                                  key={`${tag}-${idx}`}
                                  variant="secondary"
                                  className="text-[11px] bg-muted/30 text-muted-foreground font-normal hover:bg-muted/40"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-2 items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                          >
                            {isExpanded ? "Hide Details" : "View Details"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 h-8 w-8"
                            onClick={() => handleStartEdit(ex)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!ex.isBuiltIn && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                              onClick={() => handleDelete(ex.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-muted grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              <Code className="h-3.5 w-3.5" /> Function Schema
                            </span>
                            <pre className="rounded-lg bg-black/60 p-3 text-[11px] font-mono text-blue-300 overflow-x-auto max-h-60 border border-muted/30">
                              {JSON.stringify(JSON.parse(ex.toolJson), null, 2)}
                            </pre>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              <Braces className="h-3.5 w-3.5" /> Mock Response
                            </span>
                            <pre className="rounded-lg bg-black/60 p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60 border border-muted/30">
                              {JSON.stringify(JSON.parse(ex.mockResponse), null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
