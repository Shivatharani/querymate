"use client";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PlusIcon,
  Search,
  Edit,
  Trash2,
  MessageSquare,
  Sparkles,
  X,
  MoreVertical,
  Zap,
} from "lucide-react";

type Conversation = {
  id: string;
  title?: string | null;
  createdAt?: string;
  userId?: string;
};

type UsageData = {
  gemini: {
    tokensUsed: number;
    tokensLimit: number;
    requestsUsed: number;
    requestsLimit: number;
  };
  perplexity: {
    unlimited: boolean;
  };
};

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toString();
}

// Export mutate functions for external components to trigger revalidation
export const mutateConversations = () => mutate("/api/conversations");
export const mutateUsage = () => mutate("/api/usage");

export default function ChatSidebar({
  open,
  setOpen,
  onSelectConversation,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelectConversation: (id: string | null, title: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [conversationToEdit, setConversationToEdit] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // SWR for user session
  const { data: sessionData } = useSWR("/api/auth/sessions");
  const user = sessionData?.user;

  // SWR for token usage
  const { data: usageData } = useSWR("/api/usage");
  const usage = usageData?.usage;

  // SWR for conversations
  const { data: convData, mutate: mutateChats } = useSWR("/api/conversations");
  const chats: Conversation[] = convData?.conversations || [];

  const getChatTitle = (chat: Conversation) => {
    if (
      chat.title &&
      chat.title !== "New Chat" &&
      chat.title !== "New Conversation"
    ) {
      return chat.title.trim();
    }
    return "New Chat";
  };

  const filteredChats = chats.filter((chat) => {
    const chatTitle = getChatTitle(chat);
    return !search || chatTitle.toLowerCase().includes(search.toLowerCase());
  });

  const openEditDialog = (id: string, title: string) => {
    setConversationToEdit({ id, title });
    setEditTitle(title);
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!conversationToEdit || !editTitle.trim()) return;

    try {
      const response = await fetch("/api/conversations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: conversationToEdit.id,
          title: editTitle.trim(),
        }),
      });

      if (response.ok) {
        // Revalidate conversations
        mutateChats();
        setEditDialogOpen(false);
      } else {
        alert("Failed to update conversation title");
      }
    } catch (error) {
      console.error("Error updating title:", error);
      alert("Failed to update conversation title");
    }
  };

  const openDeleteDialog = (id: string, title: string) => {
    setConversationToDelete({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!conversationToDelete) return;

    const { id } = conversationToDelete;

    try {
      const response = await fetch("/api/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        // Revalidate conversations
        mutateChats();
        if (activeId === id) {
          setActiveId(null);
          onSelectConversation(null, "New Chat");
        }
      } else {
        alert("Failed to delete conversation");
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      alert("Failed to delete conversation");
    }
  };

  const initial = (user?.name?.[0] || "U").toUpperCase();

  return (
    <>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              Delete Conversation
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900 dark:text-gray-200">
                &quot;{conversationToDelete?.title || "this conversation"}&quot;
              </span>
              ? This action cannot be undone and all messages will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Title Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              Edit Conversation Title
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Enter a new title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="dark:text-gray-200">
                Title
              </Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Enter conversation title..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEdit();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile backdrop overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed z-30 left-0 top-0 h-full w-80 sm:w-80 md:w-80 transition-all duration-300 ease-in-out shadow-2xl bg-white dark:bg-gray-900 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-80"
        }`}
      >
        <Button
          variant="ghost"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors h-8 w-8 sm:h-10 sm:w-10"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
          size="icon"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
        </Button>

        {/* User circle + name + email */}
        <div className="flex flex-col items-center py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="w-12 h-12 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black text-lg font-semibold shadow-md mb-2">
            {initial}
          </div>
          <div className="font-bold text-sm text-gray-900 dark:text-white">
            {user?.name ?? "User"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 px-4 text-center truncate max-w-full">
            {user?.email ?? "email@example.com"}
          </div>
        </div>

        {/* Token Usage Display - Compact */}
        {usage && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3 h-3 text-yellow-500" />
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Daily Usage
              </span>
            </div>
            <div className="space-y-2">
              {/* Google/Gemini Usage */}
              <div className="flex items-center gap-2">
                <span className="text-xs">🧠</span>
                <span className="text-[10px] text-gray-600 dark:text-gray-400 w-12">
                  Google
                </span>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        usage.gemini.tokensUsed / usage.gemini.tokensLimit > 0.9
                          ? "bg-red-500"
                          : usage.gemini.tokensUsed / usage.gemini.tokensLimit >
                              0.7
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                      }`}
                      style={{
                        width: `${Math.min((usage.gemini.tokensUsed / usage.gemini.tokensLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                  {formatTokens(usage.gemini.tokensUsed)}/
                  {formatTokens(usage.gemini.tokensLimit)}
                </span>
              </div>
              {/* Perplexity - Unlimited */}
              <div className="flex items-center gap-2">
                <span className="text-xs">🔍</span>
                <span className="text-[10px] text-gray-600 dark:text-gray-400 w-12">
                  Perplexity
                </span>
                <span className="text-[10px] text-purple-500 dark:text-purple-400 font-medium ml-auto">
                  ∞ Unlimited
                </span>
              </div>
              {/* Groq - Unlimited */}
              <div className="flex items-center gap-2">
                <span className="text-xs">⚡</span>
                <span className="text-[10px] text-gray-600 dark:text-gray-400 w-12">
                  Groq
                </span>
                <span className="text-[10px] text-orange-500 dark:text-orange-400 font-medium ml-auto">
                  ∞ Unlimited
                </span>
              </div>
            </div>
          </div>
        )}

        {/* New Chat + Search */}
        <div className="flex flex-col px-4 pt-4 gap-2">
          <Button
            onClick={() => {
              setActiveId(null);
              onSelectConversation(null, "New Chat");
            }}
            className="flex items-center gap-2 justify-center bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 py-3 font-semibold"
          >
            <PlusIcon className="w-5 h-5" /> New Chat
          </Button>
          <div className="flex items-center rounded-xl border-2 border-gray-200 dark:border-gray-700 px-3 py-2 focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors bg-gray-50 dark:bg-gray-800 focus-within:bg-white dark:focus-within:bg-gray-700">
            <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <Input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-1 outline-none bg-transparent text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white dark:placeholder-gray-500"
            />
          </div>
        </div>

        {/* Conversations list */}
        <nav className="flex-1 mt-4 mb-6 px-4 min-h-0 flex flex-col overflow-hidden">
          <div className="mb-3 font-semibold text-xs tracking-wide text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2 flex-shrink-0">
            <MessageSquare className="w-4 h-4" />
            <span>Recent Conversations</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {filteredChats.length > 0 ? (
                filteredChats.map((chat) => {
                  const chatTitle = getChatTitle(chat);
                  return (
                    <div
                      key={chat.id}
                      className={`flex items-center gap-2 rounded-xl transition-all duration-200 px-2 py-1 ${
                        activeId === chat.id
                          ? "bg-gray-100 dark:bg-gray-800 shadow-sm"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <button
                        className="text-left flex-1 min-w-0 px-2 py-2 font-medium text-sm text-gray-800 dark:text-gray-200"
                        onClick={() => {
                          setActiveId(chat.id);
                          onSelectConversation(chat.id, chatTitle);
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          <span className="truncate block">{chatTitle}</span>
                        </div>
                      </button>

                      {/* Three-dots menu with Edit/Delete */}
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Conversation options"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content
                          side="right"
                          align="start"
                          className="z-[99] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md text-sm min-w-[160px] py-1"
                        >
                          <DropdownMenu.Item
                            onSelect={(e) => {
                              e.preventDefault();
                              openEditDialog(chat.id, chatTitle);
                            }}
                            className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                          >
                            <Edit className="w-4 h-4" />
                            <span>Edit</span>
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                          <DropdownMenu.Item
                            onSelect={(e) => {
                              e.preventDefault();
                              openDeleteDialog(chat.id, chatTitle);
                            }}
                            className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-400 dark:text-gray-500 text-sm py-8 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p>No conversations yet</p>
                  <p className="text-xs mt-1">Start a new chat to begin</p>
                </div>
              )}
            </div>
          </div>
        </nav>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-20 dark:bg-opacity-40 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
          tabIndex={-1}
        />
      )}
    </>
  );
}
