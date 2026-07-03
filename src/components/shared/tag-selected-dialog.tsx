"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, Loader2, Plus, Tags as TagsIcon } from "lucide-react";

interface TagItem {
  id: string;
  name: string;
}

interface TagSelectedDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vocabulary: TagItem[];
  selectedScanCount?: number;
  onConfirm: (addingTagIds: string[], removingTagIds: string[]) => Promise<void>;
  existingTagIdsPerScan?: string[][];
}

export function TagSelectedDialog({
  open,
  onOpenChange,
  vocabulary,
  selectedScanCount,
  onConfirm,
  existingTagIdsPerScan = [],
}: TagSelectedDialogProps) {
  const scanCount = selectedScanCount || 1;
  const tagDataPerScan = existingTagIdsPerScan;

  const fullyActiveInitially = useMemo(() => {
    if (tagDataPerScan.length === 0) return [];
    const initial = new Set(tagDataPerScan[0]);
    for (let i = 1; i < tagDataPerScan.length; i++) {
      const current = new Set(tagDataPerScan[i]);
      for (const id of [...initial]) {
        if (!current.has(id)) initial.delete(id);
      }
    }
    return Array.from(initial);
  }, [tagDataPerScan]);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTagIds(fullyActiveInitially);
    }
  }, [open, fullyActiveInitially]);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
  };

  const handleConfirm = async () => {
    const addingTagIds = selectedTagIds.filter(
      (id) => !fullyActiveInitially.includes(id),
    );
    const removingTagIds = fullyActiveInitially.filter(
      (id) => !selectedTagIds.includes(id),
    );
    if (addingTagIds.length === 0 && removingTagIds.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(addingTagIds, removingTagIds);
    } finally {
      setSaving(false);
    }
  };

  const isBulkMode = scanCount > 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dark max-w-sm border-border bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <TagsIcon className="h-4 w-4" />
            {isBulkMode
              ? "Tag Selected Reports"
              : "Edit Tags"}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            {isBulkMode
              ? `Apply or remove tags from ${scanCount} selected report${scanCount !== 1 ? "s" : ""}.`
              : "Toggle tags for this scan."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isBulkMode ? "Available Tags" : "All Tags"}
            </p>
            {vocabulary.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                No tags defined yet. Create tags in your{" "}
                <a
                  href="/dashboard/settings"
                  className="text-blue-400 hover:underline"
                >
                  settings
                </a>
                .
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {vocabulary.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        isSelected
                          ? "border-blue-500 bg-blue-600/20 text-blue-300"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                      )}
                    >
                      {isSelected && <X className="h-3 w-3" />}
                      {isSelected ? "" : "Add "}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
            className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              (selectedTagIds.length === 0 && fullyActiveInitially.length === 0) ||
              (JSON.stringify(selectedTagIds.sort()) ===
                JSON.stringify(fullyActiveInitially.sort())) ||
              saving
            }
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Update"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
