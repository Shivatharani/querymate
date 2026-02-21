import { db } from "@/lib/lib";
import {
  messages,
  conversations,
  user,
  tokenUsageLog,
  TOKEN_LIMITS,
} from "@/lib/schema";
import { streamText, generateText } from "ai";
import { gemini } from "@/lib/ai-gemini";
import { perplexity } from "@/lib/ai-perplexity";
import { groq } from "@/lib/ai-groq";
import { google } from "@ai-sdk/google";
import { getModel } from "@/lib/models";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-middleware";
import { Buffer } from "buffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkAndResetDailyTokens(userId: string) {
  const [userData] = await db.select().from(user).where(eq(user.id, userId));
  if (!userData) return null;

  const now = new Date();
  const resetAt = new Date(userData.tokenResetAt as Date);

  if (
    now.getDate() !== resetAt.getDate() ||
    now.getMonth() !== resetAt.getMonth() ||
    now.getFullYear() !== resetAt.getFullYear()
  ) {
    await db
      .update(user)
      .set({
        tokensUsedToday: 0,
        tokenResetAt: now,
        lastTokenAlert: null,
      })
      .where(eq(user.id, userId));

    return {
      ...userData,
      tokensUsedToday: 0,
      tokenResetAt: now,
      lastTokenAlert: null,
    };
  }

  return userData;
}

function checkTokenLimits(userData: {
  tokensUsedToday: number;
  subscriptionTier: string;
}): { exceeded: boolean; message: string } {
  const tier = userData.subscriptionTier as keyof typeof TOKEN_LIMITS;
  const limit = TOKEN_LIMITS[tier]?.dailyTokens || TOKEN_LIMITS.free.dailyTokens;

  if (userData.tokensUsedToday >= limit) {
    return {
      exceeded: true,
      message: `Daily token limit reached (${limit.toLocaleString()} tokens). Upgrade to continue or wait until tomorrow.`,
    };
  }

  return { exceeded: false, message: "" };
}

function supportsMultimodal(provider: string): boolean {
  return provider === "google" || provider === "groq";
}

function getFileSupport(
  mimeType: string,
  provider: string,
): {
  supported: boolean;
  type: "image" | "pdf" | "text" | "audio" | "document" | "unsupported";
} {
  if (mimeType.startsWith("image/")) return { supported: true, type: "image" };

  if (mimeType === "application/pdf" && provider === "google")
    return { supported: true, type: "pdf" };

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

  if (mimeType === "text/plain" || mimeType.startsWith("text/"))
    return { supported: true, type: "text" };

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
    const message = (formData.get("message") as string) || "";
    const title = formData.get("title") as string | null;
    const model = (formData.get("model") as string) || "gemini-2.5-flash";
    const useCanvas = formData.get("useCanvas") === "true";

    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        files.push(value);
      }
    }

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
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

    const limitCheck = checkTokenLimits(userData as any);
    if (limitCheck.exceeded) {
      return NextResponse.json(
        { error: limitCheck.message, code: "TOKENS_EXHAUSTED" },
        { status: 429 },
      );
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

    const fileMetadata: Array<{ name: string; type: string; size: number }> = [];

    let userMessageContent:
      | string
      | Array<
          | { type: "text"; text: string }
          | {
              type: "image";
              image: string | ArrayBuffer | Uint8Array | Buffer;
              mediaType?: string;
            }
          | {
              type: "file";
              mediaType: string;
              data: string | ArrayBuffer | Uint8Array | Buffer;
              filename?: string;
            }
        >;

    // Build multimodal content
    if (files.length > 0) {
      const parts: any[] = [];
      parts.push({ type: "text", text: message });

      for (const file of files) {
        const mimeType = file.type;
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileSupport = getFileSupport(mimeType, modelConfig.provider);

        fileMetadata.push({ name: file.name, type: mimeType, size: file.size });

        if (fileSupport.type === "image") {
          parts.push({
            type: "image",
            image: buffer, // Buffer is OK (Uint8Array-compatible)
            mediaType: mimeType,
          });
        } else if (
          fileSupport.type === "pdf" ||
          fileSupport.type === "document" ||
          fileSupport.type === "audio"
        ) {
          // Only Gemini path reaches here because of getFileSupport/provider checks
          parts.push({
            type: "file",
            mediaType: mimeType,
            data: buffer,
            filename: file.name,
          });
        } else if (fileSupport.type === "text") {
          const textContent = buffer.toString("utf-8");
          parts.push({
            type: "text",
            text: `\n\n[Content from file: ${file.name}]\n${textContent}\n[End of file content]\n`,
          });
        }
      }

      userMessageContent = parts;
    } else {
      userMessageContent = message;
    }

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
      model: "user-input",
      tokensUsed: 0,
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

    // Title generation (first message only)
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

    const formattedHistory = history.slice(0, -1).map((m) => {
      let textContent: unknown = m.content ?? "";

      if (typeof textContent === "string") {
        try {
          const parsed = JSON.parse(textContent);
          if (parsed && typeof parsed.text === "string") {
            textContent = parsed.text;
          }
        } catch {
          // Not JSON
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

    const selectedModel = getAIModel(modelConfig);

    // Canvas mode system prompt - instructs AI to generate complete, standalone code
    const canvasSystemPrompt = useCanvas
      ? `You are in Canvas Mode. When generating code:

1. ALWAYS provide a SINGLE, COMPLETE, SELF-CONTAINED code block that can run immediately
2. Include ALL necessary code in ONE code block - no separate files
3. For React components: use Tailwind CSS classes for styling (it is available)
4. DO NOT split code across multiple blocks - everything must be in one block
5. Include all imports, component definitions, and exports in the same block
6. For web apps: create a single component function named 'App' and add \`export default App;\` at the end
7. Use React hooks directly: useState, useEffect, useCallback, useRef are available via import from 'react'
8. Keep explanations brief - focus on providing working, runnable code
9. For Python: include all necessary imports and make the code self-contained
10. The code should be ready to execute without any modifications

CRITICAL - DEPENDENCY DECLARATION:
If your code uses ANY npm packages beyond react and react-dom, you MUST add a comment on the VERY FIRST LINE of your code block listing them:
// DEPENDENCIES: package-name1, package-name2, package-name3

For example if using framer-motion and lucide-react:
// DEPENDENCIES: framer-motion, lucide-react

This is REQUIRED for the preview system to install the correct packages. Always include ALL external packages used in imports.

Example format for React:
\\\`\\\`\\\`jsx
// DEPENDENCIES: framer-motion
import { useState } from 'react';
import { motion } from 'framer-motion';

function App() {
  const [state, setState] = useState(initialValue);
  return (
    <div className="...">
      {/* Complete UI */}
    </div>
  );
}

export default App;
\\\`\\\`\\\`
`
      : null;


    const finalMessages: any[] = [
      ...(canvasSystemPrompt
        ? [{ role: "system" as const, content: canvasSystemPrompt }]
        : []),
      ...formattedHistory,
      { role: "user" as const, content: userMessageContent },
    ];

    // Built-in tools (enable only when NO files to avoid tool+multimodal corner cases)
    const tools: Record<string, any> = {};
    if (modelConfig.provider === "google" && !isImageRequest && files.length === 0) {
      tools.google_search = google.tools.googleSearch({});
      if (urls.length > 0) tools.url_context = google.tools.urlContext({});
    }

    const streamConfig: any = {
      model: selectedModel,
      messages: finalMessages,

      // Gemini safety settings to avoid silent blocks in vision prompts
      ...(modelConfig.provider === "google"
        ? {
            providerOptions: {
              google: {
                safetySettings: [
                  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ],
              },
            },
          }
        : {}),
    };

    if (Object.keys(tools).length > 0) {
      streamConfig.tools = tools;
    }

    if (isImageRequest && modelConfig.provider === "google") {
      streamConfig.experimental_generateImage = true;
    }

    // Perplexity special-case (non-stream with sources)
    if (modelConfig.provider === "perplexity") {
      const { text, sources } = await generateText({
        model: selectedModel,
        messages: finalMessages,
      });

      let fullText = text;

      if (sources && sources.length > 0) {
        fullText += "\n\n*Sources:*\n";
        sources.forEach((source, index) => {
          if (source.type === "source" && source.sourceType === "url") {
            const t = source.title || source.url;
            fullText += `${index + 1}. [${t}](${source.url})\n`;
          }
        });
      }

      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: fullText,
        model,
        tokensUsed: 0,
      });

      return new Response(fullText, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Debug logs (important for verifying image/file parts are included)
    console.log("🔍 chat request", {
      provider: modelConfig.provider,
      model,
      modelId: modelConfig.modelId,
      files: fileMetadata,
      toolsEnabled: Object.keys(tools).length > 0,
      lastContentType: Array.isArray(userMessageContent)
        ? userMessageContent.map((p: any) => p.type).join(",")
        : "text",
    });

    const result = await streamText(streamConfig);

    const encoder = new TextEncoder();
    let fullText = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // If image generation returns attachments, append them
          const responseData = await result.response;
          if (responseData && "experimental_attachments" in responseData) {
            const attachments = (responseData as any).experimental_attachments || [];
            for (const attachment of attachments) {
              if (attachment.contentType?.startsWith("image/")) {
                const base64Data = attachment.content;
                const md = `\n\n![Generated Image](data:${attachment.contentType};base64,${base64Data})\n`;
                fullText += md;
                controller.enqueue(encoder.encode(md));
              }
            }
          }

          controller.close();

          // Usage + DB writes after streaming finishes
          const usage = await result.usage;
          const totalTokens = modelConfig.supportsTokenUsage
            ? usage?.totalTokens || 0
            : 0;

          console.log("✅ stream done", {
            tokens: totalTokens,
            preview: fullText.slice(0, 120),
          });

          await db.insert(messages).values({
            conversationId,
            role: "assistant",
            content: fullText,
            model,
            tokensUsed: totalTokens,
          });

          // Update user's token usage (Gemini only in your current logic)
          if (modelConfig.provider === "google" && totalTokens > 0) {
            await db
              .update(user)
              .set({
                tokensUsedToday: sql`${user.tokensUsedToday} + ${totalTokens}`,
              })
              .where(eq(user.id, session.user.id));

            const [updatedUser] = await db
              .select()
              .from(user)
              .where(eq(user.id, session.user.id));

            const tier = (updatedUser?.subscriptionTier || "free") as keyof typeof TOKEN_LIMITS;
            const limit = TOKEN_LIMITS[tier]?.dailyTokens || TOKEN_LIMITS.free.dailyTokens;
            const remaining = limit - ((updatedUser?.tokensUsedToday as number) || 0);

            await db.insert(tokenUsageLog).values({
              userId: session.user.id,
              tokensUsed: totalTokens,
              remainingTokens: remaining,
              action: "message_sent",
              metadata: { model, provider: modelConfig.provider },
            });
          }
        } catch (err) {
          console.error("❌ stream error", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}