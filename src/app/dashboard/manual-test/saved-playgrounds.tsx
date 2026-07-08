"use client";

import { MessageSquare, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSelector } from "@/components/shared/model-selector";
import { ModelSelectorRole } from "@/lib/model-utils";
import { formatTokens } from "@/lib/token-formatter";

interface SavedPlaygroundsProps {
  conversations: any[];
  activeConvId: string | null;
  onLoadConversation: (c: any) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onStartNewConversation: () => void;
  userTokens: number | null;
  model: string;
  onModelChange: (modelId: string) => void;
}

export function SavedPlaygrounds({
  conversations,
  activeConvId,
  onLoadConversation,
  onDeleteConversation,
  onStartNewConversation,
  userTokens,
  model,
  onModelChange
}: SavedPlaygroundsProps) {
  return (
    <div className="flex flex-col justify-between border border-white/10 bg-zinc-950/40 p-4 rounded-xl space-y-4 h-full">
      <div className="space-y-4 flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Saved Playgrounds</span>
          <Button size="icon" variant="ghost" onClick={onStartNewConversation} className="h-8 w-8 hover:bg-white/5">
            <Plus className="h-4 w-4 text-emerald-400" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-2">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-6">No saved test chats</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => onLoadConversation(c)}
                className={`flex justify-between items-center p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  activeConvId === c.id 
                    ? "border-emerald-500 bg-emerald-500/10 text-white" 
                    : "border-white/5 hover:border-white/10 bg-zinc-900/40 text-slate-300 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{c.name}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
                  onClick={(e) => onDeleteConversation(c.id, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-3 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Token Balance:</span>
          <span className="font-semibold text-amber-400">
            {userTokens !== null ? formatTokens(userTokens) : "Loading..."}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Target Model</span>
          <ModelSelector
            value={model}
            onChange={onModelChange}
            role={ModelSelectorRole.Target}
          />
        </div>
      </div>
    </div>
  );
}
