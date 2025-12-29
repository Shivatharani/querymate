// app/api/conversations/export/route.ts
import { db } from "@/lib/lib";
import { conversations, messages } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");
    const format = url.searchParams.get("format") || "json"; 

    let conversationsToExport;
    
    if (conversationId) {
      conversationsToExport = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, session.user.id)
          )
        );
    } else {
      conversationsToExport = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, session.user.id))
        .orderBy(conversations.createdAt);
    }

    if (conversationsToExport.length === 0) {
      return NextResponse.json(
        { error: "No conversations found" },
        { status: 404 }
      );
    }

    // Get all messages for selected conversations
    const conversationIds = conversationsToExport.map((c) => c.id);
    const allMessages = await db
      .select()
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(messages.createdAt);

    // Group messages by conversation
    const messagesByConversation: Record<string, typeof allMessages> = {};
    allMessages.forEach((msg) => {
      if (!msg.conversationId) return;
      if (!messagesByConversation[msg.conversationId]) {
        messagesByConversation[msg.conversationId] = [];
      }
      messagesByConversation[msg.conversationId].push(msg);
    });

    // Build export data
    const exportData = conversationsToExport.map((conv) => ({
      id: conv.id,
      title: conv.title || "Untitled",
      createdAt: conv.createdAt,
      messages: (messagesByConversation[conv.id] || []).map((msg) => {
        // Parse content if it's JSON
        let content = msg.content;
        let files = null;
        
        try {
          const parsed = JSON.parse(msg.content || "");
          if (parsed.text) {
            content = parsed.text;
            files = parsed.files || null;
          }
        } catch {
          // Not JSON, use as-is
        }

        return {
          role: msg.role,
          content,
          files,
          model: msg.model,
          tokensUsed: msg.tokensUsed,
          createdAt: msg.createdAt,
        };
      }),
    }));

    // Format based on requested type
    if (format === "markdown") {
      const markdown = exportToMarkdown(exportData);
      return new Response(markdown, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="querymate-export-${Date.now()}.md"`,
        },
      });
    }

    if (format === "txt") {
      const text = exportToText(exportData);
      return new Response(text, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="querymate-export-${Date.now()}.txt"`,
        },
      });
    }

    // Default: JSON
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="querymate-export-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function exportToMarkdown(data: any[]): string {
  let markdown = "# QueryMate Chat Export\n\n";
  markdown += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

  data.forEach((conv) => {
    markdown += `## ${conv.title}\n\n`;
    markdown += `*Created: ${new Date(conv.createdAt).toLocaleString()}*\n\n`;
    conv.messages.forEach((msg: any) => {
      const role = msg.role === "user" ? "*You" : "Assistant*";
      const model = msg.model ? ` (${msg.model})` : "";
      markdown += `### ${role}${model}\n\n`;
      markdown += `${msg.content}\n\n`;
      
      if (msg.files && msg.files.length > 0) {
        markdown += `*Attachments: ${msg.files.map((f: any) => f.name).join(", ")}*\n\n`;
      }
    });

    markdown += "---\n\n";
  });

  return markdown;
}

function exportToText(data: any[]): string {
  let text = "QueryMate Chat Export\n";
  text += `Exported on ${new Date().toLocaleString()}\n`;
  text += "=".repeat(50) + "\n\n";

  data.forEach((conv) => {
    text += `CONVERSATION: ${conv.title}\n`;
    text += `Created: ${new Date(conv.createdAt).toLocaleString()}\n`;
    text += "-".repeat(40) + "\n\n";

    conv.messages.forEach((msg: any) => {
      const role = msg.role === "user" ? "YOU" : "ASSISTANT";
      const model = msg.model ? ` [${msg.model}]` : "";
      text += `${role}${model}\n`;
      text += `${msg.content}\n\n`;
    });

    text += "=".repeat(50) + "\n\n";
  });

  return text;
}