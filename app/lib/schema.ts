import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

//
// ------------------------------------------------------------------
// TOKEN LIMIT CONFIG (SAFE – NOT RELATED TO THE ERROR)
// ------------------------------------------------------------------
//
export const TOKEN_LIMITS = {
  free: {
    dailyTokens: 5000,
    maxOutputTokens: 150,
    alertThresholds: [1000, 500, 200],
  },
  pro: {
    dailyTokens: 75000,
    maxOutputTokens: 500,
    alertThresholds: [15000, 7500, 2500],
  },
  "pro-max": {
    dailyTokens: 250000,
    maxOutputTokens: 800,
    alertThresholds: [50000, 25000, 10000],
  },
} as const;

type SubscriptionTier = keyof typeof TOKEN_LIMITS;

//
// ------------------------------------------------------------------
// CORE AUTH TABLES
// ------------------------------------------------------------------
//
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Token tracking
  tokensUsedToday: integer("tokens_used_today").notNull().default(0),
  tokenResetAt: timestamp("token_reset_at").notNull().defaultNow(),

  subscriptionTier: text("subscription_tier")
    .notNull()
    .default("free"),

  lastTokenAlert: integer("last_token_alert"),
  maxOutputTokens: integer("max_output_tokens").notNull().default(150),
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
// ------------------------------------------------------------------
// APP TABLES
// ------------------------------------------------------------------
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
  role: text("role"), // user | assistant
  content: text("content"),

  attachments: jsonb("attachments").$type<
    Array<{
      name: string;
      type: string;
      size: number;
      url?: string;
    }>
  >(),

  model: text("model").notNull().default("gemini-2.5-flash"),
  tokensUsed: integer("tokens_used").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

export const tokenUsageLog = pgTable("token_usage_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  messageId: text("message_id").references(() => messages.id, {
    onDelete: "set null",
  }),
  tokensUsed: integer("tokens_used").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  remainingTokens: integer("remaining_tokens").notNull(),
  dailyLimit: integer("daily_limit").notNull().default(5000),
  subscriptionTier: text("subscription_tier")
    .notNull()
    .default("free"),

  action: text("action").notNull(),
  maxOutputTokensUsed: integer("max_output_tokens_used").notNull().default(150),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

//
// ------------------------------------------------------------------
// RELATIONS (DEFINED LAST – THIS FIXES THE ERROR)
// ------------------------------------------------------------------
//
export const userRelations = relations(user, ({ many }) => ({
  conversations: many(conversations),
  tokenLogs: many(tokenUsageLog),
  sessions: many(session),
  accounts: many(account),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(user, {
    fields: [conversations.userId],
    references: [user.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const tokenUsageLogRelations = relations(tokenUsageLog, ({ one }) => ({
  user: one(user, {
    fields: [tokenUsageLog.userId],
    references: [user.id],
  }),
  message: one(messages, {
    fields: [tokenUsageLog.messageId],
    references: [messages.id],
  }),
}));

//
// ------------------------------------------------------------------
// TYPE EXPORTS
// ------------------------------------------------------------------
//
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert & {
  subscriptionTier: SubscriptionTier;
  maxOutputTokens?: number;
};

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

export type TokenUsageLog = typeof tokenUsageLog.$inferSelect;
export type NewTokenUsageLog = typeof tokenUsageLog.$inferInsert;

export type FileAttachment = {
  name: string;
  type: string;
  size: number;
  url?: string;
};

//
// ------------------------------------------------------------------
// UTILS
// ------------------------------------------------------------------
//
export function getTokenLimits(tier: SubscriptionTier) {
  return TOKEN_LIMITS[tier];
}