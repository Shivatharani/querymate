import { db } from "@/lib/lib";
import { messages, conversations, user, TOKEN_LIMITS } from "@/lib/schema";
import { streamText } from "ai";
import { gemini } from "@/lib/ai-gemini";
import { perplexity } from "@/lib/ai-perplexity";
import { groq } from "@/lib/ai-groq";
import { MODELS, getModel } from "@/lib/models";
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

// Helper to check if user has exceeded limits (Gemini only for now)
function checkLimits(
  userData: {
    tokensUsedGemini: number;
    requestsUsedGemini: number;
  },
  provider: string,
): { exceeded: boolean; message: string } {
  // Only check limits for Google models (they return token usage)
  if (provider === "google") {
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

// Helper to determine if a model supports vision/files
function supportsMultimodal(provider: string): boolean {
  // Gemini models support vision and files
  // Groq vision models support vision only
  // Perplexity doesn't support vision in their current API
  return provider === "google" || provider === "groq";
}

// Helper to check file type support
function getFileSupport(mimeType: string, provider: string): {
  supported: boolean;
  type: 'image' | 'pdf' | 'text' | 'audio' | 'unsupported';
} {
  if (mimeType.startsWith('image/')) {
    return { supported: true, type: 'image' };
  }
  
  // PDFs - supported by Gemini
  if (mimeType === 'application/pdf' && provider === 'google') {
    return { supported: true, type: 'pdf' };
  }
  
  // Audio files - supported by Gemini
  if ((mimeType === 'audio/wav' || mimeType === 'audio/mp3' || mimeType === 'audio/mpeg') && provider === 'google') {
    return { supported: true, type: 'audio' };
  }
  
  // Text files - we'll extract and add as text
  if (mimeType === 'text/plain' || mimeType.startsWith('text/')) {
    return { supported: true, type: 'text' };
  }
  
  return { supported: false, type: 'unsupported' };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse formData to handle file uploads
    const formData = await req.formData();
    
    let conversationId = formData.get("conversationId") as string | null;
    const message = formData.get("message") as string;
    const title = formData.get("title") as string | null;
    const model = (formData.get("model") as string) || "gemini-2.5-flash";
    
    // Get all files from formData
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        files.push(value);
      }
    }

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    // Validate model exists in our config
    const modelConfig = getModel(model);
    if (!modelConfig) {
      return NextResponse.json(
        { error: "Invalid model selected" },
        { status: 400 },
      );
    }

    // Check if files are provided but model doesn't support multimodal
    if (files.length > 0 && !supportsMultimodal(modelConfig.provider)) {
      return NextResponse.json(
        { error: `The selected model (${model}) does not support image/file inputs. Please use a Gemini model or Groq vision model.` },
        { status: 400 },
      );
    }

    // Check file type support
    for (const file of files) {
      const fileSupport = getFileSupport(file.type, modelConfig.provider);
      if (!fileSupport.supported) {
        return NextResponse.json(
          { error: `File type ${file.type} is not supported. Supported: images (all), PDFs/audio (Gemini only), text files (all).` },
          { status: 400 },
        );
      }
    }

    // Check and reset daily tokens if needed
    const userData = await checkAndResetDailyTokens(session.user.id);
    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has exceeded limits
    const limitCheck = checkLimits(userData, modelConfig.provider);
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

    // Process files and create content parts (AI SDK official format)
    const fileMetadata: Array<{
      name: string;
      type: string;
      size: number;
    }> = [];

    const contentParts: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: Buffer | Uint8Array | string }
      | { type: 'file'; data: Buffer | Uint8Array; mimeType: string; filename?: string }
    > = [];
    
    // Add text message
    contentParts.push({
      type: "text",
      text: message,
    });

    // Process each file using AI SDK official format
    for (const file of files) {
      const mimeType = file.type;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileSupport = getFileSupport(mimeType, modelConfig.provider);
      
      fileMetadata.push({
        name: file.name,
        type: mimeType,
        size: file.size,
      });

      if (fileSupport.type === 'image') {
        // Image part - AI SDK official format (Buffer)
        contentParts.push({
          type: "image",
          image: buffer, // Use Buffer directly (AI SDK supports this)
        });
      } else if (fileSupport.type === 'pdf' || fileSupport.type === 'audio') {
        // File part - AI SDK official format for PDFs and audio
        contentParts.push({
          type: "file",
          data: buffer, // Use Buffer directly
          mimeType: mimeType,
          filename: file.name, // Optional but helpful
        });
      } else if (fileSupport.type === 'text') {
        // Text file - extract content and add as text part
        const textContent = buffer.toString('utf-8');
        contentParts.push({
          type: "text",
          text: `\n\n[Content from file: ${file.name}]\n${textContent}\n[End of file content]\n`,
        });
      }
    }

    // Save user message with file metadata
    const userMessageContent = files.length > 0 
      ? JSON.stringify({
          text: message,
          files: fileMetadata,
        })
      : message;

    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: userMessageContent,
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

    // Helper to get the AI model instance from config
    function getAIModel(config: NonNullable<typeof modelConfig>) {
      switch (config.provider) {
        case "google":
          return gemini(config.modelId);
        case "perplexity":
          return perplexity(config.modelId);
        case "groq":
          return groq(config.modelId);
        default:
          return gemini(config.modelId);
      }
    }

    if (isFirstMessage) {
      // Generate title using LLM (use a fast model for title generation)
      try {
        const titleModelConfig = MODELS["gemini-2.0-flash"] || modelConfig;
        const titleModel = getAIModel(titleModelConfig!);

        const titleGen = await streamText({
          model: titleModel,
          messages: [
            {
              role: "user",
              content: `Generate a very short 3-word title for this message. Output ONLY the title, nothing else: "${message}"`,
            },
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
          generatedTitle = generatedTitle.substring(0, 27) + "...";
        }

        // Update conversation with generated title
        if (generatedTitle) {
          await db
            .update(conversations)
            .set({ title: generatedTitle })
            .where(eq(conversations.id, conversationId));
        }
      } catch (titleError) {
        console.error("Error generating title:", titleError);
        // Title generation failed, but continue with the chat
      }
    }

    // Format history - handle both text and multimodal messages
    const formatted = history.map((m) => {
      try {
        // Try to parse as JSON (multimodal message)
        const parsed = JSON.parse(m.content || "{}");
        if (parsed.text && parsed.files) {
          // This is a multimodal message, but we can only include text in history
          // The current message will have the images
          return {
            role: m.role as "user" | "assistant",
            content: parsed.text,
          };
        }
      } catch {
        // Not JSON, treat as plain text
      }
      
      return {
        role: m.role as "user" | "assistant",
        content: m.content || "",
      };
    });

    // Remove the last user message from formatted (we'll replace it with multimodal version)
    formatted.pop();

    // Select AI model based on user choice
    const selectedModel = getAIModel(modelConfig);

    // Prepare the final messages array with proper AI SDK format
    const finalMessages = [
      ...formatted,
      {
        role: "user" as const,
        content: files.length > 0 ? contentParts : message,
      },
    ];

    console.log('Sending to AI with content parts:', contentParts.length, 'parts');

    // Call AI with multimodal support using official AI SDK format
    const response = await streamText({
      model: selectedModel,
      messages: finalMessages,
    });

    let full = "";
    const finalConversationId = conversationId;
    const finalModel = model;
    const finalProvider = modelConfig.provider;
    const supportsTokenUsage = modelConfig.supportsTokenUsage;
    const userId = session.user.id;

    // Collect the full response and track tokens
    (async () => {
      try {
        for await (const chunk of response.textStream) {
          full += chunk;
        }

        console.log('Full response received, length:', full.length);

        // Get token usage from the response (if supported)
        const usage = await response.usage;
        const totalTokens = supportsTokenUsage ? usage?.totalTokens || 0 : 0;

        // Save assistant message with token info
        await db.insert(messages).values({
          conversationId: finalConversationId,
          role: "assistant",
          content: full,
          model: finalModel,
          tokensUsed: totalTokens,
        });

        // Update user's token usage (Google/Groq models that support token tracking)
        if (finalProvider === "google" && totalTokens > 0) {
          await db
            .update(user)
            .set({
              tokensUsedGemini: sql`${user.tokensUsedGemini} + ${totalTokens}`,
              requestsUsedGemini: sql`${user.requestsUsedGemini} + 1`,
            })
            .where(eq(user.id, userId));
        }
      } catch (error) {
        console.error('Error in response processing:', error);
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
