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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [conversationToEdit, setConversationToEdit] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: sessionData } = useSWR("/api/auth/sessions");
  const user = sessionData?.user;

  const { data: usageData } = useSWR("/api/usage");
  const usage: UsageData | undefined = usageData?.usage;

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
      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">
                &quot;{conversationToDelete?.title || "this conversation"}&quot;
              </span>
              ? This action cannot be undone and all messages will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-black text-white hover:bg-gray-900"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit title */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Conversation Title</DialogTitle>
            <DialogDescription>
              Enter a new title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              className="bg-black text-white hover:bg-gray-900"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/25 z-20 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-30 left-0 top-0 h-full w-72 md:w-80 transition-transform duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-72 md:-translate-x-80"
        }`}
      >
        {/* Close button - show on desktop and mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 rounded-md hover:bg-gray-100"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </Button>

        {/* User info */}
        <div className="flex flex-col items-center py-4 border-b border-gray-200">
          <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-semibold mb-2">
            {initial}
          </div>
          <div className="font-medium text-sm">
            {user?.name ?? "User"}
          </div>
          <div className="text-xs text-gray-500 px-4 text-center truncate max-w-full">
            {user?.email ?? "email@example.com"}
          </div>
        </div>

        {/* Minimal usage */}
        {usage && (
          <div className="px-4 py-3 border-b border-gray-200 text-xs text-gray-600 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>Google tokens</span>
              </div>
              <span className="font-mono">
                {formatTokens(usage.gemini.tokensUsed)}/
                {formatTokens(usage.gemini.tokensLimit)}
              </span>
            </div>
          </div>
        )}

        {/* New chat + search */}
        <div className="flex flex-col px-4 pt-4 gap-2">
          <Button
            onClick={() => {
              setActiveId(null);
              onSelectConversation(null, "New Chat");
            }}
            className="flex items-center gap-2 justify-center bg-black text-white hover:bg-gray-900 h-9 rounded-md text-sm"
          >
            <PlusIcon className="w-4 h-4" /> New Chat
          </Button>
          <div className="flex items-center rounded-md border border-gray-300 px-2 py-1">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search chats"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border-0 px-2 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* Conversations */}
        <nav className="flex-1 mt-4 mb-4 px-4 min-h-0 flex flex-col overflow-hidden">
          <div className="mb-2 text-[11px] font-semibold text-gray-500 uppercase flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            <span>Recent conversations</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1">
              {filteredChats.length > 0 ? (
                filteredChats.map((chat) => {
                  const chatTitle = getChatTitle(chat);
                  return (
                    <div
                      key={chat.id}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 ${
                        activeId === chat.id
                          ? "bg-gray-100"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <button
                        className="text-left flex-1 min-w-0 py-1 text-sm text-gray-800"
                        onClick={() => {
                          setActiveId(chat.id);
                          onSelectConversation(chat.id, chatTitle);
                          setOpen(false);
                        }}
                      >
                        <span className="truncate">{chatTitle}</span>
                      </button>

                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-gray-200"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Conversation options"
                          >
                            <MoreVertical className="w-3 h-3 text-gray-600" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content
                          side="right"
                          align="start"
                          className="z-[99] bg-white border border-gray-200 rounded-md shadow-sm text-sm min-w-[150px] py-1"
                        >
                          <DropdownMenu.Item
                            onSelect={(e) => {
                              e.preventDefault();
                              openEditDialog(chat.id, chatTitle);
                            }}
                            className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-gray-100"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
                          <DropdownMenu.Item
                            onSelect={(e) => {
                              e.preventDefault();
                              openDeleteDialog(chat.id, chatTitle);
                            }}
                            className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-gray-100 text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-400 text-sm py-8 text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No conversations yet</p>
                </div>
              )}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
