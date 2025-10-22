import { pgTable, uuid, text, timestamp, numeric, pgEnum, index, uniqueIndex, check, boolean } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Enums
export const enrichmentStatusEnum = pgEnum('enrichment_status', ['stub', 'partial', 'full']);
export const scopeEnum = pgEnum('scope', ['global', 'workspace']);
export const sourceEnum = pgEnum('source', ['scrape', 'user']);

// Workspaces table
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Workspace overrides for competitor visibility/preferences
export const competitorEdgeOverrides = pgTable('competitor_edge_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  competitorId: uuid('competitor_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  hidden: boolean('hidden').default(false).notNull(),
  pinned: boolean('pinned').default(false).notNull(),
  createdByUserId: text('created_by_user_id'),
  updatedByUserId: text('updated_by_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uq: uniqueIndex('uq_competitor_edge_override').on(table.companyId, table.competitorId, table.workspaceId),
  companyIdx: index('idx_competitor_edge_overrides_company').on(table.companyId),
  competitorIdx: index('idx_competitor_edge_overrides_competitor').on(table.competitorId),
  workspaceIdx: index('idx_competitor_edge_overrides_workspace').on(table.workspaceId),
}));

// Workspace members table
export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).default('member'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: { columns: [table.workspaceId, table.userId] },
}));

// Companies table
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  canonicalDomain: text('canonical_domain').notNull().unique(),
  logo: text('logo'),
  favicon: text('favicon'),
  primaryLanguage: text('primary_language'),
  businessType: text('business_type'),
  marketSegment: text('market_segment'),
  targetCustomers: text('target_customers'),
  primaryMarkets: text('primary_markets').array(),
  technologies: text('technologies').array(),
  businessModel: text('business_model'),
  confidenceScore: numeric('confidence_score', { precision: 4, scale: 2 }).default('0'),
  enrichmentStatus: enrichmentStatusEnum('enrichment_status').default('stub'),
  lastRefreshedAt: timestamp('last_refreshed_at'),
  nextRefreshAt: timestamp('next_refresh_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  domainIdx: uniqueIndex('idx_companies_domain').on(table.canonicalDomain),
}));

// Company locales table
export const companyLocales = pgTable('company_locales', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  locale: text('locale').notNull(),
  title: text('title'),
  description: text('description'),
  keywords: text('keywords').array(),
  mainContent: text('main_content'),
  mainProducts: text('main_products').array(),
  ogImage: text('og_image'),
  favicon: text('favicon'),
  ogTitle: text('og_title'),
  ogDescription: text('og_description'),
  metaKeywords: text('meta_keywords').array(),
  rawMetadata: text('raw_metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  companyIdx: index('idx_company_locales_company').on(table.companyId),
  uniqueCompanyLocale: uniqueIndex('company_locales_company_id_locale_key').on(table.companyId, table.locale),
}));

// Company URLs table
export const companyUrls = pgTable('company_urls', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  url: text('url').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  companyIdx: index('idx_company_urls_company').on(table.companyId),
}));

// Scrape snapshots table
export const scrapeSnapshots = pgTable('scrape_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  locale: text('locale'),
  sourceUrl: text('source_url').notNull(),
  raw: text('raw').notNull(),
  etag: text('etag'),
  fetchedAt: timestamp('fetched_at').defaultNow(),
}, (table) => ({
  companyTimeIdx: index('idx_snapshots_company_time').on(table.companyId, table.fetchedAt),
}));

// Competitor edges table
export const competitorEdges = pgTable('competitor_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  competitorId: uuid('competitor_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  competitionScore: numeric('competition_score', { precision: 4, scale: 2 }).notNull(),
  source: sourceEnum('source').notNull(),
  scope: scopeEnum('scope').notNull().default('global'),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  createdByUserId: text('created_by_user_id'),
  updatedByUserId: text('updated_by_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  companyIdx: index('idx_competitor_edges_company').on(table.companyId),
  competitorIdx: index('idx_competitor_edges_competitor').on(table.competitorId),
  uniqueScope: uniqueIndex('uq_competitor_edge_scope').on(
    table.companyId, 
    table.competitorId, 
    table.scope,
    // Use a default UUID for global scope to ensure uniqueness
    table.workspaceId
  ),
  scopeConsistency: check('chk_scope_consistency', 
    sql`(scope = 'global' AND workspace_id IS NULL) OR (scope = 'workspace' AND workspace_id IS NOT NULL)`
  ),
  sourceScope: check('chk_source_scope',
    sql`(source = 'scrape' AND scope = 'global') OR (source = 'user' AND scope = 'workspace')`
  ),
}));

// Brand aliases table - simplified to point directly to companies
export const brandAliases = pgTable('brand_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  companyIdx: index('idx_brand_aliases_company').on(table.companyId),
  uniqueAlias: uniqueIndex('uq_brand_aliases_company_alias').on(table.companyId, table.alias),
}));

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  competitorEdges: many(competitorEdges),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  locales: many(companyLocales),
  urls: many(companyUrls),
  snapshots: many(scrapeSnapshots),
  competitorEdges: many(competitorEdges),
  competitorOf: many(competitorEdges, { relationName: 'competitor' }),
  brandAliases: many(brandAliases),
}));

export const companyLocalesRelations = relations(companyLocales, ({ one }) => ({
  company: one(companies, {
    fields: [companyLocales.companyId],
    references: [companies.id],
  }),
}));

export const companyUrlsRelations = relations(companyUrls, ({ one }) => ({
  company: one(companies, {
    fields: [companyUrls.companyId],
    references: [companies.id],
  }),
}));

export const scrapeSnapshotsRelations = relations(scrapeSnapshots, ({ one }) => ({
  company: one(companies, {
    fields: [scrapeSnapshots.companyId],
    references: [companies.id],
  }),
}));

export const competitorEdgesRelations = relations(competitorEdges, ({ one }) => ({
  company: one(companies, {
    fields: [competitorEdges.companyId],
    references: [companies.id],
    relationName: 'company',
  }),
  competitor: one(companies, {
    fields: [competitorEdges.competitorId],
    references: [companies.id],
    relationName: 'competitor',
  }),
  workspace: one(workspaces, {
    fields: [competitorEdges.workspaceId],
    references: [workspaces.id],
  }),
}));

export const brandAliasesRelations = relations(brandAliases, ({ one }) => ({
  company: one(companies, {
    fields: [brandAliases.companyId],
    references: [companies.id],
  }),
}));

// Export types
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type CompanyLocale = typeof companyLocales.$inferSelect;
export type NewCompanyLocale = typeof companyLocales.$inferInsert;

export type CompanyUrl = typeof companyUrls.$inferSelect;
export type NewCompanyUrl = typeof companyUrls.$inferInsert;

export type ScrapeSnapshot = typeof scrapeSnapshots.$inferSelect;
export type NewScrapeSnapshot = typeof scrapeSnapshots.$inferInsert;

export type CompetitorEdge = typeof competitorEdges.$inferSelect;
export type NewCompetitorEdge = typeof competitorEdges.$inferInsert;

export type BrandAlias = typeof brandAliases.$inferSelect;
export type NewBrandAlias = typeof brandAliases.$inferInsert;