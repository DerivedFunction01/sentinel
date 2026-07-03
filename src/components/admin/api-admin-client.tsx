"use client";

import { useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Loader2,
  CheckCircle2,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SdkDocs } from "@/components/shared/sdk_docs/sdk-docs";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ApiAdminClientProps {
  initialKeys: ApiKeyRow[];
}

export function ApiAdminClient({ initialKeys }: ApiAdminClientProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Enter a name for the API key");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create key");
        return;
      }
      setKeys([data.key, ...keys]);
      setNewKey(data.plainKey);
      setNewKeyName("");
      toast.success("API key created", {
        description: "Copy it now — you won't see it again.",
      });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete key");
        return;
      }
      setKeys(keys.filter((k) => k.id !== id));
      toast.success("API key revoked");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(null);
    }
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          API Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate API keys for programmatic access to the ToolRegistry scan
          API.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Create new key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-blue-400" />
              Create New API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Key Name</Label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. CI Pipeline, Production Scanner"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Generate Key
            </Button>
          </CardContent>
        </Card>

        {/* Existing keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Existing API Keys ({keys.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No API keys yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm truncate">
                          {key.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] text-muted-foreground"
                        >
                          {key.keyPrefix}…
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt &&
                          ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-500 h-8 w-8 p-0"
                      onClick={() => handleDelete(key.id)}
                      disabled={deleting === key.id}
                    >
                      {deleting === key.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New key display (one-time) */}
      {newKey && (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              API Key Created — Copy Now
            </CardTitle>
            <CardDescription>
              This is the only time you'll see the full key. Store it
              securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-muted/30 p-3 font-mono text-sm text-foreground">
                {newKey}
              </code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setNewKey(null)}>
              I've saved it
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Programmatic SDK Docs */}
      <SdkDocs
        apiKey={newKey || (keys.length > 0 ? `${keys[0].keyPrefix}...` : "")}
      />
    </div>
  );
}
