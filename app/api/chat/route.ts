// app/api/chat/route.ts
import { db } from "@/lib/lib";
import { messages, conversations, user, TOKEN_LIMITS } from "@/lib/schema";
import { streamText } from "ai";
import { gemini } from "@/lib/ai-gemini";
import { bedrock } from "@/lib/ai-bedrock";
import { perplexity } from "@/lib/ai-perplexity";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-middleware";

// Helper to check and reset daily tokens (Gemini only)
async function checkAndResetDailyTokens(userId: string) {
  const [userData] = await db.select().from(user).where(eq(user.id, userId));

  if (!userData) return null;

  const now = new Date();
  const resetAt = new Date(userData.tokenResetAt);

  // Check if we need to reset (new day)
  if (
    now.getDate() !== resetAt.getDate() ||
    now.getMonth() !== resetAt.getMonth() ||
    now.getFullYear() !== resetAt.getFullYear()
  ) {
    // Reset daily tokens
    await db
      .update(user)
      .set({
        tokensUsedGemini: 0,
        requestsUsedGemini: 0,
        tokenResetAt: now,
      })
      .where(eq(user.id, userId));

    return {
      ...userData,
      tokensUsedGemini: 0,
      requestsUsedGemini: 0,
      tokenResetAt: now,
    };
  }

  return userData;
}

// Helper to check if user has exceeded limits (Gemini only)
function checkLimits(
  userData: {
    tokensUsedGemini: number;
    requestsUsedGemini: number;
  },
  model: string,
): { exceeded: boolean; message: string } {
  // Only check limits for Gemini (Perplexity doesn't return token usage)
  if (model === "gemini") {
    if (userData.tokensUsedGemini >= TOKEN_LIMITS.gemini.dailyTokens) {
      return {
        exceeded: true,
        message: `Daily token limit reached for Gemini (${TOKEN_LIMITS.gemini.dailyTokens.toLocaleString()} tokens). Resets at midnight.`,
      };
    }
    if (userData.requestsUsedGemini >= TOKEN_LIMITS.gemini.dailyRequests) {
      return {
        exceeded: true,
        message: `Daily request limit reached for Gemini (${TOKEN_LIMITS.gemini.dailyRequests} requests). Resets at midnight.`,
      };
    }
  }

  return { exceeded: false, message: "" };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    let { conversationId } = body as { conversationId?: string };
    const {
      message,
      title,
      model = "gemini",
    } = body as {
      message?: string;
      title?: string;
      model?: string;
    };

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    // Validate model
    const validModels = ["gemini", "perplexity", "bedrock"];
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: "Invalid model selected" },
        { status: 400 },
      );
    }

    // Check and reset daily tokens if needed
    const userData = await checkAndResetDailyTokens(session.user.id);
    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has exceeded limits
    const limitCheck = checkLimits(userData, model);
    if (limitCheck.exceeded) {
      return NextResponse.json({ error: limitCheck.message }, { status: 429 });
    }

    // If no conversationId provided, create a new conversation
    if (!conversationId) {
      const [newConversation] = await db
        .insert(conversations)
        .values({
          userId: session.user.id,
          title: title || "New Chat",
        })
        .returning();

      conversationId = newConversation.id;
    } else {
      // Verify conversation belongs to user
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, session.user.id),
          ),
        );

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }
    }

    // Save user message
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: message,
      model: null,
      tokensUsed: null,
    });

    // Load history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Generate title for first message
    const messageCount = history.length;
    const isFirstMessage = messageCount === 1;

    if (isFirstMessage) {
      // Generate title using LLM
      const titleModel =
        model === "gemini"
          ? gemini(process.env.GEMINI_MODEL!)
          : model === "perplexity"
            ? perplexity(process.env.PERPLEXITY_MODEL!)
            : bedrock(process.env.BEDROCK_MODEL_ID!);

      const titleGen = await streamText({
        model: titleModel,
        messages: [
          {
            role: "system",
            content:
              "Summarize the user's message into a short 3 word title. Output ONLY 3 words, no quotes or punctuation.",
          },
          { role: "user", content: message },
        ],
      });

      let generatedTitle = "";
      for await (const chunk of titleGen.textStream) {
        generatedTitle += chunk;
      }

      // Clean up the title and limit length
      generatedTitle = generatedTitle.replace(/['"]/g, "").trim();

      // Truncate title if it's too long (max 30 characters)
      if (generatedTitle.length > 30) {
        generatedTitle = generatedTitle.substring(0, 20) + "...";
      }

      // Update conversation with generated title
      await db
        .update(conversations)
        .set({ title: generatedTitle })
        .where(eq(conversations.id, conversationId));
    }

    const formatted = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content || "",
    }));

    // Select AI model based on user choice
    const selectedModel =
      model === "gemini"
        ? gemini(process.env.GEMINI_MODEL!)
        : model === "perplexity"
          ? perplexity(process.env.PERPLEXITY_MODEL!)
          : bedrock(process.env.BEDROCK_MODEL_ID!);

    // Call AI
    const response = await streamText({
      model: selectedModel,
      messages: formatted,
    });

    let full = "";
    const finalConversationId = conversationId;
    const finalModel = model;
    const userId = session.user.id;

    // Collect the full response and track tokens
    (async () => {
      for await (const chunk of response.textStream) {
        full += chunk;
      }

      // Get token usage from the response
      const usage = await response.usage;
      const totalTokens = usage?.totalTokens || 0;

      // Save assistant message with token info
      await db.insert(messages).values({
        conversationId: finalConversationId,
        role: "assistant",
        content: full,
        model: finalModel,
        tokensUsed: totalTokens,
      });

      // Update user's token usage (Gemini only - Perplexity doesn't return token usage)
      if (finalModel === "gemini") {
        await db
          .update(user)
          .set({
            tokensUsedGemini: sql`${user.tokensUsedGemini} + ${totalTokens}`,
            requestsUsedGemini: sql`${user.requestsUsedGemini} + 1`,
          })
          .where(eq(user.id, userId));
      }
    })();

    return response.toTextStreamResponse();
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
