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
  ChevronDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Granularity, BusinessCategory } from "@/lib/types";
import { Check } from "lucide-react";
import { ToolExampleCategory } from "@/lib/enums";

// ============================================================================
// TYPES
// ============================================================================

interface ToolExample {
  id: string;
  name: string;
  description: string;
  tags: string; // JSON string representing array of tags
  granularity: string;
  category: string;
  toolJson: string;
  mockResponse: string;
  isBuiltIn: boolean;
  createdAt: string;
  businessCategories?: string; // JSON string of BusinessCategory[]
}

interface ToolExamplesClientProps {
  initialExamples: ToolExample[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getParsedTags = (jsonStr: string): string[] => {
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getParsedBusinessCategories = (jsonStr?: string): BusinessCategory[] => {
  try {
    if (!jsonStr) return [];
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Display badges for tags
 */
interface TagBadgesProps {
  tags: string[];
}

const TagBadges = ({ tags }: TagBadgesProps) => {
  if (tags.length === 0) return null;

  return (
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
  );
};

/**
 * Display business category badges
 */
interface BusinessCategoryBadgesProps {
  businessCategories: BusinessCategory[];
}

const BusinessCategoryBadges = ({
  businessCategories,
}: BusinessCategoryBadgesProps) => {
  return (
    <div className="flex flex-wrap gap-1">
      {businessCategories.map((cat) => (
        <Badge
          key={cat}
          variant="secondary"
          className="bg-indigo-100 text-indigo-800"
        >
          {cat.replace(/_/g, " ")}
        </Badge>
      ))}
      {businessCategories.length === 0 && (
        <span className="text-xs text-muted-foreground">None</span>
      )}
    </div>
  );
};

/**
 * Multi-select dropdown for business categories
 */
interface BusinessCategoryMultiSelectProps {
  selectedCategories: BusinessCategory[];
  onSelectChange: (categories: BusinessCategory[]) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const BusinessCategoryMultiSelect = ({
  selectedCategories,
  onSelectChange,
  isOpen,
  onOpenChange,
}: BusinessCategoryMultiSelectProps) => {
  // Get all BusinessCategory enum values
  const allCategories = Object.values(BusinessCategory) as BusinessCategory[];

  const toggleCategory = (category: BusinessCategory) => {
    if (selectedCategories.includes(category)) {
      onSelectChange(selectedCategories.filter((c) => c !== category));
    } else {
      onSelectChange([...selectedCategories, category]);
    }
  };

  return (
    <div className="relative w-full">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={() => onOpenChange(!isOpen)}
      >
        <span className="text-sm">
          {selectedCategories.length === 0
            ? "Select categories..."
            : `${selectedCategories.length} selected`}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border border-input rounded-md shadow-md">
          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {allCategories.map((category) => (
              <button
                key={category}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded transition-colors"
                onClick={() => toggleCategory(category)}
              >
                <div
                  className={`w-4 h-4 border border-input rounded flex items-center justify-center ${
                    selectedCategories.includes(category)
                      ? "bg-blue-600 border-blue-600"
                      : ""
                  }`}
                >
                  {selectedCategories.includes(category) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <span>{category.replace(/_/g, " ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Display selected categories as badges */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedCategories.map((cat) => (
            <Badge
              key={cat}
              variant="secondary"
              className="bg-indigo-100 text-indigo-800"
            >
              {cat.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Metadata badges (Granularity, Category, Built-in)
 */
interface MetadataBadgesProps {
  example: ToolExample;
}

const MetadataBadges = ({ example }: MetadataBadgesProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-base font-bold text-foreground">
        {example.name}
      </span>
      <Badge
        variant="outline"
        className={
          example.granularity === Granularity.Compact
            ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
            : "border-purple-500/30 bg-purple-500/10 text-purple-400"
        }
      >
        {example.granularity}
      </Badge>
      <Badge
        variant="outline"
        className={
          example.category === ToolExampleCategory.Regulatory
            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
            : example.category === ToolExampleCategory.Meta
              ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        }
      >
        {example.category === ToolExampleCategory.Regulatory
          ? "regulatory ⚠"
          : (example.category ?? ToolExampleCategory.Standard)}
      </Badge>
      {example.isBuiltIn && (
        <Badge
          variant="secondary"
          className="text-[10px] bg-muted/65 text-muted-foreground"
        >
          Built-in
        </Badge>
      )}
    </div>
  );
};

/**
 * Expanded details view (Tool JSON and Mock Response)
 */
interface ExpandedDetailsProps {
  example: ToolExample;
}

const ExpandedDetails = ({ example }: ExpandedDetailsProps) => {
  return (
    <div className="mt-4 pt-4 border-t border-muted grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Code className="h-3.5 w-3.5" /> Function Schema
        </span>
        <pre className="rounded-lg bg-black/60 p-3 text-[11px] font-mono text-blue-300 overflow-x-auto max-h-60 border border-muted/30">
          {JSON.stringify(JSON.parse(example.toolJson), null, 2)}
        </pre>
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Braces className="h-3.5 w-3.5" /> Mock Response
        </span>
        <pre className="rounded-lg bg-black/60 p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60 border border-muted/30">
          {JSON.stringify(JSON.parse(example.mockResponse), null, 2)}
        </pre>
      </div>
    </div>
  );
};

/**
 * Action buttons for an example (Edit, Delete, View Details)
 */
interface ExampleActionsProps {
  example: ToolExample;
  isExpanded: boolean;
  onEdit: (example: ToolExample) => void;
  onDelete: (id: string) => void;
  onToggleDetails: () => void;
}

const ExampleActions = ({
  example,
  isExpanded,
  onEdit,
  onDelete,
  onToggleDetails,
}: ExampleActionsProps) => {
  return (
    <div className="flex shrink-0 gap-2 items-center">
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-8"
        onClick={onToggleDetails}
      >
        {isExpanded ? "Hide Details" : "View Details"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 h-8 w-8"
        onClick={() => onEdit(example)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      {!example.isBuiltIn && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
          onClick={() => onDelete(example.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

/**
 * Single example card in the list
 */
interface ExampleCardProps {
  example: ToolExample;
  isExpanded: boolean;
  onEdit: (example: ToolExample) => void;
  onDelete: (id: string) => void;
  onToggleDetails: (id: string) => void;
}

const ExampleCard = ({
  example,
  isExpanded,
  onEdit,
  onDelete,
  onToggleDetails,
}: ExampleCardProps) => {
  const tags = getParsedTags(example.tags);
  const businessCategories = getParsedBusinessCategories(
    example.businessCategories,
  );

  return (
    <Card
      className={`transition-all border bg-black/30 hover:bg-black/40 ${
        isExpanded ? "border-blue-500/30" : "border-muted"
      }`}
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Main content */}
          <div className="min-w-0 flex-1 space-y-2">
            <MetadataBadges example={example} />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {example.description}
            </p>
            <TagBadges tags={tags} />

            {/* Business categories display - THIS IS WHERE YOU ADD IT */}
            {businessCategories.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-muted-foreground block mb-2">
                  Business Categories
                </span>
                <BusinessCategoryBadges
                  businessCategories={businessCategories}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <ExampleActions
            example={example}
            isExpanded={isExpanded}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleDetails={() => onToggleDetails(example.id)}
          />
        </div>

        {isExpanded && <ExpandedDetails example={example} />}
      </CardContent>
    </Card>
  );
};

/**
 * Empty state when no examples exist
 */
const EmptyState = () => (
  <Card className="border-muted bg-black/20">
    <CardContent className="py-16 text-center">
      <Database className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        No reference tool schemas found in the database. Add one to get started.
      </p>
    </CardContent>
  </Card>
);

/**
 * Catalog header with import/export buttons
 */
interface CatalogHeaderProps {
  count: number;
  onImportClick: () => void;
  onExportClick: () => void;
  isImporting: boolean;
}

const CatalogHeader = ({
  count,
  onImportClick,
  onExportClick,
  isImporting,
}: CatalogHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        Reference Catalog ({count})
      </h2>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          type="button"
          size="sm"
          onClick={onImportClick}
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
          onClick={onExportClick}
          className="text-xs flex items-center gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
        >
          <Download className="h-3.5 w-3.5" />
          Export Catalog
        </Button>
      </div>
    </div>
  );
};

/**
 * List of all examples
 */
interface ExampleListProps {
  examples: ToolExample[];
  expandedId: string | null;
  onEdit: (example: ToolExample) => void;
  onDelete: (id: string) => void;
  onToggleDetails: (id: string) => void;
}

const ExampleList = ({
  examples,
  expandedId,
  onEdit,
  onDelete,
  onToggleDetails,
}: ExampleListProps) => {
  if (examples.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {examples.map((ex) => (
        <ExampleCard
          key={ex.id}
          example={ex}
          isExpanded={expandedId === ex.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleDetails={onToggleDetails}
        />
      ))}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ToolExamplesClient({
  initialExamples,
}: ToolExamplesClientProps) {
  const [examples, setExamples] = useState<ToolExample[]>(initialExamples);
  const [name, setName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [businessCategoriesStr, setBusinessCategoriesStr] = useState("");
  const [businessCategoriesDropdownOpen, setBusinessCategoriesDropdownOpen] =
    useState(false);

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
        `Import complete! Imported: ${data.imported}, Skipped: ${data.skipped}, Errors: ${data.errors?.length || 0}`,
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
  const [granularity, setGranularity] = useState<Granularity>(
    Granularity.Compact,
  );
  const [category, setCategory] = useState<ToolExampleCategory>(
    ToolExampleCategory.Standard,
  );
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
    setCategory((ex.category as any) || ToolExampleCategory.Standard);
    setToolJson(JSON.stringify(JSON.parse(ex.toolJson), null, 2));
    setMockResponse(JSON.stringify(JSON.parse(ex.mockResponse), null, 2));
    setToolJsonError(null);
    setMockResponseError(null);

    // Parse business categories from JSON to comma-separated format
    let catStr = "";
    if (ex.businessCategories) {
      try {
        const parsed = JSON.parse(ex.businessCategories) as BusinessCategory[];
        catStr = parsed.join(",");
      } catch {}
    }
    setBusinessCategoriesStr(catStr);
    setBusinessCategoriesDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setTagsStr("");
    setGranularity(Granularity.Compact);
    setCategory(ToolExampleCategory.Standard);
    setToolJson("");
    setMockResponse("");
    setToolJsonError(null);
    setMockResponseError(null);
    setBusinessCategoriesStr("");
    setBusinessCategoriesDropdownOpen(false);
  };

  // JSON Validation States
  const [toolJsonError, setToolJsonError] = useState<string | null>(null);
  const [mockResponseError, setMockResponseError] = useState<string | null>(
    null,
  );

  const validateJson = (
    val: string,
    setError: (err: string | null) => void,
  ) => {
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

    // Parse business categories from comma-separated string
    let businessCategories: BusinessCategory[] = [];
    if (businessCategoriesStr.trim()) {
      businessCategories = businessCategoriesStr
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0) as BusinessCategory[];

      // Validate each item is a valid BusinessCategory
      for (const cat of businessCategories) {
        if (
          !Object.values(BusinessCategory).includes(cat as BusinessCategory)
        ) {
          toast.error(`Invalid business category: ${cat}`);
          return;
        }
      }
    }

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!isToolJsonValid) {
      toast.error("Invalid Tool JSON");
      return;
    }

    if (!isMockValid) {
      toast.error("Invalid Mock Response JSON");
      return;
    }

    setIsSubmitting(true);

    try {
      const tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const body = {
        name,
        description,
        tags,
        granularity,
        category,
        toolJson: JSON.parse(toolJson),
        mockResponse: JSON.parse(mockResponse),
        businessCategories:
          businessCategories.length > 0 ? businessCategories : [],
      };

      const url = editingId
        ? `/api/admin/tool-examples/${editingId}`
        : "/api/admin/tool-examples";

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to save example");
        return;
      }

      toast.success(
        editingId
          ? "Example updated successfully"
          : "Example created successfully",
      );

      // Refetch to reflect changes
      const refetchRes = await fetch("/api/admin/tool-examples");
      if (refetchRes.ok) {
        const updatedExamples = await refetchRes.json();
        setExamples(updatedExamples);
      }

      // Reset form
      handleCancelEdit();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this example?")) return;

    try {
      const res = await fetch(`/api/admin/tool-examples/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to delete example");
        return;
      }

      toast.success("Example deleted successfully");
      setExamples((prev) => prev.filter((ex) => ex.id !== id));
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  return (
    <div className="min-h-screen p-6 bg-black text-foreground">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Tool Examples Manager</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, and manage tool examples and schemas
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form - remaining code stays the same as original */}
          <div className="lg:col-span-1">
            <Card className="border-muted bg-black/30">
              <CardHeader>
                <CardTitle className="text-base">
                  {editingId ? "Edit Example" : "New Example"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-xs">
                      Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g., Get Weather"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-xs">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Describe this tool..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tags" className="text-xs">
                      Tags (comma-separated)
                    </Label>
                    <Input
                      id="tags"
                      placeholder="e.g., weather, forecast, api"
                      value={tagsStr}
                      onChange={(e) => setTagsStr(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="granularity" className="text-xs">
                      Granularity
                    </Label>
                    <Select value={granularity} onValueChange={setGranularity}>
                      <SelectTrigger id="granularity" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(Granularity).map((gran) => (
                          <SelectItem key={gran} value={gran}>
                            {gran}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="category" className="text-xs">
                      Category
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="category" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ToolExampleCategory).map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Business Categories</Label>
                    <BusinessCategoryMultiSelect
                      selectedCategories={
                        businessCategoriesStr
                          .split(",")
                          .map((c) => c.trim())
                          .filter((c) => c.length > 0) as BusinessCategory[]
                      }
                      onSelectChange={(categories) => {
                        setBusinessCategoriesStr(categories.join(","));
                      }}
                      isOpen={businessCategoriesDropdownOpen}
                      onOpenChange={setBusinessCategoriesDropdownOpen}
                    />
                  </div>

                  <div>
                    <Label htmlFor="toolJson" className="text-xs">
                      Tool JSON Schema
                    </Label>
                    <Textarea
                      id="toolJson"
                      placeholder='{"type":"object",...}'
                      value={toolJson}
                      onChange={(e) => {
                        setToolJson(e.target.value);
                        validateJson(e.target.value, setToolJsonError);
                      }}
                      rows={6}
                      className="mt-1 text-xs font-mono"
                    />
                    {toolJsonError && (
                      <p className="text-[10px] text-red-400 mt-1">
                        {toolJsonError}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="mockResponse" className="text-xs">
                      Mock Response
                    </Label>
                    <Textarea
                      id="mockResponse"
                      placeholder="{...}"
                      value={mockResponse}
                      onChange={(e) => {
                        setMockResponse(e.target.value);
                        validateJson(e.target.value, setMockResponseError);
                      }}
                      rows={6}
                      className="mt-1 text-xs font-mono"
                    />
                    {mockResponseError && (
                      <p className="text-[10px] text-red-400 mt-1">
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

          {/* Examples List */}
          <div className="lg:col-span-2 space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".gz,.jsonl,.jsonl.gz,application/gzip"
              className="hidden"
            />

            <CatalogHeader
              count={examples.length}
              onImportClick={handleImportClick}
              onExportClick={handleExport}
              isImporting={isImporting}
            />

            <ExampleList
              examples={examples}
              expandedId={expandedId}
              onEdit={handleStartEdit}
              onDelete={handleDelete}
              onToggleDetails={setExpandedId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
