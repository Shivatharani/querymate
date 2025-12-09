"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import ReactMarkdown from "react-markdown";
import {
  PlusIcon,
  MicIcon,
  MicOffIcon,
  Globe2,
  CornerDownLeftIcon,
  CopyIcon,
  CheckIcon,
  XIcon,
  FileIcon,
  ImageIcon,
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

// Import the new loader and code block components
import { Loader } from "@/components/ai-elements/loader";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";
import { BundledLanguage } from "shiki"; // Import the correct type

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; type: string; size: number }>;
};

const PROMPT_MODEL_OPTIONS = Object.keys(
  MODEL_GROUPS as Record<Provider, (typeof MODEL_GROUPS)[Provider]>,
).flatMap((provider) => {
  const group = MODEL_GROUPS[provider as Provider];
  if (provider === "google") {
    // Only include gemini-2.5-flash and gemini-2.5-flash-lite for Google
    return group.models
      .filter(id => id === "gemini-2.5-flash" || id === "gemini-2.5-flash-lite")
      .map((id) => ({
        id,
        name: MODELS[id]?.name ?? id,
      }));
  }
  return group.models.map((id) => ({
    id,
    name: MODELS[id]?.name ?? id,
  }));
});

const DEFAULT_MODEL_ID =
  PROMPT_MODEL_OPTIONS.find((m) => m.id === "gemini-2.5-flash")?.id ??
  PROMPT_MODEL_OPTIONS[0]?.id ??
  "gemini-2.5-flash";

const THEME_STORAGE_KEY = "theme";

function TypingIndicator({ isSearching }: { isSearching: boolean }) {
  const [loadingText, setLoadingText] = useState("Thinking...");

  useEffect(() => {
    const texts = isSearching
      ? ["Searching..."]
      : ["Thinking...", "Analyzing...", "Processing..."];
    let index = 0;
    const interval = setInterval(() => {
      setLoadingText(texts[index]);
      index = (index + 1) % texts.length;
    }, 1500);
    return () => clearInterval(interval);
  }, [isSearching]);

  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex items-center gap-2">
          <Loader />
          <span className="text-sm text-gray-500 dark:text-gray-400">{loadingText}</span>
        </div>
      </MessageContent>
    </Message>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function FilePreview({
  file,
  onRemove
}: {
  file: File;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith('image/');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [file, isImage]);

  return (
    <div className="relative flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
      {isImage && preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-12 w-12 rounded object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 dark:bg-gray-700">
          <FileIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
          {file.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatFileSize(file.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <XIcon className="h-4 w-4 text-gray-500" />
      </button>
    </div>
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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">("light");

  const hasHistory = conversationId !== null && messages.length > 0;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRecognition);
    }
  }, []);

  const startListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      if (finalTranscript) {
        setInput((prev) => prev + finalTranscript);
      }
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        alert("Microphone access denied. Please allow microphone access in your browser settings.");
      }
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const defaultSuggestions = [
    "Summarize this text",
    "Explain this in simple terms",
    "Help me debug some code",
    "Brainstorm ideas for a project",
  ];

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial: "light" | "dark" =
      stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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

  useEffect(() => {
    let isMounted = true;
    async function loadHistory(id: string) {
      const res = await fetch(`/api/messages?conversationId=${id}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!isMounted) return;

      const parsedMessages = data.messages?.map((msg: any) => {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.text && parsed.files) {
            return {
              role: msg.role,
              content: parsed.text,
              files: parsed.files,
            };
          }
        } catch {
          // Not JSON, regular message
        }
        return {
          role: msg.role,
          content: msg.content,
        };
      }) || [];

      setMessages(
        parsedMessages.length
          ? parsedMessages
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

  useEffect(() => {
    if (scrollRootRef.current) {
      scrollRootRef.current.scrollTop = scrollRootRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const isValidFile = (file: File): boolean => {
    return file.type.startsWith('image/') || file.type === 'application/pdf';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      let error = false;

      newFiles.forEach(file => {
        if (isValidFile(file)) {
          validFiles.push(file);
        } else {
          error = true;
        }
      });

      if (error) {
        setErrorMessage("File format is not supported. Only images and PDFs are allowed.");
        setTimeout(() => setErrorMessage(null), 3000);
      }

      setFiles((prev) => [...prev, ...validFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function sendChatMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
    };

    if (files.length > 0) {
      userMessage.files = files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
      }));
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const formData = new FormData();
    formData.append("message", trimmed);
    formData.append("model", selectedModel);
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

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
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error instanceof Error
            ? `Error: ${error.message}`
            : "Unable to connect. Please try again.",
        },
      ]);
    }
    setLoading(false);
    setFiles([]); // Clear files after sending
  }

  const handlePromptSubmit = (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    sendChatMessage(text);
  };

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

  const handleSearchClick = () => {
    setSearchEnabled((prev) => !prev);
  };

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const isSearching = loading && searchEnabled;

  // Helper to safely map language to BundledLanguage from shiki
  const getBundledLanguage = (lang: string): BundledLanguage => {
    const allowed: BundledLanguage[] = [
      'javascript', 'typescript', 'python', 'html', 'css', 'json', 'markdown'
    ];
    return allowed.includes(lang as BundledLanguage) ? (lang as BundledLanguage) : ("text" as any);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white pb-3 dark:bg-[#050509]">
      <div className="flex items-center justify-end px-4 pt-3">
        <button
          type="button"
          onClick={handleThemeToggle}
          className="h-8 rounded-full bg-gray-100 px-3 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          suppressHydrationWarning
        >
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>
      </div>

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
                  <div className="w-full max-w-2xl">
                    <Suggestions className="flex flex-wrap justify-center gap-2">
                      {suggestions.map((s) => (
                        <Suggestion
                          key={s}
                          suggestion={s}
                          onClick={handleSuggestionClick}
                          variant="outline"
                          size="sm"
                          className="bg-white text-gray-800 dark:bg-white dark:text-gray-900 shadow-sm"
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
                          {m.role === "user" ? (
                            <div>
                              <p className="mb-2">{m.content}</p>
                              {m.files && m.files.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {m.files.map((file, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                                    >
                                      {file.type.startsWith('image/') ? (
                                        <ImageIcon className="h-4 w-4 text-gray-500" />
                                      ) : (
                                        <FileIcon className="h-4 w-4 text-gray-500" />
                                      )}
                                      <span className="text-gray-700 dark:text-gray-300">
                                        {file.name}
                                      </span>
                                      <span className="text-gray-400">
                                        ({formatFileSize(file.size)})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="prose max-w-none text-gray-900 dark:prose-invert dark:text-gray-50">
                              <ReactMarkdown
                                components={{
                                  code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || "");
                                    const codeText = String(children ?? "").replace(/\n$/, "");
                                    const lang = match ? match[1] : "text";
                                    const bundledLang = getBundledLanguage(lang);
                                    return (
                                      <div className="my-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-950 text-gray-100 dark:border-gray-700 dark:bg-[#0b0b10]">
                                        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 dark:border-gray-700 dark:bg-[#1111a]">
                                          <span className="font-mono">{lang}</span>
                                          <CodeBlockCopyButton />
                                        </div>
                                        <CodeBlock
                                          code={codeText}
                                          language={bundledLang}
                                          showLineNumbers={false}
                                          className="max-h-[480px] overflow-auto px-3 py-2 text-xs leading-relaxed"
                                        />
                                      </div>
                                    );
                                  },
                                }}
                              >
                                {m.content}
                              </ReactMarkdown>
                            </div>
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

      <div className="w-full border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-[#050509]">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-3 pb-6 pt-4 sm:px-4 md:px-0">
          {/* File previews */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <FilePreview
                  key={index}
                  file={file}
                  onRemove={() => handleRemoveFile(index)}
                />
              ))}
            </div>
          )}
          {errorMessage && (
            <div className="text-xs text-red-500">{errorMessage}</div>
          )}

          <div className="flex w-full justify-center">
            <form
              onSubmit={handlePromptSubmit}
              className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white shadow-sm hover:border-gray-300 dark:border-gray-800 dark:bg-[#11111a]"
            >
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

              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf"
              />

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
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    type="button"
                    onClick={toggleVoiceInput}
                    disabled={!speechSupported}
                    className={`h-8 w-8 rounded-full transition-colors ${
                      isListening
                        ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                        : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                    } ${!speechSupported ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isListening ? (
                      <MicOffIcon className="h-4 w-4 text-white" />
                    ) : (
                      <MicIcon className="h-4 w-4 text-gray-600 dark:text-gray-200" />
                    )}
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

          <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
            Query Mate AI can make mistakes. Consider checking important
            information.
          </p>
        </div>
      </div>
    </div>
  );
}
