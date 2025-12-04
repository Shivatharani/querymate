"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import ReactMarkdown from "react-markdown";
import {
  PlusIcon,
  MicIcon,
  Globe2,
  CornerDownLeftIcon,
  Copy as CopyIcon,
  Check as CheckIcon,
} from "lucide-react";

import { mutateConversations, mutateUsage } from "./ChatSidebar";
import { MODELS, MODEL_GROUPS, type Provider } from "@/lib/models";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";

import {
  PromptInputSubmit,
  PromptInputButton,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSelectContent,
  PromptInputSelectItem,
} from "@/components/ai-elements/prompt-input";

import {
  Suggestions,
  Suggestion,
} from "@/components/ai-elements/suggestion";

type ChatMessage = { role: "user" | "assistant"; content: string };

// build model options
const PROMPT_MODEL_OPTIONS = Object.keys(
  MODEL_GROUPS as Record<Provider, (typeof MODEL_GROUPS)[Provider]>,
).flatMap((provider) => {
  const group = MODEL_GROUPS[provider as Provider];
  return group.models.map((id) => ({
    id,
    name: MODELS[id]?.name ?? id,
  }));
});

const DEFAULT_MODEL_ID =
  PROMPT_MODEL_OPTIONS.find((m) => m.id === "gemini-2.5-flash")?.id ??
  PROMPT_MODEL_OPTIONS[0]?.id ??
  "gemini-2.5-flash";

// must match the key used in ThemeToggle / Navbar
const THEME_STORAGE_KEY = "theme"; // "light" | "dark"

// ChatGPT-style code block with copy button
function CodeBlock({
  inline,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
  const [copied, setCopied] = useState(false);

  const match = /language-(\w+)/.exec(className || "");
  const codeText = String(children ?? "").replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore errors silently
    }
  };

  if (inline) {
    return (
      <code
        className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono text-gray-800 dark:bg-gray-800 dark:text-gray-100"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-950 text-gray-100 dark:border-gray-700 dark:bg-[#0b0b10]">
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 dark:border-gray-700 dark:bg-[#11111a]">
        <span className="font-mono">
          {match ? match[1] : "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] hover:bg-gray-800"
        >
          {copied ? (
            <>
              <CheckIcon className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="max-h-[480px] overflow-auto px-3 py-2 text-xs leading-relaxed">
        <code className={className} {...props}>
          {codeText}
        </code>
      </pre>
    </div>
  );
}

function TypingIndicator({ isSearching }: { isSearching: boolean }) {
  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />
            <span
              className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="h-2 w-2 animate-bounce rounded-full bg-gray-300"
              style={{ animationDelay: "240ms" }}
            />
          </div>
          <span>{isSearching ? "Searching…" : "Thinking…"}</span>
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
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [searchEnabled, setSearchEnabled] = useState(false);

  // theme state; synced with Navbar/ThemeToggle via localStorage
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasHistory = conversationId !== null && messages.length > 0;

  // single clear suggestions list
  const defaultSuggestions = [
    "Summarize this text",
    "Explain this in simple terms",
    "Help me debug some code",
    "Brainstorm ideas for a project",
  ];

  // suggestions: filter default list by current input
  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = input.trim();
      if (!trimmed) {
        setSuggestions(defaultSuggestions);
        return;
      }
      const filtered = defaultSuggestions.filter((s) =>
        s.toLowerCase().includes(trimmed.toLowerCase()),
      );
      setSuggestions(filtered.length ? filtered : defaultSuggestions);
    }, 250);
    return () => clearTimeout(timeout);
  }, [input]);

  useEffect(() => {
    setSuggestions(defaultSuggestions);
  }, []);

  // theme: initial sync from localStorage / <html>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial: "light" | "dark" =
      stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  // when theme changes here, update localStorage + <html>
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // listen for changes from other pages/tabs so everything stays in sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (
        e.key === THEME_STORAGE_KEY &&
        (e.newValue === "light" || e.newValue === "dark")
      ) {
        setTheme(e.newValue);
        document.documentElement.setAttribute("data-theme", e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // load history
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

  // auto-scroll
  useEffect(() => {
    if (scrollRootRef.current) {
      scrollRootRef.current.scrollTop = scrollRootRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendChatMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    const formData = new FormData();
    formData.append("message", trimmed);
    formData.append("model", selectedModel);
    formData.append("search", searchEnabled ? "on" : "off");
    if (conversationId) formData.append("conversationId", conversationId);
    files.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

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
    setFiles([]);
  }

  const handlePromptSubmit = (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    sendChatMessage(text);
  };

  // submit on Enter, newline on Shift+Enter
  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePromptSubmit();
    }
  };

  const showCenterPrompt =
    !hasHistory && !loading && messages.length === 0 && !input;

  function handleNewChat() {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setSuggestions(defaultSuggestions);
    setFiles([]);
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSearchClick = () => {
    setSearchEnabled((prev) => !prev);
  };

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const isSearching = loading && searchEnabled;

  return (
    <div className="flex min-h-screen flex-col bg-white pb-3 dark:bg-[#050509]">
      {/* top bar for theme toggle; align near Logout in page layout */}
      <div className="flex items-center justify-end px-4 pt-3">
        <button
          type="button"
          onClick={handleThemeToggle}
          className="h-8 rounded-full bg-gray-100 px-3 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1">
        <ScrollArea.Root type="scroll" className="h-full w-full">
          <ScrollArea.Viewport
            ref={scrollRootRef}
            className="h-full w-full px-3 py-4 sm:px-4 md:px-6 md:py-6"
          >
            <div className="mx-auto flex h-full max-w-3xl flex-col gap-6">
              {showCenterPrompt ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <h1 className="mb-4 text-2xl font-semibold md:text-3xl">
                    What&apos;s on the agenda today?
                  </h1>
                  <p className="mb-6 text-sm text-gray-500">
                    Choose a model and ask anything to get started.
                  </p>

                  {/* suggestions: clear, no internal scrolling */}
                  <div className="w-full max-w-2xl">
                    <Suggestions className="flex flex-wrap justify-center gap-2">
                      {suggestions.map((s) => (
                        <Suggestion
                          key={s}
                          suggestion={s}
                          onClick={handleSuggestionClick}
                          variant="outline"
                          size="sm"
                          className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                        />
                      ))}
                    </Suggestions>
                  </div>
                </div>
              ) : (
                <Conversation>
                  <ConversationContent>
                    {messages.map((m, i) => (
                      <Message key={i} from={m.role}>
                        <MessageContent>
                          {m.role === "assistant" ? (
                            <div className="prose max-w-none text-gray-900 dark:prose-invert dark:text-gray-50">
                              <ReactMarkdown
                                components={{
                                  code: CodeBlock,
                                }}
                              >
                                {m.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            m.content
                          )}
                        </MessageContent>
                      </Message>
                    ))}
                    {loading && <TypingIndicator isSearching={isSearching} />}
                  </ConversationContent>
                </Conversation>
              )}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            className="w-2 bg-gray-100 dark:bg-gray-800"
          >
            <ScrollArea.Thumb className="rounded-full bg-gray-400 dark:bg-gray-600" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      </div>

      {/* bottom prompt card */}
      <div className="w-full border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-[#050509]">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-3 pb-6 pt-4 sm:px-4 md:px-0">
          <div className="flex w-full justify-center">
            {/* ChatGPT-style input */}
            <form
              onSubmit={handlePromptSubmit}
              className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white shadow-sm hover:border-gray-300 dark:border-gray-800 dark:bg-[#11111a]"
            >
              {/* Top: textarea */}
              <div className="px-4 pt-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="What would you like to know?"
                  rows={1}
                  className="w-full resize-none border-none bg-transparent p-0 text-sm leading-5 min-h-[48px] max-h-[160px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-none dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Bottom: icons row */}
              <div className="mt-1 flex items-center justify-between px-4 pb-3 pt-2">
                <div className="flex items-center gap-1">
                  <PromptInputButton
                    size="icon-sm"
                    aria-label="Upload file"
                    type="button"
                    onClick={handleFileUploadClick}
                    className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <PlusIcon className="h-4 w-4 text-gray-600 dark:text-gray-200" />
                  </PromptInputButton>

                  <PromptInputButton
                    size="icon-sm"
                    aria-label="Voice input"
                    type="button"
                    className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <MicIcon className="h-4 w-4 text-gray-600 dark:text-gray-200" />
                  </PromptInputButton>

                  <PromptInputButton
                    className={`h-8 rounded-full px-3 text-xs transition-colors ${
                      searchEnabled
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    }`}
                    size="sm"
                    type="button"
                    onClick={handleSearchClick}
                    aria-pressed={searchEnabled}
                  >
                    <Globe2
                      className={`mr-1 h-3 w-3 ${
                        searchEnabled ? "text-white" : "text-gray-700 dark:text-gray-200"
                      }`}
                    />
                    <span>{searchEnabled ? "Search On" : "Search"}</span>
                  </PromptInputButton>

                  <PromptInputSelect
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <PromptInputSelectTrigger className="h-8 rounded-full bg-gray-100 px-3 text-xs hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                      <Globe2 className="mr-1 h-3 w-3 text-gray-700 dark:text-gray-200" />
                      <PromptInputSelectValue
                        placeholder={
                          MODELS[selectedModel]?.name ??
                          PROMPT_MODEL_OPTIONS[0]?.name
                        }
                      />
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      {PROMPT_MODEL_OPTIONS.map((m) => (
                        <PromptInputSelectItem key={m.id} value={m.id}>
                          {m.name}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                </div>

                <PromptInputSubmit
                  variant="secondary"
                  size="icon-sm"
                  disabled={loading || !input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-60 dark:bg-gray-300 dark:text-black dark:hover:bg-gray-200"
                  aria-label="Send message"
                >
                  <CornerDownLeftIcon className="h-4 w-4" />
                </PromptInputSubmit>
              </div>
            </form>
          </div>

          {files.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {files.length} file(s) selected
            </div>
          )}

          <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
            Query Mate AI can make mistakes. Consider checking important
            information.
          </p>
        </div>
      </div>
    </div>
  );
}
