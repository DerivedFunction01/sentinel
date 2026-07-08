"use client";

import { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Send, 
  Settings2, 
  Save, 
  Trash2, 
  Plus, 
  Sparkles, 
  Wrench, 
  Reply,
  ShieldAlert,
  Loader2,
  Undo2,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PromptSectionCard } from "@/components/shared/prompt-section-card";
import { PromptFormSectionValues } from "@/components/shared/prompt-form-section";
import { formatTokens } from "@/lib/token-formatter";
import {
  getManualConversations,
  saveManualConversation,
  deleteManualConversation
} from "@/lib/indexed-db";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  isStreaming?: boolean;
  toolCalls?: any[];
}

export default function ManualTestPage() {
  // Config state
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [promptValues, setPromptValues] = useState<PromptFormSectionValues>({
    systemPrompt: "You are a helpful assistant.",
    forbiddenTask: "",
    judgeInstructions: "",
    tools: "[]",
    mockResponses: "{}",
    allowNoToolsFallback: true,
  });

  // UI state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [userTokens, setUserTokens] = useState<number | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatName, setChatName] = useState("New Conversation");
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Assistant response choice: "ai_stream" | "mock_response" | "mock_tool_call" | "manual_write"
  const [assistantMode, setAssistantMode] = useState<"ai_stream" | "mock_response" | "mock_tool_call" | "manual_write">("ai_stream");
  const [manualResponseText, setManualResponseText] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load models & conversations
  useEffect(() => {
    fetch("/api/models")
      .then(r => r.json())
      .then(d => {
        if (d.models) setAvailableModels(d.models);
      })
      .catch(console.error);

    fetch("/api/user")
      .then(r => r.json())
      .then(d => {
        if (d.user) setUserTokens(d.user.scanTokens);
      })
      .catch(console.error);

    loadSavedConversations();
  }, []);

  // Auto-scroll chat window
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const loadSavedConversations = async () => {
    const list = await getManualConversations();
    setConversations(list);
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setChatName("New Conversation");
    setMessages([]);
  };

  const loadConversation = (c: any) => {
    setActiveConvId(c.id);
    setChatName(c.name);
    setMessages(c.messages || []);
    if (c.model) setModel(c.model);
    if (c.promptValues) setPromptValues(c.promptValues);
    toast.success(`Loaded conversation: ${c.name}`);
  };

  const saveCurrentConversation = async () => {
    const id = activeConvId || `conv-${Date.now()}`;
    const name = chatName.trim() || "Saved Chat";
    const data = {
      name,
      messages,
      model,
      promptValues,
    };
    await saveManualConversation(id, data);
    setActiveConvId(id);
    loadSavedConversations();
    toast.success("Conversation saved successfully");
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteManualConversation(id);
    if (activeConvId === id) {
      startNewConversation();
    }
    loadSavedConversations();
    toast.success("Conversation deleted");
  };

  // Run the simulation logic
  const handleSend = async () => {
    if (!inputMessage.trim() && messages.length === 0) return;
    
    // Add user message if input is not empty
    let updatedMessages = [...messages];
    if (inputMessage.trim()) {
      const userMsg: Message = { role: "user", content: inputMessage.trim() };
      updatedMessages.push(userMsg);
      setMessages(updatedMessages);
      setInputMessage("");
    }

    setLoading(true);

    try {
      // 1. Check & hold tokens
      const holdRes = await fetch("/api/manual-test/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          targetModel: model,
          systemPrompt: promptValues.systemPrompt,
          tools: promptValues.tools,
        }),
      });

      if (!holdRes.ok) {
        const err = await holdRes.json();
        throw new Error(err.error || "Failed to hold tokens");
      }

      const { holdAmount, scanTokensRemaining } = await holdRes.json();
      setUserTokens(scanTokensRemaining);

      // 2. Respond according to the selected mode
      if (assistantMode === "manual_write") {
        // Manual input response
        const text = manualResponseText.trim() || "Simulated manually input assistant response.";
        const assistantMsg: Message = { role: "assistant", content: text };
        const finalMsgs = [...updatedMessages, assistantMsg];
        setMessages(finalMsgs);
        setManualResponseText("");
        
        // Refund/finalize cost
        await finalizeTokenCost(finalMsgs, holdAmount, text);
      } 
      else if (assistantMode === "mock_response") {
        // Mock reply matching
        let mockReply = "This is a mock assistant response.";
        try {
          const mockObj = JSON.parse(promptValues.mockResponses || "{}");
          // Try exact message match or fallback
          const lastInput = updatedMessages[updatedMessages.length - 1]?.content || "";
          mockReply = mockObj[lastInput] || mockObj.default || Object.values(mockObj)[0] || mockReply;
          if (typeof mockReply === "object") {
            mockReply = JSON.stringify(mockReply);
          }
        } catch {}

        const assistantMsg: Message = { role: "assistant", content: mockReply };
        const finalMsgs = [...updatedMessages, assistantMsg];
        setMessages(finalMsgs);

        await finalizeTokenCost(finalMsgs, holdAmount, mockReply);
      } 
      else if (assistantMode === "mock_tool_call") {
        // Simulate a tool call from mock tools configuration
        let toolName = "sample_tool";
        let toolArgs = "{}";
        try {
          const toolsArray = JSON.parse(promptValues.tools || "[]");
          if (toolsArray.length > 0) {
            toolName = toolsArray[0].name || toolsArray[0].function?.name || toolName;
          }
        } catch {}

        const assistantMsg: Message = {
          role: "assistant",
          content: `Simulated tool call execution.`,
          toolCalls: [
            {
              id: `call-${Math.random().toString(36).substring(7)}`,
              type: "function",
              function: {
                name: toolName,
                arguments: toolArgs,
              }
            }
          ]
        };
        const finalMsgs = [...updatedMessages, assistantMsg];
        setMessages(finalMsgs);

        await finalizeTokenCost(finalMsgs, holdAmount, assistantMsg.content);
      } 
      else {
        // Standard AI streaming completion from OpenRouter
        const chatMsgs = [
          { role: "system", content: promptValues.systemPrompt },
          ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
        ];

        let toolsList = undefined;
        try {
          const parsed = JSON.parse(promptValues.tools);
          if (parsed && parsed.length > 0) toolsList = parsed;
        } catch {}

        const chatRes = await fetch("/api/manual-test/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: chatMsgs,
            tools: toolsList,
          }),
        });

        if (!chatRes.ok) {
          const err = await chatRes.json();
          throw new Error(err.error || "Failed to trigger AI stream");
        }

        const reader = chatRes.body?.getReader();
        if (!reader) throw new Error("No stream reader available");

        // Add dummy message to append content into
        const streamMsg: Message = { role: "assistant", content: "", isStreaming: true };
        let currentMessages = [...updatedMessages, streamMsg];
        setMessages(currentMessages);

        const decoder = new TextDecoder();
        let buffer = "";
        let responseText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith("data: ")) {
              const jsonStr = cleanLine.substring(6);
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;

                if (delta) {
                  responseText += delta;
                  currentMessages = currentMessages.map((m, idx) => 
                    idx === currentMessages.length - 1 ? { ...m, content: responseText } : m
                  );
                  setMessages(currentMessages);
                }
                if (toolCalls) {
                  // Tool call stream support
                  currentMessages = currentMessages.map((m, idx) => 
                    idx === currentMessages.length - 1 ? { ...m, toolCalls: toolCalls } : m
                  );
                  setMessages(currentMessages);
                }
              } catch (e) {}
            }
          }
        }

        // Finalize streaming state
        const finalMsgs = currentMessages.map((m, idx) => 
          idx === currentMessages.length - 1 ? { ...m, isStreaming: false } : m
        );
        setMessages(finalMsgs);

        // Finalize token cost
        await finalizeTokenCost(finalMsgs, holdAmount, responseText);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Manual interaction run failed");
    } finally {
      setLoading(false);
    }
  };

  const finalizeTokenCost = async (finalMessages: Message[], holdAmount: number, responseText: string) => {
    try {
      const refundRes = await fetch("/api/manual-test/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: finalMessages,
          targetModel: model,
          systemPrompt: promptValues.systemPrompt,
          tools: promptValues.tools,
          holdAmount,
          responseText,
        }),
      });

      if (refundRes.ok) {
        const { scanTokensRemaining, refundedAmount } = await refundRes.json();
        setUserTokens(scanTokensRemaining);
        if (refundedAmount > 0) {
          toast.success(`Refunded ${formatTokens(refundedAmount)} scan tokens.`);
        }
      }
    } catch (err) {
      console.error("Failed to refund unused tokens:", err);
    }
  };

  const handleToolResponse = (toolCallId: string, toolName: string) => {
    const rawRes = prompt("Input JSON mock response for tool " + toolName, "{}");
    if (rawRes === null) return;
    
    const toolMsg: Message = {
      role: "tool",
      name: toolName,
      tool_call_id: toolCallId,
      content: rawRes || "{}",
    };

    setMessages(prev => [...prev, toolMsg]);
  };

  const handleRemoveMessage = (idx: number) => {
    setMessages(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
      
      {/* Sidebar - Saved Chats & Model details */}
      <div className="lg:col-span-1 flex flex-col justify-between border border-white/10 bg-zinc-950/40 p-4 rounded-xl space-y-4">
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Saved Playgrounds</span>
            <Button size="icon" variant="ghost" onClick={startNewConversation} className="h-8 w-8 hover:bg-white/5">
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
                  onClick={() => loadConversation(c)}
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
                    onClick={(e) => deleteConversation(c.id, e)}
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
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Target Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Area: Chat conversation playground */}
      <div className="lg:col-span-3 flex flex-col justify-between border border-white/10 bg-zinc-950/20 rounded-xl min-h-0 overflow-hidden relative">
        
        {/* Top bar controls */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <Input
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              className="h-8 max-w-[240px] text-xs font-semibold bg-transparent border-white/5 focus:border-white/20"
              placeholder="Conversation Title"
            />
            {activeConvId && (
              <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Saved (Local)
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 gap-1.5">
                  <Settings2 className="h-3.5 w-3.5 text-blue-400" />
                  Configure Prompts & Tools
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl bg-zinc-900 border-white/10 text-white max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Playground System Configuration</DialogTitle>
                </DialogHeader>
                <PromptSectionCard
                  title="Manual Agent System Prompt"
                  description="Specify the target model rules, mock tools definition, and test parameters."
                  values={promptValues}
                  onChange={(field, val) => setPromptValues(prev => ({ ...prev, [field]: val }))}
                  onUseSample={() => {}}
                  formOptions={{
                    showCharCount: true,
                    showPrettify: true,
                    showToolManager: false
                  }}
                />
              </DialogContent>
            </Dialog>

            <Button size="sm" onClick={saveCurrentConversation} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1.5 text-white">
              <Save className="h-3.5 w-3.5" />
              Save Chat
            </Button>
          </div>
        </div>

        {/* Conversation Thread */}
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
                    onClick={() => handleRemoveMessage(idx)}
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-white/5 hover:text-red-400"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>

                <div className={`p-3 rounded-lg border text-xs max-w-[90%] whitespace-pre-wrap leading-relaxed ${
                  m.role === "system" ? "bg-blue-500/5 border-blue-500/10 text-blue-200" :
                  m.role === "user" ? "bg-amber-500/5 border-amber-500/10 text-amber-100 self-start" :
                  m.role === "assistant" ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-100 self-start" :
                  "bg-purple-500/5 border-purple-500/10 text-purple-200 self-start"
                }`}>
                  {m.content}

                  {/* Render simulated tool calls */}
                  {m.toolCalls && m.toolCalls.map((tc, tIdx) => (
                    <div key={tIdx} className="mt-3 p-2 bg-black/40 border border-white/5 rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] font-mono text-purple-400">
                          <Wrench className="h-3 w-3" />
                          <span>call: {tc.function?.name}</span>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => handleToolResponse(tc.id, tc.function?.name)}
                          className="h-5 text-[9px] px-1.5 bg-purple-600 hover:bg-purple-700 text-white gap-1"
                        >
                          <Reply className="h-2.5 w-2.5" />
                          Inject Response
                        </Button>
                      </div>
                      <pre className="text-[10px] text-muted-foreground font-mono bg-black/20 p-1.5 rounded overflow-x-auto">
                        {tc.function?.arguments}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input area & response simulation configurations */}
        <div className="p-3 border-t border-white/10 bg-zinc-950/40 space-y-3">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-2 text-[10px] font-bold text-muted-foreground">
            <span>Next Turn Mode:</span>
            {[
              { id: "ai_stream", label: "OpenRouter LLM", icon: Sparkles },
              { id: "mock_response", label: "Mock Responses Map", icon: Reply },
              { id: "mock_tool_call", label: "Simulate Tool Call", icon: Wrench },
              { id: "manual_write", label: "Manual Input", icon: Settings2 },
            ].map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAssistantMode(mode.id as any)}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                    assistantMode === mode.id 
                      ? "bg-white/10 text-white" 
                      : "hover:bg-white/5 hover:text-slate-300"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {mode.label}
                </button>
              );
            })}
          </div>

          {assistantMode === "manual_write" && (
            <div className="flex gap-2">
              <Input
                value={manualResponseText}
                onChange={(e) => setManualResponseText(e.target.value)}
                placeholder="Type manual assistant response text..."
                className="h-8 text-xs bg-zinc-900 border-white/10 focus:border-white/20"
              />
            </div>
          )}

          <div className="flex gap-2 items-center">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleSend();
              }}
              placeholder="Type your prompt query (e.g. Try to break safety guardrails)..."
              className="text-xs bg-zinc-900 border-white/10 focus:border-white/20"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </div>

      </div>

    </div>
  );
}
