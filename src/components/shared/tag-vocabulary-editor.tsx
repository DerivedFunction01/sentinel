"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X, Plus, Loader2 } from "lucide-react";
import { setCachedUserTags } from "@/lib/indexed-db";

interface TagItem {
  id: string;
  name: string;
}

interface TagVocabularyEditorProps {
  userId?: string;
}

export function TagVocabularyEditor({ userId }: TagVocabularyEditorProps) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/user/tags");
      const data = await res.json();
      if (data.tags) {
        setTags(data.tags);
        if (userId) {
          setCachedUserTags(userId, data.tags);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const updateTags = async (updated: TagItem[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updated }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setTags(updated);
      if (userId) {
        setCachedUserTags(userId, updated);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (trimmed.length >= 25) {
      toast.error("Tag name must be under 25 characters");
      return;
    }
    if (tags.length >= 25) {
      toast.error("Maximum 25 tags allowed");
      return;
    }
    const id =
      trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20) +
      "_" +
      Math.random().toString(36).slice(2, 6);
    const updated = [...tags, { id, name: trimmed }];
    try {
      await updateTags(updated);
      setNewName("");
      toast.success("Tag added");
    } catch {
      // error shown in updateTags
    }
  };

  const handleRename = async (tag: TagItem) => {
    const newName = prompt("Rename tag:", tag.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === tag.name) return;
    if (trimmed.length >= 25) {
      toast.error("Tag name must be under 25 characters");
      return;
    }
    const updated = tags.map((t) => (t.id === tag.id ? { ...t, name: trimmed } : t));
    try {
      await updateTags(updated);
      toast.success("Tag renamed");
    } catch {
      // error shown in updateTags
    }
  };

  const handleDelete = async (tagId: string) => {
    if (!confirm("Delete this tag? Existing scans will show the fallback name.")) return;
    const updated = tags.filter((t) => t.id !== tagId);
    try {
      await updateTags(updated);
      toast.success("Tag deleted");
    } catch {
      // error shown in updateTags
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="group inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/50 pl-3 pr-1.5 py-1.5 text-xs font-medium text-slate-300"
          >
            <button
              type="button"
              onClick={() => handleRename(tag)}
              className="hover:text-white transition-colors"
              title="Rename tag"
            >
              {tag.name}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(tag.id)}
              className="rounded-full p-0.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              title="Delete tag"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {tags.length === 0 && (
          <p className="text-xs text-muted-foreground">No tags yet.</p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New tag name"
          maxLength={24}
          disabled={saving || tags.length >= 25}
          className="bg-slate-950/50 border-slate-700 text-slate-100 h-9 text-sm"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={saving || !newName.trim() || tags.length >= 25}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {tags.length} / 25 tags used. Click a tag name to rename.
      </p>
    </div>
  );
}