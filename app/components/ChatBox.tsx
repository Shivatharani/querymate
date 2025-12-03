"use client";

import { useState, useRef, useEffect } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import ReactMarkdown from "react-markdown";
import { Send, Plus } from "lucide-react";

import { mutateConversations, mutateUsage } from "./ChatSidebar";
import { MODELS, MODEL_GROUPS, type Provider } from "@/lib/models";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";

type ChatMessage = { role: "user" | "assistant"; content: string };

function TypingIndicator() {
  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
            <span
              className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
              style={{ animationDelay: "240ms" }}
            />
          </div>
          <span>Thinking…</span>
        </div>
      </MessageContent>
    </Message>
  );
}

export default function ChatBox({
  conversationId,
  setConversationId,
  chatTitle,
}: {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  chatTitle?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  const hasHistory = conversationId !== null && messages.length > 0;

  // Very generic defaults that make sense for anyone
  const globalDefaultSuggestions = [
    "Summarize this text",
    "Explain this in simple terms",
    "Help me debug some code",
    "Brainstorm ideas for a project",
  ];

  // Themed suggestion buckets for nicer personalization
  const codeSuggestions = [
    "Explain this error message",
    "Refactor this function for readability",
    "Add TypeScript types to this code",
    "Suggest test cases for this API",
  ];

  const learningSuggestions = [
    "Teach me this concept step by step",
    "Give me a quick overview of this topic",
    "Create a small practice exercise for me",
    "Explain the pros and cons of this approach",
  ];

  const writingSuggestions = [
    "Improve the clarity of this paragraph",
    "Rewrite this in a more professional tone",
    "Generate a short summary of this content",
    "Help me draft an email for this situation",
  ];

  // Decide which bucket to use based on the current input content
  const getBucketForInput = (value: string): string[] => {
    const lower = value.toLowerCase();

    if (
      lower.includes("react") ||
      lower.includes("next") ||
      lower.includes("code") ||
      lower.includes("bug") ||
      lower.includes("error") ||
      lower.includes("typescript") ||
      lower.includes("api")
    ) {
      return codeSuggestions;
    }

    if (
      lower.includes("learn") ||
      lower.includes("concept") ||
      lower.includes("explain") ||
      lower.includes("tutorial") ||
      lower.includes("overview")
    ) {
      return learningSuggestions;
    }

    if (
      lower.includes("write") ||
      lower.includes("email") ||
      lower.includes("text") ||
      lower.includes("paragraph") ||
      lower.includes("summary")
    ) {
      return writingSuggestions;
    }

    // Fallback to global defaults if nothing specific is detected
    return globalDefaultSuggestions;
  };

  // Debounced suggestion update based on user input
  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = input.trim();

      if (!trimmed) {
        setSuggestions(globalDefaultSuggestions);
        return;
      }

      const bucket = getBucketForInput(trimmed);
      const filtered = bucket.filter((s) =>
        s.toLowerCase().includes(trimmed.toLowerCase()),
      );

      // If nothing in the bucket matches the text, show the bucket itself,
      // and if even that is empty for some reason, show global defaults.
      if (filtered.length) {
        setSuggestions(filtered);
      } else if (bucket.length) {
        setSuggestions(bucket);
      } else {
        setSuggestions(globalDefaultSuggestions);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [input]);

  // Initialize suggestions once on mount
  useEffect(() => {
    setSuggestions(globalDefaultSuggestions);
  }, []);

  // Load conversation history
  useEffect(() => {
    let isMounted = true;

    async function loadHistory(id: string) {
      const res = await fetch(`/api/messages?conversationId=${id}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!isMounted) return;
      setMessages(
        data.messages?.length
          ? data.messages
          : [{ role: "assistant", content: chatTitle || "Chat started." }],
      );
    }

    if (!conversationId) {
      setMessages([]);
      return;
    }
    loadHistory(conversationId);

    return () => {
      isMounted = false;
    };
  }, [conversationId, chatTitle]);

  // Auto-scroll on new messages / loading
  useEffect(() => {
    if (scrollRootRef.current) {
      scrollRootRef.current.scrollTop = scrollRootRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    const body: { message: string; model: string; conversationId?: string } = {
      message: trimmed,
      model: selectedModel,
    };
    if (conversationId) body.conversationId = conversationId;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      // If new conversation, fetch its id
      if (!conversationId) {
        mutateConversations();
        const convRes = await fetch("/api/conversations", {
          credentials: "include",
        });
        if (convRes.ok) {
          const convData = await convRes.json();
          const list = convData.conversations || [];
          if (list.length) {
            const newest = list[list.length - 1];
            setConversationId(newest.id);
          }
        }
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          full += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            if (
              updated.length &&
              updated[updated.length - 1].role === "assistant"
            ) {
              updated[updated.length - 1].content = full;
            } else {
              updated.push({ role: "assistant", content: full });
            }
            return updated;
          });
        }
        mutateUsage();
        mutateConversations();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Unable to connect. Please try again.",
        },
      ]);
    }
    setLoading(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    sendMessage(e);
  };

  const showCenterPrompt =
    !hasHistory && !loading && messages.length === 0 && !input;

  function handleNewChat() {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setSuggestions(globalDefaultSuggestions);
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    // If you want to submit immediately when they click, uncomment:
    // if (!loading) {
    //   sendMessage({ preventDefault: () => {} } as any);
    // }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white pb-3">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0">
        <ScrollArea.Root type="scroll" className="h-full w-full">
          <ScrollArea.Viewport
            ref={scrollRootRef}
            className="h-full w-full px-3 sm:px-4 md:px-6 py-4 md:py-6"
          >
            <div className="max-w-3xl mx-auto">
              {showCenterPrompt ? (
                <div className="flex flex-col items-center justify-center pt-24 text-center">
                  <h1 className="text-2xl md:text-3xl font-semibold mb-4">
                    What&apos;s on the agenda today?
                  </h1>
                  <p className="text-sm text-gray-500 mb-8">
                    Choose a model and ask anything to get started.
                  </p>
                </div>
              ) : (
                <Conversation>
                  <ConversationContent>
                    {messages.map((m, i) => (
                      <Message key={i} from={m.role}>
                        <MessageContent>
                          {m.role === "assistant" ? (
                            <div className="prose max-w-none">
                              <ReactMarkdown>{m.content}</ReactMarkdown>
                            </div>
                          ) : (
                            m.content
                          )}
                        </MessageContent>
                      </Message>
                    ))}
                    {loading && <TypingIndicator />}
                  </ConversationContent>
                </Conversation>
              )}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            className="w-2 bg-gray-100"
          >
            <ScrollArea.Thumb className="bg-gray-400 rounded-full" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      </div>

      {/* Bottom bar: model selector + PromptInput + Suggestions */}
      <div className="w-full border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-0 pt-4 pb-6 space-y-3">
          {/* Model selector row (no fancy label styling, just inline text + select) */}
          <div className="flex items-center gap-2 text-xs text-gray-600 justify-start">
            <span className="font-medium">Model</span>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-44 sm:w-56 h-8 border-gray-300 text-xs">
                <SelectValue placeholder="Select model">
                  {MODELS[selectedModel]?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(Object.keys(MODEL_GROUPS) as Provider[]).map((provider) => (
                  <SelectGroup key={provider}>
                    <SelectLabel className="text-[11px] text-gray-500">
                      {MODEL_GROUPS[provider].name}
                    </SelectLabel>
                    {MODEL_GROUPS[provider].models.map((modelId) => {
                      const model = MODELS[modelId];
                      return (
                        <SelectItem key={modelId} value={modelId}>
                          <span className="text-xs">{model.name}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PromptInput */}
          <div className="w-full flex justify-center">
            <PromptInput
              onSubmit={(message, event) => {
                event.preventDefault();
                if (message.text && !loading) {
                  handleSubmit(event);
                }
              }}
              className="w-full"
            >
              {/* Left tools: New chat */}
              <PromptInputTools>
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 hover:bg-gray-100"
                  aria-label="New chat"
                >
                  <Plus className="w-3 h-3 text-gray-700" />
                </button>
              </PromptInputTools>

              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !loading) {
                      handleSubmit(e);
                    }
                  }
                }}
                placeholder="Ask anything"
                disabled={loading}
              />

              <PromptInputSubmit
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-black text-white text-xs font-medium disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </PromptInputSubmit>
            </PromptInput>
          </div>

          {/* Suggestions row */}
          <div className="w-full">
            <Suggestions>
              {suggestions.map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  suggestion={suggestion}
                  onClick={handleSuggestionClick}
                  variant="outline"
                  size="sm"
                />
              ))}
            </Suggestions>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            Query Mate AI can make mistakes. Consider checking important
            information.
          </p>
        </div>
      </div>
    </div>
  );
}