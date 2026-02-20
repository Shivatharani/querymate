"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Zap, Infinity, ArrowLeft, Users, Calendar, Clock } from "lucide-react"; 

type Conversation = {
  id: string;
  title?: string | null;
  createdAt?: string;
};

type UsageData = {
  firstLogin?: string;
  totalLogins?: number;
  totalConversations?: number;
  tokens: {
    tokensUsed: number;
    tokensLimit: number;
    tokensRemaining: number;
    tokensPercentage: number;
    subscriptionTier: string;
  };
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getChatTitle(chat: Conversation) {
  if (
    chat.title &&
    chat.title !== "New Chat" &&
    chat.title !== "New Conversation"
  ) {
    return chat.title.trim();
  }
  return "New Chat";
}

function ratio(value: number, max: number) {
  if (!max || max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

export default function AnalyticsPage() {
  const router = useRouter();

  const { data: usageData } = useSWR("/api/analytics/usage", fetcher);
  const usage: UsageData | undefined = usageData?.usage;

  const { data: convData } = useSWR("/api/conversations", fetcher);
  const chats: Conversation[] = convData?.conversations || [];
  const recentChats = chats.slice(0, 10).sort((a, b) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const geminiTokenPercent = usage?.tokens
    ? ratio(usage.tokens.tokensUsed, usage.tokens.tokensLimit)
    : 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <main className="flex-1 px-4 md:px-8 py-6 space-y-6 min-h-screen bg-gradient-to-br from-white to-gray-50 dark:from-gray-950 dark:to-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header with back button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => router.push("/chat")}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="sr-only">Back to chat</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track your usage, conversations, and account activity
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                First Login
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {usage?.firstLogin ? formatDate(usage.firstLogin) : "Never"}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Account created
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-5 h-5 text-green-500" />
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Total Chats
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {usage?.totalConversations ?? chats.length}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Conversations created
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Total Logins
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {usage?.totalLogins ?? 0}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sessions started
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Model Rate Limits */}
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <Zap className="w-6 h-6 text-yellow-500" />
              Token Usage ({usage?.tokens?.subscriptionTier ?? "free"} tier)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Gemini Tokens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Google Gemini</h3>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200">
                  Active
                </Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Daily Tokens</span>
                    <span className="font-mono font-semibold">
                      {usage?.tokens 
                        ? `${usage.tokens.tokensUsed}/${usage.tokens.tokensLimit}` 
                        : "0/0"}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full shadow-sm transition-all ${
                        geminiTokenPercent >= 90 
                          ? 'bg-gradient-to-r from-red-400 to-red-600' 
                          : 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                      }`}
                      style={{ width: `${geminiTokenPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {usage?.tokens 
                      ? `${usage.tokens.tokensRemaining} tokens remaining (${geminiTokenPercent}% used)` 
                      : "Loading..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Perplexity & Groq */}
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <Infinity className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Perplexity</h4>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-mono">
                  Unlimited
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
                <Infinity className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Groq</h4>
                <p className="text-sm text-green-600 dark:text-green-400 font-mono">Unlimited</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Chats - Clickable */}
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <Clock className="w-5 h-5" />
              Recent Conversations
            </CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click to open chat ({chats.length} total)
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Separator className="my-4 bg-gray-200 dark:bg-gray-800" />
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentChats.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                recentChats.map((chat) => {
                  const title = getChatTitle(chat);
                  const time = chat.createdAt 
                    ? new Date(chat.createdAt).toLocaleString()
                    : "Never";
                  return (
                    <Button
                      key={chat.id}
                      variant="ghost"
                      className="w-full justify-start h-auto p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left"
                      onClick={() => {
                        router.push(`/chat/${chat.id}`);
                      }}
                    >
                      <div className="flex flex-col space-y-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                          {title}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {time}
                        </span>
                      </div>
                    </Button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}