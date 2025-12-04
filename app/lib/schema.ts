// lib/schema.ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

//
// --- Token Limits Configuration (Gemini only - Perplexity doesn't return token usage) ---
//
export const TOKEN_LIMITS = {
  gemini: {
    dailyTokens: 1_000_000, // 1M tokens per day
    dailyRequests: 100,
  },
} as const;

//
// --- Better Auth required tables ---
//
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Token tracking (Gemini only)
  tokensUsedGemini: integer("tokens_used_gemini").notNull().default(0),
  requestsUsedGemini: integer("requests_used_gemini").notNull().default(0),
  tokenResetAt: timestamp("token_reset_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

//
// --- App tables ---
//
export const conversations = pgTable("conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id").references(() => conversations.id, {
    onDelete: "cascade",
  }),
  role: text("role"), // user / assistant
  
  // Content field can store:
  // 1. Plain text string
  // 2. JSON string with format: { text: string, files: Array<{name, type, size}> }
  content: text("content"),
  
  // Optional: Separate column for file attachments metadata
  // This makes it easier to query messages with attachments
  // Type: Array<{ name: string, type: string, size: number, url?: string }>
  attachments: jsonb("attachments").$type<
    Array<{
      name: string;
      type: string;
      size: number;
      url?: string; // Optional: if storing files in Supabase Storage
    }>
  >(),
  
  model: text("model"), // gemini / perplexity / groq
  tokensUsed: integer("tokens_used"), // tokens consumed by this message
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports for TypeScript
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// Helper type for file attachments
export type FileAttachment = {
  name: string;
  type: string;
  size: number;
  url?: string;
};