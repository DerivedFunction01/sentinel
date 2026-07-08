"use client";

import { useState, useEffect } from "react";
import { Send, Save, Loader2, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PromptFormSectionValues } from "@/components/shared/prompt-form-section";
import { formatTokens } from "@/lib/token-formatter";
import {
  getManualConversations,
  saveManualConversation,
  deleteManualConversation,
} from "@/lib/indexed-db";
import { ModelSelector } from "@/components/shared/model-selector";
import {
  ModelSelectorRole,
  findDefaultModel,
  getMostUsedModelForRole,
} from "@/lib/model-utils";

// Sibling imports
import { SavedPlaygrounds } from "./saved-playgrounds";
import { ChatThread } from "./chat-thread";
import { ConfigDialog } from "./config-dialog";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  isStreaming?: boolean;
  toolCalls?: any[];
}

export default function ManualTestPage() {
  const DEFAULT_CONFIG: PromptFormSectionValues = {
    systemPrompt: "You are a helpful assistant.",
    forbiddenTask: "",
    judgeInstructions: "",
    tools: "[]",
    mockResponses: "{}",
    allowNoToolsFallback: true,
  };

  // Config state
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [globalValues, setGlobalValues] = useState<PromptFormSectionValues>(DEFAULT_CONFIG);
  const [promptValues, setPromptValues] = useState<PromptFormSectionValues>(DEFAULT_CONFIG);

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

  // Load user details & conversations
  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUserTokens(d.user.scanTokens);
      })
      .catch(console.error);

    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.models && d.models.length > 0) {
          const fallbackModelId = findDefaultModel(d.models);
          const cachedModel = getMostUsedModelForRole(
            ModelSelectorRole.Target,
            fallbackModelId,
          );
          setModel(cachedModel);
        }
      })
      .catch(console.error);

    // Load global values from localStorage
    try {
      const stored = localStorage.getItem("manual-test-global-config");
      if (stored) {
        const parsed = JSON.parse(stored);
        setGlobalValues(parsed);
        setPromptValues(parsed);
      }
    } catch (e) {
      console.error("Failed to load global config:", e);
    }

    loadSavedConversations();
  }, []);

  const handleGlobalValuesChange = (newValues: PromptFormSectionValues) => {
    setGlobalValues(newValues);
    try {
      localStorage.setItem("manual-test-global-config", JSON.stringify(newValues));
    } catch (e) {
      console.error("Failed to save global config:", e);
    }
  };

  const loadSavedConversations = async () => {
    const list = await getManualConversations();
    setConversations(list);
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setChatName("New Conversation");
    setMessages([]);
    setPromptValues(globalValues);
  };

  const loadConversation = (c: any) => {
    setActiveConvId(c.id);
    setChatName(c.name);
    setMessages(c.messages || []);
    if (c.model) setModel(c.model);
    if (c.promptValues) setPromptValues(c.promptValues);
    toast.success(`Loaded conversation: ${c.name}`);
  };

  // Auto-save conversation to IndexedDB when it changes
  useEffect(() => {
    if (messages.length === 0 || loading) return;

    const performAutoSave = async () => {
      const id = activeConvId || `conv-${Date.now()}`;
      
      // Determine the name: if it's default "New Conversation", name it after the first user prompt
      let name = chatName;
      if (name === "New Conversation" || name.trim() === "") {
        const firstUserMsg = messages.find(m => m.role === "user");
        if (firstUserMsg && firstUserMsg.content) {
          const truncated = firstUserMsg.content.slice(0, 30).trim();
          name = truncated + (firstUserMsg.content.length > 30 ? "..." : "");
          setChatName(name);
        } else {
          name = "Playground Chat";
        }
      }

      const data = {
        name,
        messages,
        model,
        promptValues,
      };

      await saveManualConversation(id, data);
      if (!activeConvId) {
        setActiveConvId(id);
      }
      loadSavedConversations();
    };

    // Debounce save action
    const timer = setTimeout(performAutoSave, 500);
    return () => clearTimeout(timer);
  }, [messages, model, promptValues, chatName, activeConvId, loading]);

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

    await runAssistantTurn(updatedMessages);
  };

  const runAssistantTurn = async (currentMsgs: Message[]) => {
    setLoading(true);

    try {
      // 1. Check & hold tokens
      const holdRes = await fetch("/api/manual-test/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMsgs,
          targetModel: model,
          systemPrompt: promptValues.systemPrompt,
          tools: promptValues.tools,
          mockResponses: promptValues.mockResponses,
        }),
      });

      if (!holdRes.ok) {
        const err = await holdRes.json();
        throw new Error(err.error || "Failed to hold tokens");
      }

      const { holdAmount, scanTokensRemaining } = await holdRes.json();
      setUserTokens(scanTokensRemaining);

      // Get clean messages for the API
      const chatMsgs = [
        { role: "system", content: promptValues.systemPrompt },
        ...currentMsgs.map((m) => ({
          role: m.role,
          content: m.content,
          name: m.name,
          tool_call_id: m.tool_call_id,
          tool_calls: m.toolCalls,
        })),
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
      const streamMsg: Message = {
        role: "assistant",
        content: "",
        isStreaming: true,
      };
      let newMessages = [...currentMsgs, streamMsg];
      setMessages(newMessages);

      const decoder = new TextDecoder();
      let buffer = "";
      let responseText = "";
      let accumulatedToolCalls: any[] = [];

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
                newMessages = newMessages.map((m, idx) =>
                  idx === newMessages.length - 1
                    ? { ...m, content: responseText }
                    : m,
                );
                setMessages(newMessages);
              }
              if (toolCalls) {
                // Merge/accumulate tool calls
                for (const tc of toolCalls) {
                  const existingIdx = accumulatedToolCalls.findIndex(
                    (item) => item.index === tc.index,
                  );
                  if (existingIdx > -1) {
                    const existing = accumulatedToolCalls[existingIdx];
                    if (tc.function?.arguments) {
                      existing.function.arguments += tc.function.arguments;
                    }
                  } else {
                    accumulatedToolCalls.push(tc);
                  }
                }
                newMessages = newMessages.map((m, idx) =>
                  idx === newMessages.length - 1
                    ? { ...m, toolCalls: accumulatedToolCalls }
                    : m,
                );
                setMessages(newMessages);
              }
            } catch (e) {}
          }
        }
      }

      // Finalize streaming state
      const finalAssistantMsg = {
        role: "assistant" as const,
        content: responseText,
        toolCalls:
          accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
        isStreaming: false,
      };

      const updatedList = newMessages.map((m, idx) =>
        idx === newMessages.length - 1 ? finalAssistantMsg : m,
      );
      setMessages(updatedList);

      // Finalize token cost
      await finalizeTokenCost(
        updatedList,
        holdAmount,
        responseText || JSON.stringify(accumulatedToolCalls),
      );

      // 3. Auto-handle tool calls if present
      if (accumulatedToolCalls.length > 0) {
        let mockToolResponses: any = {};
        try {
          mockToolResponses = JSON.parse(promptValues.mockResponses || "{}");
        } catch {}

        const toolResponsesList: Message[] = [];
        for (const tc of accumulatedToolCalls) {
          const name = tc.function?.name || "";
          const callId = tc.id || "";

          const mockResult = mockToolResponses[name] || {
            status: "success",
            message: `Executed ${name} successfully`,
          };

          let finalResult = mockResult;
          try {
            const resolveRes = await fetch("/api/manual-test/resolve-tool", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                arguments: JSON.parse(tc.function?.arguments || "{}"),
                mockResult,
              }),
            });
            if (resolveRes.ok) {
              const resData = await resolveRes.json();
              finalResult = resData.resolved;
            }
          } catch (err) {
            console.error("Failed to resolve tool response:", err);
          }

          const contentStr =
            typeof finalResult === "string"
              ? finalResult
              : JSON.stringify(finalResult);

          toolResponsesList.push({
            role: "tool",
            name,
            tool_call_id: callId,
            content: contentStr,
          });
        }

        // Add tool responses to history
        const nextList = [...updatedList, ...toolResponsesList];
        setMessages(nextList);

        // Auto-run next turn with the tool inputs
        toast.info("Auto-executing tool responses in agent loop...");
        await runAssistantTurn(nextList);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Manual interaction run failed");
    } finally {
      setLoading(false);
    }
  };

  const finalizeTokenCost = async (
    finalMessages: Message[],
    holdAmount: number,
    responseText: string,
  ) => {
    try {
      const refundRes = await fetch("/api/manual-test/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: finalMessages,
          targetModel: model,
          systemPrompt: promptValues.systemPrompt,
          tools: promptValues.tools,
          mockResponses: promptValues.mockResponses,
          holdAmount,
          responseText,
        }),
      });

      if (refundRes.ok) {
        const { scanTokensRemaining, refundedAmount } = await refundRes.json();
        setUserTokens(scanTokensRemaining);
        if (refundedAmount > 0) {
          toast.success(
            `Refunded ${formatTokens(refundedAmount)} scan tokens.`,
          );
        }
      }
    } catch (err) {
      console.error("Failed to refund unused tokens:", err);
    }
  };

  const handleRemoveMessage = (idx: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRegenerate = async () => {
    if (messages.length === 0 || loading) return;

    // Find the last index of a user message
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx === -1) return;

    // Truncate messages history to keep up to that user message
    const remainingMessages = messages.slice(0, lastUserIdx + 1);
    setMessages(remainingMessages);

    // Re-run assistant turn
    await runAssistantTurn(remainingMessages);
  };

  const clearChat = () => {
    setMessages([]);
    toast.info("Chat cleared");
  };

  return (
    <div className="dark text-white grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
      {/* Sidebar - Saved Chats & Model details */}
      <div className="lg:col-span-1">
        <SavedPlaygrounds
          conversations={conversations}
          activeConvId={activeConvId}
          onLoadConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          onStartNewConversation={startNewConversation}
          userTokens={userTokens}
          model={model}
          onModelChange={setModel}
        />
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
              <Badge
                variant="secondary"
                className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              >
                Saved (Local)
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={clearChat}
              className="h-8 text-xs border-white/10 gap-1.5 hover:bg-white/5"
            >
              <Trash className="h-3.5 w-3.5 text-red-400" />
              Clear
            </Button>

            <ConfigDialog
              isOpen={isConfigOpen}
              onOpenChange={setIsConfigOpen}
              promptValues={promptValues}
              onPromptValuesChange={setPromptValues}
              globalValues={globalValues}
              onGlobalValuesChange={handleGlobalValuesChange}
            />
          </div>
        </div>

        {/* Conversation Thread */}
        <ChatThread 
          messages={messages} 
          onRemoveMessage={handleRemoveMessage} 
          onRegenerate={handleRegenerate}
          loading={loading}
        />

        {/* Input area */}
        <div className="p-3 border-t border-white/10 bg-zinc-950/40">
          <div className="flex gap-2 items-center">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleSend();
              }}
              placeholder="Message target model..."
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
