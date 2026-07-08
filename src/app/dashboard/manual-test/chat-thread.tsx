"use client";

import { useEffect, useRef } from "react";
import { Sparkles, Trash2, Wrench, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  isStreaming?: boolean;
  toolCalls?: any[];
}

interface ChatThreadProps {
  messages: Message[];
  onRemoveMessage: (idx: number) => void;
  onRegenerate: () => void;
  loading: boolean;
}

export function ChatThread({ 
  messages, 
  onRemoveMessage, 
  onRegenerate, 
  loading 
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4 pr-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <Sparkles className="h-10 w-10 text-emerald-400/40 animate-pulse" />
            <h4 className="text-sm font-semibold text-slate-300">Sandbox Playground Ready</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Simulate jailbreak queries, mock outputs, and trace how system prompts react without triggering actual logs.
            </p>
          </div>
        )}
        
        {messages.map((m, idx) => (
          <div key={idx} className="group relative flex flex-col space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <div className="flex items-center gap-1.5">
                <span className={`font-semibold uppercase tracking-wider ${
                  m.role === "system" ? "text-blue-400" :
                  m.role === "user" ? "text-amber-400" :
                  m.role === "assistant" ? "text-emerald-400" : "text-purple-400"
                }`}>
                  {m.role}
                </span>
                {m.name && <span className="opacity-70">({m.name})</span>}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRemoveMessage(idx)}
                className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-white/5 hover:text-red-400"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>

            <div className={`p-3 rounded-lg border text-xs max-w-[90%] whitespace-pre-wrap leading-relaxed relative ${
              m.role === "system" ? "bg-blue-500/5 border-blue-500/10 text-blue-200" :
              m.role === "user" ? "bg-amber-500/5 border-amber-500/10 text-amber-100 self-start" :
              m.role === "assistant" ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-100 self-start" :
              "bg-purple-500/5 border-purple-500/10 text-purple-200 self-start"
            }`}>
              {m.role === "assistant" && m.content ? (
                <div className="inline">
                  <MarkdownRenderer content={m.content} />
                  {m.isStreaming && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-emerald-400 animate-pulse align-middle" />
                  )}
                </div>
              ) : (
                <div className="inline">
                  {m.content || (m.toolCalls && m.toolCalls.length > 0 ? "Initiating tool execution..." : "")}
                  {m.isStreaming && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-purple-400 animate-pulse align-middle" />
                  )}
                </div>
              )}

              {/* Render simulated tool calls */}
              {m.toolCalls && m.toolCalls.map((tc, tIdx) => (
                <div key={tIdx} className="mt-3 p-2 bg-black/40 border border-white/5 rounded-md space-y-2">
                  <div className="flex items-center gap-1 text-[10px] font-mono text-purple-400">
                    <Wrench className="h-3 w-3" />
                    <span>call: {tc.function?.name}</span>
                  </div>
                  <pre className="text-[10px] text-muted-foreground font-mono bg-black/20 p-1.5 rounded overflow-x-auto">
                    {tc.function?.arguments}
                  </pre>
                </div>
              ))}
            </div>

            {/* Regenerate Trigger */}
            {idx === messages.length - 1 && !loading && (m.role === "assistant" || m.role === "tool") && (
              <div className="flex justify-start pl-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRegenerate}
                  className="h-6 text-[10px] text-muted-foreground hover:text-emerald-400 gap-1 px-2 hover:bg-white/5"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate Response
                </Button>
              </div>
            )}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}
