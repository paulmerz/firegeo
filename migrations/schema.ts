import { pgTable, uniqueIndex, unique, uuid, text, numeric, timestamp, foreignKey, integer, boolean, jsonb, index, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const enrichmentStatus = pgEnum("enrichment_status", ['stub', 'partial', 'full'])
export const metricType = pgEnum("metric_type", ['visibility_score', 'mentions', 'average_position', 'sentiment_score', 'position', 'share_of_voices', 'visibility_average', 'average_score'])
export const periodicity = pgEnum("periodicity", ['none', 'daily', 'weekly', 'monthly'])
export const role = pgEnum("role", ['user', 'assistant'])
export const runStatus = pgEnum("run_status", ['pending', 'running', 'completed', 'failed', 'insufficient_credits'])
export const scope = pgEnum("scope", ['global', 'workspace'])
export const source = pgEnum("source", ['scrape', 'user'])
export const theme = pgEnum("theme", ['light', 'dark'])


export const companies = pgTable("companies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	url: text().notNull(),
	canonicalDomain: text("canonical_domain").notNull(),
	logo: text(),
	favicon: text(),
	primaryLanguage: text("primary_language"),
	businessType: text("business_type"),
	marketSegment: text("market_segment"),
	targetCustomers: text("target_customers"),
	primaryMarkets: text("primary_markets").array(),
	technologies: text().array(),
	businessModel: text("business_model"),
	confidenceScore: numeric("confidence_score", { precision: 4, scale:  2 }).default('0'),
	enrichmentStatus: enrichmentStatus("enrichment_status").default('stub'),
	lastRefreshedAt: timestamp("last_refreshed_at", { mode: 'string' }),
	nextRefreshAt: timestamp("next_refresh_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("idx_companies_domain").using("btree", table.canonicalDomain.asc().nullsLast().op("text_ops")),
	unique("companies_name_unique").on(table.name),
	unique("companies_canonical_domain_unique").on(table.canonicalDomain),
]);

export const workspaces = pgTable("workspaces", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const conversations = pgTable("conversations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	title: text(),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const messages = pgTable("messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversationId: uuid("conversation_id").notNull(),
	userId: text("user_id").notNull(),
	role: role().notNull(),
	content: text().notNull(),
	tokenCount: integer("token_count"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
]);

export const messageFeedback = pgTable("message_feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	messageId: uuid("message_id").notNull(),
	userId: text("user_id").notNull(),
	rating: integer(),
	feedback: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_feedback_message_id_messages_id_fk"
		}).onDelete("cascade"),
]);

export const userProfile = pgTable("user_profile", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	displayName: text("display_name"),
	avatarUrl: text("avatar_url"),
	bio: text(),
	phone: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("user_profile_user_id_unique").on(table.userId),
]);

export const userSettings = pgTable("user_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	theme: theme().default('light'),
	emailNotifications: boolean("email_notifications").default(true),
	marketingEmails: boolean("marketing_emails").default(false),
	defaultModel: text("default_model").default('gpt-3.5-turbo'),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("user_settings_user_id_unique").on(table.userId),
]);

export const workspaceMembers = pgTable("workspace_members", {
	workspaceId: uuid("workspace_id").notNull(),
	userId: text("user_id").notNull(),
	role: text().default('member'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_members_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
]);

export const scrapeSnapshots = pgTable("scrape_snapshots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	locale: text(),
	sourceUrl: text("source_url").notNull(),
	raw: text().notNull(),
	etag: text(),
	fetchedAt: timestamp("fetched_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_snapshots_company_time").using("btree", table.companyId.asc().nullsLast().op("timestamp_ops"), table.fetchedAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "scrape_snapshots_company_id_companies_id_fk"
		}).onDelete("cascade"),
]);

export const competitorEdges = pgTable("competitor_edges", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	competitorId: uuid("competitor_id").notNull(),
	competitionScore: numeric("competition_score", { precision: 4, scale:  2 }).notNull(),
	source: source().notNull(),
	scope: scope().default('global').notNull(),
	workspaceId: uuid("workspace_id"),
	createdByUserId: text("created_by_user_id"),
	updatedByUserId: text("updated_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_competitor_edges_company").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_competitor_edges_competitor").using("btree", table.competitorId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("uq_competitor_edge_scope").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.competitorId.asc().nullsLast().op("uuid_ops"), table.scope.asc().nullsLast().op("uuid_ops"), table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "competitor_edges_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.competitorId],
			foreignColumns: [companies.id],
			name: "competitor_edges_competitor_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "competitor_edges_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
	check("chk_scope_consistency", sql`((scope = 'global'::scope) AND (workspace_id IS NULL)) OR ((scope = 'workspace'::scope) AND (workspace_id IS NOT NULL))`),
	check("chk_source_scope", sql`((source = 'scrape'::source) AND (scope = 'global'::scope)) OR ((source = 'user'::source) AND (scope = 'workspace'::scope))`),
]);

export const competitorEdgeOverrides = pgTable("competitor_edge_overrides", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	competitorId: uuid("competitor_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	hidden: boolean().default(false).notNull(),
	pinned: boolean().default(false).notNull(),
	createdByUserId: text("created_by_user_id"),
	updatedByUserId: text("updated_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_competitor_edge_overrides_company").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_competitor_edge_overrides_competitor").using("btree", table.competitorId.asc().nullsLast().op("uuid_ops")),
	index("idx_competitor_edge_overrides_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("uq_competitor_edge_override").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.competitorId.asc().nullsLast().op("uuid_ops"), table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "competitor_edge_overrides_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.competitorId],
			foreignColumns: [companies.id],
			name: "competitor_edge_overrides_competitor_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "competitor_edge_overrides_workspace_id_workspaces_id_fk"
		}).onDelete("cascade"),
]);

export const companyLocales = pgTable("company_locales", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	locale: text().notNull(),
	title: text(),
	description: text(),
	keywords: text().array(),
	mainContent: text("main_content"),
	mainProducts: text("main_products").array(),
	ogImage: text("og_image"),
	favicon: text(),
	ogTitle: text("og_title"),
	ogDescription: text("og_description"),
	metaKeywords: text("meta_keywords").array(),
	rawMetadata: text("raw_metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("company_locales_company_id_locale_key").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.locale.asc().nullsLast().op("text_ops")),
	index("idx_company_locales_company").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_locales_company_id_companies_id_fk"
		}).onDelete("cascade"),
]);

export const brandAnalysisRuns = pgTable("brand_analysis_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	brandAnalysisId: uuid("brand_analysis_id").notNull(),
	status: runStatus().default('pending'),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	creditsUsed: integer("credits_used"),
	errorMessage: text("error_message"),
	retryCount: integer("retry_count").default(0),
	analysisData: jsonb("analysis_data"),
	visibilityScore: numeric("visibility_score", { precision: 10, scale: 2 }),
	competitorsCount: integer("competitors_count"),
	promptsCount: integer("prompts_count"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.brandAnalysisId],
			foreignColumns: [brandAnalysis.id],
			name: "brand_analysis_runs_brand_analysis_id_brand_analysis_id_fk"
		}).onDelete("cascade"),
]);

export const companyUrls = pgTable("company_urls", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	url: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_company_urls_company").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_urls_company_id_companies_id_fk"
		}).onDelete("cascade"),
	unique("company_urls_url_unique").on(table.url),
]);

export const brandAliases = pgTable("brand_aliases", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	alias: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_brand_aliases_company").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("uq_brand_aliases_company_alias").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.alias.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "brand_aliases_company_id_companies_id_fk"
		}).onDelete("cascade"),
]);

export const brandAnalysisSources = pgTable("brand_analysis_sources", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	analysisId: uuid("analysis_id"),
	provider: text(),
	prompt: text(),
	domain: text(),
	url: text(),
	sourceType: text("source_type").default('web_search'),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	runId: uuid("run_id"),
	title: text(),
}, (table) => [
	foreignKey({
			columns: [table.analysisId],
			foreignColumns: [brandAnalysis.id],
			name: "brand_analysis_sources_analysis_id_brand_analysis_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [brandAnalysisRuns.id],
			name: "brand_analysis_sources_run_id_brand_analysis_runs_id_fk"
		}).onDelete("cascade"),
]);

export const brandAnalysis = pgTable("brand_analysis", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	competitors: jsonb(),
	prompts: jsonb(),
	creditsUsed: integer("credits_used").default(10),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	workspaceId: uuid("workspace_id"),
	periodicity: periodicity().default('none'),
	isScheduled: boolean("is_scheduled").default(false),
	nextRunAt: timestamp("next_run_at", { withTimezone: true, mode: 'string' }),
	lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: 'string' }),
	schedulePaused: boolean("schedule_paused").default(false),
	companyId: uuid("company_id").notNull(),
	analysisName: text("analysis_name").default('Analyse'),
}, (table) => [
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "brand_analysis_workspace_id_workspaces_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "brand_analysis_company_id_companies_id_fk"
		}),
]);

export const brandAnalysisMetricEvents = pgTable("brand_analysis_metric_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	runId: uuid("run_id").notNull(),
	brandAnalysisId: uuid("brand_analysis_id").notNull(),
	competitorName: text("competitor_name").notNull(),
	provider: text().notNull(),
	metricType: metricType("metric_type").notNull(),
	metricValue: numeric("metric_value", { precision: 10, scale:  2 }).notNull(),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.runId],
			foreignColumns: [brandAnalysisRuns.id],
			name: "brand_analysis_metric_events_run_id_brand_analysis_runs_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.brandAnalysisId],
			foreignColumns: [brandAnalysis.id],
			name: "brand_analysis_metric_events_brand_analysis_id_brand_analysis_i"
		}).onDelete("cascade"),
]);
