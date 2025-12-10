import { db } from "@/lib/lib";
import { messages, conversations, user } from "@/lib/schema";
import { streamText, generateText } from "ai";
import { gemini } from "@/lib/ai-gemini";
import { perplexity } from "@/lib/ai-perplexity";
import { groq } from "@/lib/ai-groq";
import { google } from "@ai-sdk/google";
import { MODELS, getModel } from "@/lib/models";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-middleware";
import { Buffer } from "buffer";

// Define TOKEN_LIMITS here to avoid import issues
const TOKEN_LIMITS = {
  gemini: {
    dailyTokens: 1_000_000,
    dailyRequests: 100,
  },
} as const;

async function checkAndResetDailyTokens(userId: string) {
  const [userData] = await db.select().from(user).where(eq(user.id, userId));

  if (!userData) return null;

  const now = new Date();
  const resetAt = new Date(userData.tokenResetAt);

  if (
    now.getDate() !== resetAt.getDate() ||
    now.getMonth() !== resetAt.getMonth() ||
    now.getFullYear() !== resetAt.getFullYear()
  ) {
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

function checkLimits(
  userData: {
    tokensUsedGemini: number;
    requestsUsedGemini: number;
  },
  provider: string,
): { exceeded: boolean; message: string } {
  if (provider === "google") {
    if (userData.tokensUsedGemini >= TOKEN_LIMITS.gemini.dailyTokens) {
      return {
        exceeded: true,
        message:` Daily token limit reached for Gemini (${TOKEN_LIMITS.gemini.dailyTokens.toLocaleString()} tokens). Resets at midnight.`,
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

function supportsMultimodal(provider: string): boolean {
  // Providers that support image/file parts with AI SDK v3
  return provider === "google" || provider === "groq";
}

function getFileSupport(
  mimeType: string,
  provider: string,
): {
  supported: boolean;
  type: "image" | "pdf" | "text" | "audio" | "document" | "unsupported";
} {
  if (mimeType.startsWith("image/")) {
    return { supported: true, type: "image" };
  }

  if (mimeType === "application/pdf" && provider === "google") {
    return { supported: true, type: "pdf" };
  }

  if (
    (mimeType === "application/msword" ||
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document") &&
    provider === "google"
  ) {
    return { supported: true, type: "document" };
  }

  if (
    (mimeType === "audio/wav" ||
      mimeType === "audio/mp3" ||
      mimeType === "audio/mpeg") &&
    provider === "google"
  ) {
    return { supported: true, type: "audio" };
  }

  if (mimeType === "text/plain" || mimeType.startsWith("text/")) {
    return { supported: true, type: "text" };
  }

  return { supported: false, type: "unsupported" };
}

function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

function isImageGenerationRequest(text: string): boolean {
  const keywords = [
    "create image",
    "generate image",
    "draw",
    "create picture",
    "generate picture",
    "make image",
    "create photo",
    "generate photo",
    "design image",
    "illustrate",
    "sketch",
    "create a picture",
    "make a picture",
    "draw me",
    "show me a picture",
    "visualize",
  ];
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword));
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();

    let conversationId = formData.get("conversationId") as string | null;
    const message = formData.get("message") as string;
    const title = formData.get("title") as string | null;
    const model = (formData.get("model") as string) || "gemini-2.5-flash";

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

    const modelConfig = getModel(model);
    if (!modelConfig) {
      return NextResponse.json(
        { error: "Invalid model selected" },
        { status: 400 },
      );
    }

    if (files.length > 0 && !supportsMultimodal(modelConfig.provider)) {
      return NextResponse.json(
        {
          error: `The selected model (${model}) does not support image/file inputs. Please use a Gemini model or Groq vision model.`,
        },
        { status: 400 },
      );
    }

    for (const file of files) {
      const fileSupport = getFileSupport(file.type, modelConfig.provider);
      if (!fileSupport.supported) {
        return NextResponse.json(
          {
            error: `File type ${file.type} is not supported. Supported: images (all), PDFs/docs/audio (Gemini only), text files (all).`,
          },
          { status: 400 },
        );
      }
    }

    const userData = await checkAndResetDailyTokens(session.user.id);
    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const limitCheck = checkLimits(userData, modelConfig.provider);
    if (limitCheck.exceeded) {
      return NextResponse.json({ error: limitCheck.message }, { status: 429 });
    }

    // Conversation upsert
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

    const urls = extractUrls(message);
    const isImageRequest = isImageGenerationRequest(message);

    const fileMetadata: Array<{
      name: string;
      type: string;
      size: number;
    }> = [];

    // Build content for the current message
    // Only the CURRENT message can be multimodal. History is string-only.
    let userMessageContent:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image"; image: string | ArrayBuffer | Uint8Array | Buffer }
          | {
              type: "file";
              mediaType: string;
              data: string | ArrayBuffer | Uint8Array | Buffer;
              filename?: string;
            }
        >;

    if (files.length > 0) {
      const parts: any[] = [];

      // Main text
      parts.push({
        type: "text",
        text: message,
      });

      // Attach every file in structured multimodal format
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

        if (fileSupport.type === "image") {
          // Image part
          parts.push({
            type: "image",
            image: buffer, // Buffer is allowed as binary data
          });
        } else if (
          fileSupport.type === "pdf" ||
          fileSupport.type === "document" ||
          fileSupport.type === "audio"
        ) {
          // File part (PDF, DOC, AUDIO)
          parts.push({
            type: "file",
            mediaType: mimeType, // ✅ correct property name
            data: buffer,
            filename: file.name, // optional but useful
          });
        } else if (fileSupport.type === "text") {
          // Text files get inlined as extra text content
          const textContent = buffer.toString("utf-8");
          parts.push({
            type: "text",
            text: ` \n\n[Content from file: ${file.name}]\n${textContent}\n[End of file content]\n`,
          });
        }
      }

      userMessageContent = parts;
    } else {
      // Plain text message
      userMessageContent = message;
    }

    // Save user message to DB (store metadata if files)
    const dbMessageContent =
      files.length > 0
        ? JSON.stringify({
            text: message,
            files: fileMetadata,
          })
        : message;

    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: dbMessageContent,
      model: null,
      tokensUsed: null,
    });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    const messageCount = history.length;
    const isFirstMessage = messageCount === 1;

    function getAIModel(config: NonNullable<typeof modelConfig>) {
      if (isImageRequest && config.provider === "google") {
        // Image generation model
        return google("imagen-3.0-generate-001");
      }

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

    // Auto-title only on first user message
    if (isFirstMessage) {
      try {
        const titleModel = getAIModel(modelConfig);

        const titleGen = await streamText({
          model: titleModel,
          messages: [
            {
              role: "user" as const,
              content: `Generate a very short 3-word title for this message. Output ONLY the title, nothing else: "${message}"`,
            },
          ],
        });

        let generatedTitle = "";
        for await (const chunk of titleGen.textStream) {
          generatedTitle += chunk;
        }

        generatedTitle = generatedTitle.replace(/['"]/g, "").trim();

        if (generatedTitle.length > 30) {
          generatedTitle = generatedTitle.substring(0, 27) + "...";
        }

        if (generatedTitle) {
          await db
            .update(conversations)
            .set({ title: generatedTitle })
            .where(eq(conversations.id, conversationId));
        }
      } catch (titleError) {
        console.error("Error generating title:", titleError);
      }
    }

    // Format history messages: ALWAYS string content for SDK
    const formattedHistory = history.slice(0, -1).map((m) => {
      let textContent: unknown = m.content ?? "";

      // Try to unwrap JSON { text, files } structure
      if (typeof textContent === "string") {
        try {
          const parsed = JSON.parse(textContent);
          if (parsed && typeof parsed.text === "string") {
            textContent = parsed.text;
          }
        } catch {
          // Not JSON, keep as is
        }
      }

      if (typeof textContent !== "string") {
        textContent = JSON.stringify(textContent);
      }

      return {
        role: m.role as "user" | "assistant",
        content: textContent as string,
      };
    });

    console.log("=== Debug Info ===");
    console.log("Files count:", files.length);
    console.log("History messages:", formattedHistory.length);
    console.log("Is image request:", isImageRequest);
    console.log("Current message type:", typeof userMessageContent);
    console.log(
      "Current message is array:",
      Array.isArray(userMessageContent),
    );

    for (let i = 0; i < formattedHistory.length; i++) {
      const msg = formattedHistory[i];
      if (typeof msg.content !== "string") {
        console.error(
          `ERROR: History message ${i} has non-string content:`,
          typeof msg.content,
        );
      }
    }

    const selectedModel = getAIModel(modelConfig);

    // Final messages passed to AI SDK
    const finalMessages: any[] = [
      ...formattedHistory,
      {
        role: "user" as const,
        content: userMessageContent, // string OR array of valid content parts
      },
    ];

    const tools: Record<string, any> = {};

    if (modelConfig.provider === "google" && !isImageRequest) {
      tools.google_search = google.tools.googleSearch({});

      if (urls.length > 0) {
        tools.url_context = google.tools.urlContext({});
      }
    }

    const streamConfig: any = {
      model: selectedModel,
      messages: finalMessages,
    };

    if (!isImageRequest && Object.keys(tools).length > 0) {
      streamConfig.tools = tools;
    }

    if (isImageRequest && modelConfig.provider === "google") {
      streamConfig.experimental_generateImage = true;
    }

    console.log("Calling AI with config:", {
      model: model,
      messageCount: finalMessages.length,
      hasTools: Object.keys(tools).length > 0,
      isImageGen: isImageRequest,
    });

    // Special handling for Perplexity to get sources
    if (modelConfig.provider === "perplexity") {
      const { text, sources } = await generateText({
        model: selectedModel,
        messages: finalMessages,
      });

      let fullText = text;

      // Append sources to the response
      if (sources && sources.length > 0) {
        fullText += "\n\n*Sources:*\n";
        sources.forEach((source, index) => {
          if (source.type === "source" && source.sourceType === "url") {
            const title = source.title || source.url;
            fullText += `${index + 1}. [${title}](${source.url})\n`;
          }
        });
      }

      // Save to database
      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: fullText,
        model: model,
        tokensUsed: null,
      });

      // Stream the complete response with sources
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(fullText));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const response = await streamText(streamConfig);

    let full = "";
    const finalConversationId = conversationId;
    const finalModel = model;
    const finalProvider = modelConfig.provider;
    const supportsTokenUsage = modelConfig.supportsTokenUsage;
    const userId = session.user.id;

    // Background task to collect full text, handle attachments & save to DB
    (async () => {
      try {
        for await (const chunk of response.textStream) {
          full += chunk;
        }

        console.log("Full response received, length:", full.length);

        const responseData = await response.response;

        if (responseData && "experimental_attachments" in responseData) {
          const attachments = (responseData as any).experimental_attachments || [];

          console.log("Attachments found:", attachments.length);

          for (const attachment of attachments) {
            if (attachment.contentType?.startsWith("image/")) {
              const base64Data = attachment.content;
              full +=` \n\n![Generated Image](data:${attachment.contentType};base64,${base64Data})\n`;
            }
          }
        }

        const usage = await response.usage;
        const totalTokens = supportsTokenUsage ? usage?.totalTokens || 0 : 0;

        await db.insert(messages).values({
          conversationId: finalConversationId,
          role: "assistant",
          content: full,
          model: finalModel,
          tokensUsed: totalTokens,
        });

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
        console.error("Error in response processing:", error);
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