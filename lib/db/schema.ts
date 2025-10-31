import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, pgEnum, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces, companies, companyLocales, competitorEdges } from './schema/companies';

// Enums
export const roleEnum = pgEnum('role', ['user', 'assistant']);
export const themeEnum = pgEnum('theme', ['light', 'dark']);
export const periodicityEnum = pgEnum('periodicity', ['none', 'daily', 'weekly', 'monthly']);
export const runStatusEnum = pgEnum('run_status', ['pending', 'running', 'completed', 'failed', 'insufficient_credits']);
export const metricTypeEnum = pgEnum('metric_type', [
  'visibility_score',
  'mentions',
  'average_position',
  'sentiment_score',
  'position',
  'share_of_voices',
  'visibility_average',
  'average_score',
]);

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
  brandAnalysis: many(brandAnalysis),
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
export const brandAnalysis = pgTable('brand_analysis', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  companyId: uuid('company_id').notNull().references(() => companies.id), // Maintenant obligatoire
  analysisName: text('analysis_name').default('Analyse'), // Nom personnalisé de l'analyse
  competitors: jsonb('competitors'), // Stores competitor data
  prompts: jsonb('prompts'), // Stores the prompts used
  creditsUsed: integer('credits_used').default(10),
  // Scheduling columns
  periodicity: periodicityEnum('periodicity').default('none'),
  isScheduled: boolean('is_scheduled').default(false),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  schedulePaused: boolean('schedule_paused').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// Brand Analysis Sources table - stores individual sources extracted from analyses
export const brandAnalysisSources = pgTable('brand_analysis_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisId: uuid('analysis_id').references(() => brandAnalysis.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').references(() => brandAnalysisRuns.id, { onDelete: 'cascade' }),
  provider: text('provider'),
  prompt: text('prompt'),
  title: text('title'),
  domain: text('domain'),
  url: text('url'),
  sourceType: text('source_type').default('web_search'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Brand Analysis Runs table - stores execution history for scheduled analyses
export const brandAnalysisRuns = pgTable('brand_analysis_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandAnalysisId: uuid('brand_analysis_id').notNull().references(() => brandAnalysis.id, { onDelete: 'cascade' }),
  status: runStatusEnum('status').default('pending'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  creditsUsed: integer('credits_used'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  analysisData: jsonb('analysis_data'),
  visibilityScore: decimal('visibility_score', { precision: 10, scale: 2 }),
  competitorsCount: integer('competitors_count'),
  promptsCount: integer('prompts_count'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Brand Analysis Metric Events table - stores individual metric events for analytics
export const brandAnalysisMetricEvents = pgTable('brand_analysis_metric_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => brandAnalysisRuns.id, { onDelete: 'cascade' }),
  brandAnalysisId: uuid('brand_analysis_id').notNull().references(() => brandAnalysis.id, { onDelete: 'cascade' }),
  competitorName: text('competitor_name').notNull(),
  provider: text('provider').notNull(),
  metricType: metricTypeEnum('metric_type').notNull(),
  metricValue: decimal('metric_value', { precision: 10, scale: 2 }).notNull(),
  recordedAt: timestamp('recorded_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});


// Relations
export const brandAnalysisRelations = relations(brandAnalysis, ({ one, many }) => ({
  userProfile: one(userProfile, {
    fields: [brandAnalysis.userId],
    references: [userProfile.userId],
  }),
  workspace: one(workspaces, {
    fields: [brandAnalysis.workspaceId],
    references: [workspaces.id],
  }),
  company: one(companies, {
    fields: [brandAnalysis.companyId],
    references: [companies.id],
  }),
  sources: many(brandAnalysisSources),
  runs: many(brandAnalysisRuns),
}));

export const brandAnalysisSourcesRelations = relations(brandAnalysisSources, ({ one }) => ({
  analysis: one(brandAnalysis, {
    fields: [brandAnalysisSources.analysisId],
    references: [brandAnalysis.id],
  }),
  run: one(brandAnalysisRuns, {
    fields: [brandAnalysisSources.runId],
    references: [brandAnalysisRuns.id],
  }),
}));

export const brandAnalysisRunsRelations = relations(brandAnalysisRuns, ({ one, many }) => ({
  brandAnalysis: one(brandAnalysis, {
    fields: [brandAnalysisRuns.brandAnalysisId],
    references: [brandAnalysis.id],
  }),
  sources: many(brandAnalysisSources),
  metricEvents: many(brandAnalysisMetricEvents),
}));

export const brandAnalysisMetricEventsRelations = relations(brandAnalysisMetricEvents, ({ one }) => ({
  run: one(brandAnalysisRuns, {
    fields: [brandAnalysisMetricEvents.runId],
    references: [brandAnalysisRuns.id],
  }),
  brandAnalysis: one(brandAnalysis, {
    fields: [brandAnalysisMetricEvents.brandAnalysisId],
    references: [brandAnalysis.id],
  }),
}));

// Import and re-export relations from companies schema
export { 
  companiesRelations,
  companyLocalesRelations,
  companyUrlsRelations,
  scrapeSnapshotsRelations,
  brandAliasesRelations,
  competitorEdgesRelations,
  competitorEdgeOverridesRelations,
  workspacesRelations,
  workspaceMembersRelations
} from './schema/companies';

// Re-export tables from companies schema
export { 
  companies,
  workspaces,
  workspaceMembers,
  companyLocales,
  companyUrls,
  scrapeSnapshots,
  brandAliases,
  competitorEdges,
  competitorEdgeOverrides
} from './schema/companies';

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
export type BrandAnalysis = typeof brandAnalysis.$inferSelect;
export type NewBrandAnalysis = typeof brandAnalysis.$inferInsert;

export type BrandAnalysisSource = typeof brandAnalysisSources.$inferSelect;
export type NewBrandAnalysisSource = typeof brandAnalysisSources.$inferInsert;

export type BrandAnalysisRun = typeof brandAnalysisRuns.$inferSelect;
export type NewBrandAnalysisRun = typeof brandAnalysisRuns.$inferInsert;

export type BrandAnalysisMetricEvent = typeof brandAnalysisMetricEvents.$inferSelect;
export type NewBrandAnalysisMetricEvent = typeof brandAnalysisMetricEvents.$inferInsert;

export type BrandAnalysisWithSources = BrandAnalysis & {
  sources: BrandAnalysisSource[];
};

export type BrandAnalysisWithRuns = BrandAnalysis & {
  runs: BrandAnalysisRun[];
};

export type BrandAnalysisRunWithSources = BrandAnalysisRun & {
  sources: BrandAnalysisSource[];
};

export type BrandAnalysisWithCompany = BrandAnalysis & {
  company: typeof companies.$inferSelect;
};

export type BrandAnalysisWithSourcesAndCompany = BrandAnalysisWithSources & {
  company: typeof companies.$inferSelect & {
    locales: Array<typeof companyLocales.$inferSelect>;
  };
};

// Export specific company-related types that are needed
export type { 
  Company, 
  NewCompany, 
  CompanyLocale, 
  NewCompanyLocale,
  CompetitorEdge,
  NewCompetitorEdge,
  Workspace,
  NewWorkspace
} from './schema/companies';