"use client";
import { useState, useEffect } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Lucide icons as SVG components
const Search = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
);

const Plus = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M12 5v14M5 12h14"></path>
  </svg>
);

const X = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M18 6 6 18M6 6l12 12"></path>
  </svg>
);

const MoreVertical = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="12" cy="5" r="1"></circle>
    <circle cx="12" cy="19" r="1"></circle>
  </svg>
);

const Edit2 = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
  </svg>
);

const Trash2 = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
  </svg>
);

const MessageSquare = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const Sparkles = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
    <path d="M5 3v4M3 5h4M6 17v4M4 19h4"></path>
  </svg>
);

function titleFromMessages(messages: any[]) {
  const firstUserMsg = messages?.find((m) => m.role === "user")?.content || "";
  return firstUserMsg.split(/\s+/).slice(0, 5).join(" ") || "New Chat";
}

export default function ChatSidebar({
  open,
  setOpen,
  onSelectConversation,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelectConversation: (id: string | null, title: string) => void;
}) {
  const [user, setUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, any[]>>({});
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch("/api/auth/sessions", {
          credentials: "include",
        });
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setUser(sessionData.user || null);
        } else {
          return;
        }

        const convRes = await fetch("/api/conversations", {
          credentials: "include",
        });
        if (!convRes.ok) {
          setChats([]);
          setMessagesByConv({});
          return;
        }
        const convData = await convRes.json();
        const list = convData.conversations || [];
        setChats(list);

        const msgMap: Record<string, any[]> = {};
        for (const c of list) {
          try {
            const r = await fetch(`/api/messages?conversationId=${c.id}`, {
              credentials: "include",
            });
            if (!r.ok) continue;
            const d = await r.json();
            msgMap[c.id] = d.messages || [];
          } catch (e) {
            console.warn("[ChatSidebar] message fetch error", c.id, e);
          }
        }
        setMessagesByConv(msgMap);
      } catch (e) {
        console.error("[ChatSidebar] load error", e);
      }
    }

    load();
  }, []);

  const closeSidebar = () => setOpen(false);

  const getChatTitle = (chat: any) => {
    if (chat.title && chat.title !== "New Chat" && chat.title !== "New Conversation") {
      return chat.title.trim();
    }
    return titleFromMessages(messagesByConv[chat.id] || []);
  };

  const filteredChats = chats.filter((chat) => {
    const chatTitle = getChatTitle(chat);
    return !search || chatTitle.toLowerCase().includes(search.toLowerCase());
  });

  async function handleDelete(id: string) {
    if (!id) return;
    if (!confirm("Delete this conversation and all its messages?")) return;

    try {
      const res = await fetch("/api/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        alert("Failed to delete conversation");
        return;
      }
      setChats((prev) => prev.filter((c) => c.id !== id));
      setMessagesByConv((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      if (activeId === id) setActiveId(null);
    } catch {
      alert("Error deleting conversation");
    }
  }

  async function handleEdit(id: string) {
    const current = chats.find((c) => c.id === id);
    const currentTitle = current ? getChatTitle(current) : "";
    const newTitle = prompt("Edit chat title", currentTitle);
    if (!newTitle?.trim()) return;

    try {
      const res = await fetch("/api/conversations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, title: newTitle.trim() }),
      });
      if (!res.ok) {
        alert("Failed to update title");
        return;
      }
      const data = await res.json();
      setChats((prev) => prev.map((c) => (c.id === id ? data.conversation : c)));
    } catch {
      alert("Error updating title");
    }
  }

  return (
    <>
      <aside
        className={`fixed z-30 left-0 top-0 h-full w-80 transition-all duration-300 ease-in-out shadow-2xl bg-white
        ${open ? "translate-x-0" : "-translate-x-80"}`}
      >
        <Button
          variant="ghost"
          className="absolute top-4 right-4 rounded-full hover:bg-gray-100 transition-colors"
          onClick={closeSidebar}
          aria-label="Close sidebar"
          size="icon"
        >
          <X className="w-5 h-5 text-gray-600" />
        </Button>

        <div className="flex flex-col items-center py-8 border-b bg-gradient-to-b from-purple-50 to-white">
          <div className="relative mb-3">
            <div className="rounded-full w-16 h-16 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold uppercase shadow-lg ring-4 ring-purple-100">
              {user?.name?.[0] ?? "U"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="font-bold text-lg text-gray-900">{user?.name ?? "User"}</div>
          <div className="text-sm text-gray-500">{user?.email ?? "email@example.com"}</div>
        </div>

        <div className="flex flex-col px-4 pt-5 gap-3">
          <Button
            onClick={() => {
              setActiveId(null);
              onSelectConversation(null, "New Chat");
            }}
            className="flex items-center gap-2 justify-center bg-gradient-to-r from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 py-3 font-semibold"
          >
            <Plus className="w-5 h-5" /> New Chat
          </Button>
          <div className="flex items-center rounded-xl border-2 border-gray-200 px-3 py-2 focus-within:border-purple-400 transition-colors bg-gray-50 focus-within:bg-white">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-1 outline-none bg-transparent text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        <nav className="flex-1 mt-4 mb-6 px-4">
          <div className="mb-3 font-semibold text-xs tracking-wide text-gray-500 uppercase flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span>Recent Conversations</span>
          </div>
          <ScrollArea.Root className="h-[calc(100vh-360px)] w-full">
            <ScrollArea.Viewport className="w-full h-full py-1">
              <div className="flex flex-col gap-2 pr-3">
                {filteredChats.length > 0 ? (
                  filteredChats.map((chat) => {
                    const chatTitle = getChatTitle(chat);
                    return (
                      <div
                        key={chat.id}
                        className={`group flex items-center rounded-xl transition-all duration-200 ${
                          activeId === chat.id
                            ? "bg-gradient-to-r from-purple-100 to-fuchsia-100 shadow-sm"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <button
                          className="text-left flex-1 px-4 py-3 font-medium text-sm truncate text-gray-800"
                          onClick={() => {
                            setActiveId(chat.id);
                            onSelectConversation(chat.id, chatTitle);
                            closeSidebar();
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
                            <span className="truncate">{chatTitle}</span>
                          </div>
                        </button>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="p-2 mr-2 rounded-lg hover:bg-white opacity-0 group-hover:opacity-100 transition-all"
                              aria-label="Chat options"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4 text-gray-600" />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content
                            side="right"
                            align="start"
                            className="z-[99] bg-white border border-gray-200 rounded-xl shadow-xl text-sm min-w-[160px] py-1"
                          >
                            <DropdownMenu.Item
                              onSelect={() => handleEdit(chat.id)}
                              className="px-4 py-2.5 cursor-pointer hover:bg-gray-100 flex items-center gap-2 text-gray-700 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              <span>Edit</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
                            <DropdownMenu.Item
                              onSelect={() => handleDelete(chat.id)}
                              className="px-4 py-2.5 text-red-600 cursor-pointer hover:bg-red-50 flex items-center gap-2 transition-colors"
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
                  <div className="text-gray-400 text-sm py-8 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No conversations yet</p>
                    <p className="text-xs mt-1">Start a new chat to begin</p>
                  </div>
                )}
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" className="w-2 bg-gray-100 rounded-full">
              <ScrollArea.Thumb className="bg-purple-400 rounded-full hover:bg-purple-500 transition-colors" />
            </ScrollArea.Scrollbar>
            <ScrollArea.Corner />
          </ScrollArea.Root>
        </nav>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-20 backdrop-blur-sm transition-opacity"
          onClick={closeSidebar}
          aria-label="Close sidebar"
          tabIndex={-1}
        />
      )}
    </>
  );
}