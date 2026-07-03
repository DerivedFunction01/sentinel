"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, Loader2 } from "lucide-react";

interface TagItem {
  id: string;
  name: string;
}

interface TagSelectedDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vocabulary: TagItem[];
  selectedScanCount: number;
  onConfirm: (tagIds: string[]) => Promise<void>;
}

export function TagSelectedDialog({
  open,
  onOpenChange,
  vocabulary,
  selectedScanCount,
  onConfirm,
}: TagSelectedDialogProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleConfirm = async () => {
    if (selectedTagIds.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(selectedTagIds);
      setSelectedTagIds([]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedTagIds([]);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dark max-w-sm border-border bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            Tag Selected Reports
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            Apply tags to {selectedScanCount} selected report
            {selectedScanCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
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
                    {tag.name}
                    {isSelected && <X className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          )}

          {selectedTagIds.length > 0 && (
            <p className="text-xs text-slate-500">
              {selectedTagIds.length} tag{selectedTagIds.length !== 1 ? "s" : ""}{" "}
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
            disabled={selectedTagIds.length === 0 || saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              `Apply (${selectedTagIds.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}