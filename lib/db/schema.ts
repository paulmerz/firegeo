import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['user', 'assistant']);
export const themeEnum = pgEnum('theme', ['light', 'dark']);

// User Profile table - extends Better Auth user with additional fields
export const userProfile = pgTable('user_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// Conversations table - stores chat threads
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  title: text('title'),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// Messages table - stores individual chat messages
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: roleEnum('role').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Message Feedback table - for rating AI responses
export const messageFeedback = pgTable('message_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  rating: integer('rating'), // 1-5
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow(),
});

// User Settings table - app-specific preferences
export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  theme: themeEnum('theme').default('light'),
  emailNotifications: boolean('email_notifications').default(true),
  marketingEmails: boolean('marketing_emails').default(false),
  defaultModel: text('default_model').default('gpt-3.5-turbo'),
  metadata: jsonb('metadata'), // For any additional settings
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// Define relations without user table reference
export const userProfileRelations = relations(userProfile, ({ many }) => ({
  conversations: many(conversations),
  brandAnalyses: many(brandAnalyses),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  userProfile: one(userProfile, {
    fields: [conversations.userId],
    references: [userProfile.userId],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  feedback: many(messageFeedback),
}));

export const messageFeedbackRelations = relations(messageFeedback, ({ one }) => ({
  message: one(messages, {
    fields: [messageFeedback.messageId],
    references: [messages.id],
  }),
}));

// Brand Monitor Analyses
export const brandAnalyses = pgTable('brand_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  url: text('url').notNull(),
  companyName: text('company_name'),
  industry: text('industry'),
  analysisData: jsonb('analysis_data'), // Stores the full analysis results
  competitors: jsonb('competitors'), // Stores competitor data
  prompts: jsonb('prompts'), // Stores the prompts used
  creditsUsed: integer('credits_used').default(10),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// Brand Analysis Sources table - stores individual sources extracted from analyses
export const brandAnalysisSources = pgTable('brand_analysis_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisId: uuid('analysis_id').notNull().references(() => brandAnalyses.id, { onDelete: 'cascade' }),
  provider: text('provider'),
  prompt: text('prompt'),
  domain: text('domain'),
  url: text('url'),
  sourceType: text('source_type').default('web_search'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});


// Relations
export const brandAnalysesRelations = relations(brandAnalyses, ({ one, many }) => ({
  userProfile: one(userProfile, {
    fields: [brandAnalyses.userId],
    references: [userProfile.userId],
  }),
  sources: many(brandAnalysisSources),
}));


export const brandAnalysisSourcesRelations = relations(brandAnalysisSources, ({ one }) => ({
  analysis: one(brandAnalyses, {
    fields: [brandAnalysisSources.analysisId],
    references: [brandAnalyses.id],
  }),
}));

// Type exports for use in application
export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageFeedback = typeof messageFeedback.$inferSelect;
export type NewMessageFeedback = typeof messageFeedback.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type BrandAnalysis = typeof brandAnalyses.$inferSelect;
export type NewBrandAnalysis = typeof brandAnalyses.$inferInsert;

export type BrandAnalysisSource = typeof brandAnalysisSources.$inferSelect;

export type NewBrandAnalysisSource = typeof brandAnalysisSources.$inferInsert;
export type BrandAnalysisWithSources = BrandAnalysis & {
  sources: BrandAnalysisSource[];
};
