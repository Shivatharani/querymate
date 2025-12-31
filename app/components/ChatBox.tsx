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
  FileIcon,
  ImageIcon,
  XIcon,
  CopyIcon,
  AlertCircle,
  Crown,
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

import { Loader } from "@/components/ai-elements/loader";
import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { BundledLanguage } from "shiki";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; type: string; size: number }>;
};

type TokenStatus = {
  tokensUsed: number;
  tokensLimit: number;
  tokensRemaining: number;
  tokensPercentage: number;
  subscriptionTier: string;
  shouldShowAlert: boolean;
  alertLevel: "warning" | "critical" | "depleted";
  hoursUntilReset: number;
  resetAt: string;
  lastTokenAlert: number | null;
};

const PROMPT_MODEL_OPTIONS = Object.keys(
  MODEL_GROUPS as Record<Provider, (typeof MODEL_GROUPS)[Provider]>,
).flatMap((provider) => {
  const group = MODEL_GROUPS[provider as Provider];
  if (provider === "google") {
    return group.models
      .filter(
        (id) => id === "gemini-2.5-flash" || id === "gemini-2.5-flash-lite",
      )
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
        <div className="flex items-center gap-2 p-4">
          <Loader className="h-5 w-5 text-blue-500 animate-spin" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {loadingText}
          </span>
        </div>
      </MessageContent>
    </Message>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function FilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith("image/");
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
    <div className="relative flex items-center gap-2 rounded-xl border border-gray-200/50 bg-gray-50/50 p-3 backdrop-blur-sm dark:border-gray-600/50 dark:bg-gray-800/50">
      {isImage && preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
        />
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
          <FileIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        </div>
      )}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {file.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatFileSize(file.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
        aria-label="Remove file"
      >
        <XIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
      </button>
    </div>
  );
}

const getBundledLanguage = (lang: string): BundledLanguage => {
  const allowed: BundledLanguage[] = [
    "javascript",
    "typescript",
    "python",
    "html",
    "css",
    "json",
    "markdown",
  ];
  return allowed.includes(lang as BundledLanguage)
    ? (lang as BundledLanguage)
    : ("text" as any);
};

function CompactTokenStatus({ tokenStatus }: { tokenStatus: TokenStatus | null }) {
  const router = useRouter();

  // ✅ Calculate ALL values BEFORE any early returns
  const percentage = tokenStatus ? Math.round(tokenStatus.tokensPercentage) : 0;
  const tokensRemaining = tokenStatus?.tokensRemaining ?? 0;
  const tokensLimit = tokenStatus?.tokensLimit ?? 0;
  const isHighUsage = percentage >= 90 && percentage < 100;
  const isDepleted = tokensRemaining <= 0;

  // ✅ useEffect MUST come BEFORE early return (Rules of Hooks)
  useEffect(() => {
    if (tokenStatus && isHighUsage && !isDepleted) {
      toast.warning(
        `⚠️ You're using ${percentage}% of your daily tokens. ${tokensRemaining} tokens remaining.`,
        {
          id: "high-usage-alert",
          duration: 6000,
          action: {
            label: "View plans",
            onClick: () => router.push("/pricing"),
          },
        },
      );
    }
  }, [percentage, tokensRemaining, isHighUsage, isDepleted, router, tokenStatus]);

  // ✅ NOW we can return early (AFTER all hooks)
  if (!tokenStatus) return null;

  return (
    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 border-b border-gray-200/50 dark:border-gray-700/50">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {tokensRemaining.toLocaleString()}/{tokensLimit.toLocaleString()} tokens
        </span>
      </div>
      <div className="flex items-center gap-2 w-24">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
          <div
            className={`h-2 rounded-full transition-all ${
              isDepleted ? "bg-red-500" : isHighUsage ? "bg-orange-500" : "bg-green-500"
            }`}
            style={{ width: `${Math.min(Math.max(percentage, 5), 100)}%` }}
          />
        </div>
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          {percentage}%
        </span>
      </div>
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
  const router = useRouter();
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
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [showTokenDepletedModal, setShowTokenDepletedModal] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const hasHistory = conversationId !== null && messages.length > 0;
  const isDepleted = tokenStatus?.tokensRemaining <= 0 || (tokenStatus?.tokensPercentage ?? 0) >= 100;

  // Fetch token status
  const fetchTokenStatus = async () => {
    try {
      const res = await fetch("/api/credits", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTokenStatus(data);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
    }
  };

  // Check tokens ONLY when sending - shows modal at 100%, warning at 90%
  const checkTokensBeforeSend = async (): Promise<boolean> => {
    await fetchTokenStatus();

    if (!tokenStatus) return true;

    const percentage = Math.round(tokenStatus.tokensPercentage);

    if (tokenStatus.tokensRemaining <= 0 || percentage >= 100) {
      setShowTokenDepletedModal(true);
      return false;
    }

    if (percentage >= 90) {
      toast.warning(
        `⚠️ High token usage! ${percentage}% used (${tokenStatus.tokensRemaining} tokens left)`,
        {
          id: "tokens-high-popup",
          duration: 5000,
          action: {
            label: "Upgrade",
            onClick: () => router.push("/pricing"),
          },
        },
      );
    }

    return true;
  };

  useEffect(() => {
    fetchTokenStatus();
    const interval = setInterval(fetchTokenStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRecognition);
    }
  }, []);

  // Voice input handlers
  const startListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported. Please use Chrome.");
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

  // Theme handlers
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial: "light" | "dark" = stored === "dark" ? "dark" : "light";
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

      const parsedMessages =
        data.messages?.map((msg: any) => {
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
            return { role: msg.role, content: msg.content };
          }
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
    return file.type.startsWith("image/") || file.type === "application/pdf";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      let error = false;

      newFiles.forEach((file) => {
        if (isValidFile(file)) {
          validFiles.push(file);
        } else {
          error = true;
        }
      });

      if (error) {
        setErrorMessage(
          "File format is not supported. Only images and PDFs are allowed.",
        );
        setTimeout(() => setErrorMessage(null), 3000);
      }

      setFiles((prev) => [...prev, ...validFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function sendChatMessage(text: string) {
    // Check tokens before sending
    const hasTokens = await checkTokensBeforeSend();
    if (!hasTokens) {
      return; // Modal will show, don't proceed
    }

    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };

    if (files.length > 0) {
      userMessage.files = files.map((f) => ({
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
        if (errorData.code === "TOKENS_EXHAUSTED") {
          setTokenStatus((prev) => prev ? { ...prev, tokensRemaining: 0 } : null);
          setShowTokenDepletedModal(true);
        } else {
          throw new Error(errorData.error || "Failed to send message");
        }
        return;
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

      // Refresh token status after message
      await fetchTokenStatus();
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Error: ${error.message}`
              : "Unable to connect. Please try again.",
        },
      ]);
    }
    setLoading(false);
    setFiles([]);
  }

  const handlePromptSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    
    // Call sendChatMessage which handles token check and modal
    await sendChatMessage(text);
  };

  const handleTextareaKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.trim();
      if (text && !loading) {
        await sendChatMessage(text);
      }
    }
  };

  const showCenterPrompt =
    !hasHistory && !loading && messages.length === 0 && !input;

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setSuggestions(defaultSuggestions);
    setFiles([]);
  };

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

  const handleCopyAssistantMessage = async (content: string) => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Response copied!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-[#050509]">
      {/* Compact Token Status */}
      <CompactTokenStatus tokenStatus={tokenStatus} />

      {/* Token Depleted Modal - Shows ONLY when clicking SEND after 100% */}
      <Dialog open={showTokenDepletedModal} onOpenChange={setShowTokenDepletedModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <AlertCircle className="h-8 w-8 text-red-500" />
              Daily Token Limit Reached
            </DialogTitle>
            <DialogDescription className="text-lg">
              You've used all {tokenStatus?.tokensLimit.toLocaleString() || 0} tokens for today.
              Upgrade to continue chatting or wait {tokenStatus?.hoursUntilReset || 0} hours for reset.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowTokenDepletedModal(false)}
              className="flex-1"
            >
              Wait for Reset
            </Button>
            <Button
              onClick={() => {
                setShowTokenDepletedModal(false);
                router.push("/pricing");
              }}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              Upgrade Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Theme Toggle */}
      <div className="flex items-center justify-end px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={handleThemeToggle}
          className="h-8 rounded-full bg-gray-100 px-3 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          suppressHydrationWarning
        >
          {theme === "light" ? "🌙 Dark mode" : "☀️ Light mode"}
        </button>
      </div>

      {/* Main chat area */}
      <div className="min-h-0 flex-1">
        <ScrollArea.Root type="scroll" className="h-full w-full">
          <ScrollArea.Viewport
            ref={scrollRootRef}
            className="h-full w-full px-3 py-4 sm:px-4 md:px-6 md:py-6"
          >
            <div className="mx-auto flex h-full max-w-full flex-col gap-6 sm:max-w-3xl">
              {showCenterPrompt ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
                  <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
                    What's on the agenda today?
                  </h1>
                  <p className="mb-8 text-lg text-gray-600 dark:text-gray-300 max-w-md">
                    Choose a model and ask anything to get started.
                  </p>
                  <div className="w-full max-w-2xl">
                    <Suggestions className="flex flex-nowrap justify-center gap-3 overflow-x-auto pb-4 -mb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent snap-x snap-mandatory">
                      {suggestions.map((s) => (
                        <Suggestion
                          key={s}
                          suggestion={s}
                          onClick={handleSuggestionClick}
                          variant="outline"
                          size="sm"
                          className="bg-white/80 backdrop-blur-sm text-gray-900 dark:bg-gray-800/90 dark:text-gray-100 shadow-md border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all whitespace-nowrap flex-shrink-0 snap-center h-12 px-4 py-2"
                        />
                      ))}
                    </Suggestions>
                  </div>
                </div>
              ) : (
                <Conversation className="!bg-transparent dark:!bg-transparent">
                  <ConversationContent className="!bg-transparent dark:!bg-transparent">
                    {messages.map((m, i) => (
                      <Message key={i} from={m.role} className="!bg-transparent dark:!bg-transparent">
                        <MessageContent className="!bg-transparent dark:!bg-transparent p-0">
                          {m.role === "user" ? (
                            <div className="max-w-3xl">
                              <div className="group relative mb-6 ml-auto max-w-2xl rounded-2xl rounded-br-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-6 py-5 text-base leading-relaxed shadow-lg">
                                <div className="prose prose-sm max-w-none">
                                  {m.content}
                                </div>
                                {m.files && m.files.length > 0 && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-2">
                                    {m.files.map((file, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-2 rounded-xl border border-gray-300/50 bg-gray-100/50 px-3 py-2 backdrop-blur-sm text-xs dark:border-gray-600/50 dark:bg-gray-700/50">
                                        {file.type.startsWith("image/") ? (
                                          <ImageIcon className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300" />
                                        ) : (
                                          <FileIcon className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                                            {file.name}
                                          </span>
                                        </div>
                                        <span className="text-gray-500 dark:text-gray-400">
                                          {formatFileSize(file.size)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100">
                                <ReactMarkdown
                                  components={{
                                    a({ node, children, href, ...props }) {
                                      return (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 font-medium underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors !text-blue-600 dark:!text-blue-400"
                                          {...props}
                                        >
                                          {children}
                                        </a>
                                      );
                                    },
                                    code({ className, children, ...props }) {
                                      const match = /language-(\w+)/.exec(className || "");
                                      const codeText = String(children ?? "").replace(/\n$/, "");
                                      const lang = match ? match[1] : "text";
                                      const bundledLang = getBundledLanguage(lang);
                                      return (
                                        <div className="my-6 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-900 to-black/50 text-sm shadow-2xl dark:border-gray-700/50 dark:from-gray-900/90 dark:to-black/90">
                                          <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">
                                            <span className="font-mono font-semibold text-xs uppercase tracking-wider text-gray-200">
                                              {lang}
                                            </span>
                                            <CodeBlockCopyButton
                                              onCopy={async () => {
                                                if (!navigator.clipboard) return;
                                                await navigator.clipboard.writeText(codeText);
                                              }}
                                              className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                                            />
                                          </div>
                                          <div className="max-h-[500px] overflow-auto">
                                            <CodeBlock
                                              code={codeText}
                                              language={bundledLang}
                                              showLineNumbers={true}
                                              className="px-6 py-4 text-sm leading-relaxed [&_.shiki]:text-gray-100"
                                            />
                                          </div>
                                        </div>
                                      );
                                    },
                                    pre({ children, ...props }) {
                                      return (
                                        <div className="not-prose my-6 rounded-2xl border border-gray-200 bg-gray-900/50 p-0 shadow-xl backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80">
                                          {children}
                                        </div>
                                      );
                                    },
                                    p({ children, ...props }) {
                                      return (
                                        <p className="text-base leading-relaxed text-gray-900 dark:text-gray-100 mb-6 !text-gray-900 dark:!text-gray-100" {...props}>
                                          {children}
                                        </p>
                                      );
                                    },
                                    h1({ children, ...props }) {
                                      return (
                                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-8 mb-4 !text-gray-900 dark:!text-white" {...props}>
                                          {children}
                                        </h1>
                                      );
                                    },
                                    h2({ children, ...props }) {
                                      return (
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 !text-gray-900 dark:!text-white" {...props}>
                                          {children}
                                        </h2>
                                      );
                                    },
                                    h3({ children, ...props }) {
                                      return (
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3 !text-gray-900 dark:!text-white" {...props}>
                                          {children}
                                        </h3>
                                      );
                                    },
                                  }}
                                >
                                  {m.content}
                                </ReactMarkdown>
                              </div>
                              <div className="flex justify-end pt-4">
                                <button
                                  type="button"
                                  onClick={() => handleCopyAssistantMessage(m.content)}
                                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:shadow-md hover:from-gray-200 hover:to-gray-300 transition-all dark:from-gray-800/80 dark:to-gray-700/80 dark:text-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50"
                                  aria-label="Copy response"
                                  title="Copy response"
                                >
                                  <CopyIcon className="h-4 w-4" />
                                  <span>Copy response</span>
                                </button>
                              </div>
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
          <ScrollArea.Scrollbar orientation="vertical" className="w-2 bg-transparent">
            <ScrollArea.Thumb className="rounded-full bg-gray-300/50 hover:bg-gray-400/70 transition-colors dark:bg-gray-600/50 dark:hover:bg-gray-500/70" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      </div>

      {/* Bottom input section - TYPING ALWAYS ALLOWED */}
      <div className="w-full border-t border-gray-200/50 bg-white/80 backdrop-blur-sm px-3 pb-3 pt-2 dark:border-gray-800/50 dark:bg-[#050509]/95">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
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
            <div className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50">
              {errorMessage}
            </div>
          )}

          <div className="flex w-full justify-center">
            <form
              onSubmit={handlePromptSubmit}
              className="flex w-full flex-col rounded-2xl border bg-white/90 shadow-lg hover:shadow-xl backdrop-blur-md transition-all border-gray-200/50 hover:border-gray-300/70 dark:border-gray-700/70 dark:bg-[#11111a]/95 dark:hover:border-gray-600/70"
            >
              <div className="px-4 pt-3 pb-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="What would you like to know?"
                  rows={1}
                  disabled={loading}
                  className="w-full resize-none border-none bg-transparent p-0 text-base font-normal placeholder:text-gray-500 focus:outline-none focus:ring-0 min-h-[44px] max-h-[140px] text-gray-900 dark:text-gray-50 !text-gray-900 dark:!text-gray-50 dark:placeholder:text-gray-400 leading-relaxed"
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

              <div className="flex items-center justify-between px-4 pb-3 pt-1.5 gap-1">
                <div className="flex items-center gap-1.5">
                  <PromptInputButton
                    size="icon-sm"
                    aria-label="Upload file"
                    type="button"
                    onClick={handleFileUploadClick}
                    disabled={loading}
                    className={`h-10 w-10 rounded-xl transition-all shadow-sm border bg-gray-100/80 hover:bg-gray-200/90 backdrop-blur-sm hover:shadow-md border-gray-200/50 dark:bg-gray-800/80 dark:hover:bg-gray-700/90 dark:border-gray-700/50 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <PlusIcon className="h-4 w-4 text-gray-700 dark:text-gray-200" />
                  </PromptInputButton>

                  <PromptInputButton
                    size="icon-sm"
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    type="button"
                    onClick={toggleVoiceInput}
                    disabled={!speechSupported || loading}
                    className={`h-10 w-10 rounded-xl transition-all shadow-sm border border-gray-200/50 backdrop-blur-sm ${
                      isListening
                        ? "bg-red-500/90 text-white hover:bg-red-600 shadow-lg animate-pulse dark:bg-red-500/95"
                        : loading
                        ? "opacity-50 cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/50"
                        : "bg-gray-100/80 hover:bg-gray-200/90 dark:bg-gray-800/80 dark:hover:bg-gray-700/90"
                    } ${!speechSupported ? "opacity-50 cursor-not-allowed" : ""} dark:border-gray-700/50`}
                  >
                    {isListening ? (
                      <MicOffIcon className="h-4 w-4" />
                    ) : (
                      <MicIcon className="h-4 w-4 text-gray-700 dark:text-gray-200" />
                    )}
                  </PromptInputButton>

                  <PromptInputButton
                    className={`h-10 rounded-xl px-3 text-xs font-medium shadow-sm border border-gray-200/50 backdrop-blur-sm transition-all ${
                      searchEnabled
                        ? "bg-gradient-to-r from-gray-900 to-black text-white hover:from-gray-800 hover:to-gray-900 shadow-lg"
                        : loading
                        ? "opacity-50 cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/50"
                        : "bg-gray-100/80 hover:bg-gray-200/90 text-gray-800 dark:text-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-700/90"
                    }`}
                    size="sm"
                    type="button"
                    onClick={handleSearchClick}
                    aria-pressed={searchEnabled}
                    disabled={loading}
                  >
                    <Globe2
                      className={`mr-1.5 h-3.5 w-3.5 ${
                        searchEnabled
                          ? "text-white"
                          : "text-gray-700 dark:text-gray-200"
                      }`}
                    />
                    <span>{searchEnabled ? "Search On" : "Search"}</span>
                  </PromptInputButton>

                  <PromptInputSelect
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                    disabled={loading}
                  >
                    <PromptInputSelectTrigger className="h-10 w-28 rounded-xl bg-gray-100/80 px-2 text-xs font-medium shadow-sm hover:bg-gray-200/90 backdrop-blur-sm border border-gray-200/50 hover:border-gray-300/70 dark:border-gray-700/50 dark:hover:bg-gray-700/90 dark:text-gray-200">
                      <Globe2 className="mr-1 h-3 w-3 text-gray-700 dark:text-gray-200" />
                      <PromptInputSelectValue />
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
                  className="h-10 w-10 flex items-center justify-center rounded-xl transition-all bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 shadow-lg hover:shadow-xl border border-gray-400/50 dark:from-gray-400 dark:to-gray-500 dark:border-gray-600/50 dark:hover:from-gray-300 dark:hover:to-gray-400"
                  aria-label="Send message"
                >
                  {loading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <CornerDownLeftIcon className="h-4 w-4" />
                  )}
                </PromptInputSubmit>
              </div>
            </form>
          </div>

          <p className="text-center text-xs font-medium px-2 leading-relaxed pt-1 text-gray-500 dark:text-gray-400">
            QueryMate AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </div>
  );
}