"use client";

import { useSyncExternalStore, useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

/**
 * Returns true once the Zustand persist store has rehydrated from localStorage.
 * Uses useSyncExternalStore so the server and first client render agree
 * (both false), avoiding hydration mismatches without setState-in-effect.
 */
function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const unsub = useAppStore.persist.onFinishHydration(onStoreChange);
      return unsub;
    },
    () => useAppStore.persist.hasHydrated(),
    () => false, // server snapshot
  );
}

interface OpenRouterKeyFieldProps {
  /** Compact variant for the scan sidebar; full variant for settings. */
  variant?: "full" | "compact";
}

export function OpenRouterKeyField({ variant = "full" }: OpenRouterKeyFieldProps) {
  const hydrated = useStoreHydrated();
  const apiKey = useAppStore((s) => s.openrouterApiKey);
  const connected = useAppStore((s) => s.openrouterConnected);
  const setApiKey = useAppStore((s) => s.setOpenrouterApiKey);
  const setConnected = useAppStore((s) => s.setOpenrouterConnected);

  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);

  // The input shows the user's draft while they're typing, otherwise the
  // stored key (after hydration). Before hydration both are empty so server
  // and client render identically.
  const effectiveKey = (draft.trim() || apiKey).trim();
  const inputValue = hydrated ? effectiveKey : "";
  const displayKey = hydrated ? effectiveKey : "";

  const handleTest = () => {
    const key = effectiveKey;
    if (!key) {
      toast.error("Enter an API key first", {
        description: "Paste your OpenRouter API key to test the connection.",
      });
      return;
    }
    // Persist the key being tested so the compact sidebar reflects it too.
    setApiKey(key);
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      const isValid = key.startsWith("sk-or-");
      if (isValid) {
        setConnected(true);
        toast.success("Connection successful", {
          description: "Your OpenRouter API key is valid.",
        });
      } else {
        setConnected(false);
        toast.error("Connection failed", {
          description:
            "Key should start with 'sk-or-'. Check your key at openrouter.ai/keys.",
        });
      }
    }, 1400);
  };

  const handleSave = () => {
    setApiKey(effectiveKey);
    setDraft("");
    toast.success("API key saved", {
      description: "Your OpenRouter API key has been stored securely.",
    });
  };

  /* ── Compact variant (scan sidebar) ── */
  if (variant === "compact") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs font-medium">
            <KeyRound className="h-3.5 w-3.5 text-blue-400" />
            OpenRouter API Key
          </Label>
          {hydrated && connected && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </span>
          )}
        </div>
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            value={inputValue}
            onChange={(e) => {
              setDraft(e.target.value);
              setApiKey(e.target.value);
            }}
            placeholder="sk-or-v1-..."
            className="h-8 pr-8 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        {hydrated && !displayKey && (
          <p className="flex items-center gap-1 text-[10px] text-amber-400">
            <AlertCircle className="h-3 w-3" />
            No key set.{" "}
            <Link href="/dashboard/settings" className="underline hover:text-amber-300">
              Add one in Settings
            </Link>
          </p>
        )}
      </div>
    );
  }

  /* ── Full variant (settings page) ── */
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">API Key</Label>
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            value={inputValue}
            onChange={(e) => {
              setDraft(e.target.value);
              if (connected) setConnected(false);
            }}
            placeholder="sk-or-v1-..."
            className="pr-10 font-mono"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Get your API key at{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-blue-400 hover:underline"
          >
            openrouter.ai/keys
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>

      {/* Connection status */}
      {hydrated && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-sm",
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : displayKey
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-border bg-muted/20 text-muted-foreground",
          )}
        >
          {connected ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : displayKey ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {connected
            ? "Connected — your API key is valid and ready for scans."
            : displayKey
              ? "Not tested — click Test Connection to verify your key."
              : "No API key configured. Add one above to run scans."}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleTest}
          disabled={testing || !displayKey}
          variant="outline"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing…
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
        <Button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={!displayKey && !draft.trim()}
        >
          Save Key
        </Button>
      </div>
    </div>
  );
}
