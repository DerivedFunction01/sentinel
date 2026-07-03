"use client";

import { useState, useEffect } from "react";
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
  onConfirm: (tagIds: string[], removeTagIds: string[]) => Promise<void>;
  editMode?: boolean;
  existingTagIds?: string[];
}

export function TagSelectedDialog({
  open,
  onOpenChange,
  vocabulary,
  selectedScanCount,
  onConfirm,
  editMode = false,
  existingTagIds = [],
}: TagSelectedDialogProps) {
  const [addingTagIds, setAddingTagIds] = useState<string[]>([]);
  const [removingTagIds, setRemovingTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setAddingTagIds([]);
      setRemovingTagIds([]);
    }
  }, [open]);

  const toggleAdding = (id: string) => {
    setAddingTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleRemoving = (id: string) => {
    setRemovingTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setAddingTagIds([]);
      setRemovingTagIds([]);
    }
    onOpenChange(v);
  };

  const handleConfirm = async () => {
    if (addingTagIds.length === 0 && removingTagIds.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(addingTagIds, removingTagIds);
      setAddingTagIds([]);
      setRemovingTagIds([]);
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const effectiveExisting = editMode
    ? existingTagIds
    : existingTagIds.filter((id) => !addingTagIds.includes(id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dark max-w-sm border-border bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <TagsIcon className="h-4 w-4" />
            {editMode
              ? "Edit Tags"
              : `Tag Selected Report${(selectedScanCount ?? 1) !== 1 ? "s" : ""}`}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            {editMode
              ? "Manage tags for this scan."
              : `Apply tags to ${selectedScanCount ?? 1} selected report${(selectedScanCount ?? 1) !== 1 ? "s" : ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {editMode && effectiveExisting.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Current Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {effectiveExisting.map((tagId) => {
                  const vocabEntry = vocabulary.find((v) => v.id === tagId);
                  const displayName = vocabEntry?.name || tagId;
                  const isRemoving = removingTagIds.includes(tagId);
                  return (
                    <button
                      key={tagId}
                      type="button"
                      onClick={() => toggleRemoving(tagId)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                        isRemoving
                          ? "border-red-400/40 bg-red-500/15 text-red-300"
                          : "border-blue-500/30 bg-blue-500/10 text-blue-200 hover:border-red-400/40 hover:text-red-300",
                      )}
                      title={isRemoving ? "Cancel removal" : "Click to remove"}
                    >
                      {displayName}
                      <X className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(editMode ? addingTagIds.length > 0 : true) && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {editMode ? "Add Tags" : "Available Tags"}
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
                    const disabled =
                      editMode && effectiveExisting.includes(tag.id);
                    const isAdding = addingTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => !disabled && toggleAdding(tag.id)}
                        disabled={disabled}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          isAdding
                            ? "border-blue-500 bg-blue-600/20 text-blue-300"
                            : disabled
                              ? "cursor-not-allowed opacity-50 border-slate-700 bg-slate-800/20 text-slate-500"
                              : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                        )}
                      >
                        {isAdding && <X className="h-3 w-3" />}
                        {disabled && !isAdding
                          ? `${tag.name} (added)`
                          : `${isAdding ? "" : "Add "}${tag.name}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {removingTagIds.length > 0 && (
            <p className="text-xs text-red-400">
              {removingTagIds.length} tag{removingTagIds.length > 1 ? "s" : ""}{" "}
              will be removed
            </p>
          )}
          {addingTagIds.length > 0 && removingTagIds.length === 0 && (
            <p className="text-xs text-slate-500">
              {addingTagIds.length} tag{addingTagIds.length > 1 ? "s" : ""}{" "}
              selected
            </p>
          )}
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
              (addingTagIds.length === 0 && removingTagIds.length === 0) ||
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
              `${addingTagIds.length > 0 || removingTagIds.length > 0 ? "Update" : "Close"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
