import { relations } from "drizzle-orm/relations";
import { conversations, messages, messageFeedback, workspaces, workspaceMembers, companies, scrapeSnapshots, competitorEdges, competitorEdgeOverrides, companyLocales, brandAnalysis, brandAnalysisRuns, companyUrls, brandAliases, brandAnalysisSources, brandAnalysisMetricEvents } from "./schema";

export const messagesRelations = relations(messages, ({one, many}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	messageFeedbacks: many(messageFeedback),
}));

export const conversationsRelations = relations(conversations, ({many}) => ({
	messages: many(messages),
}));

export const messageFeedbackRelations = relations(messageFeedback, ({one}) => ({
	message: one(messages, {
		fields: [messageFeedback.messageId],
		references: [messages.id]
	}),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({one}) => ({
	workspace: one(workspaces, {
		fields: [workspaceMembers.workspaceId],
		references: [workspaces.id]
	}),
}));

export const workspacesRelations = relations(workspaces, ({many}) => ({
	workspaceMembers: many(workspaceMembers),
	competitorEdges: many(competitorEdges),
	competitorEdgeOverrides: many(competitorEdgeOverrides),
	brandAnalyses: many(brandAnalysis),
}));

export const scrapeSnapshotsRelations = relations(scrapeSnapshots, ({one}) => ({
	company: one(companies, {
		fields: [scrapeSnapshots.companyId],
		references: [companies.id]
	}),
}));

export const companiesRelations = relations(companies, ({many}) => ({
	scrapeSnapshots: many(scrapeSnapshots),
	competitorEdges_companyId: many(competitorEdges, {
		relationName: "competitorEdges_companyId_companies_id"
	}),
	competitorEdges_competitorId: many(competitorEdges, {
		relationName: "competitorEdges_competitorId_companies_id"
	}),
	competitorEdgeOverrides_companyId: many(competitorEdgeOverrides, {
		relationName: "competitorEdgeOverrides_companyId_companies_id"
	}),
	competitorEdgeOverrides_competitorId: many(competitorEdgeOverrides, {
		relationName: "competitorEdgeOverrides_competitorId_companies_id"
	}),
	companyLocales: many(companyLocales),
	companyUrls: many(companyUrls),
	brandAliases: many(brandAliases),
	brandAnalyses: many(brandAnalysis),
}));

export const competitorEdgesRelations = relations(competitorEdges, ({one}) => ({
	company_companyId: one(companies, {
		fields: [competitorEdges.companyId],
		references: [companies.id],
		relationName: "competitorEdges_companyId_companies_id"
	}),
	company_competitorId: one(companies, {
		fields: [competitorEdges.competitorId],
		references: [companies.id],
		relationName: "competitorEdges_competitorId_companies_id"
	}),
	workspace: one(workspaces, {
		fields: [competitorEdges.workspaceId],
		references: [workspaces.id]
	}),
}));

export const competitorEdgeOverridesRelations = relations(competitorEdgeOverrides, ({one}) => ({
	company_companyId: one(companies, {
		fields: [competitorEdgeOverrides.companyId],
		references: [companies.id],
		relationName: "competitorEdgeOverrides_companyId_companies_id"
	}),
	company_competitorId: one(companies, {
		fields: [competitorEdgeOverrides.competitorId],
		references: [companies.id],
		relationName: "competitorEdgeOverrides_competitorId_companies_id"
	}),
	workspace: one(workspaces, {
		fields: [competitorEdgeOverrides.workspaceId],
		references: [workspaces.id]
	}),
}));

export const companyLocalesRelations = relations(companyLocales, ({one}) => ({
	company: one(companies, {
		fields: [companyLocales.companyId],
		references: [companies.id]
	}),
}));

export const brandAnalysisRunsRelations = relations(brandAnalysisRuns, ({one, many}) => ({
	brandAnalysis: one(brandAnalysis, {
		fields: [brandAnalysisRuns.brandAnalysisId],
		references: [brandAnalysis.id]
	}),
	brandAnalysisSources: many(brandAnalysisSources),
	brandAnalysisMetricEvents: many(brandAnalysisMetricEvents),
}));

export const brandAnalysisRelations = relations(brandAnalysis, ({one, many}) => ({
	brandAnalysisRuns: many(brandAnalysisRuns),
	brandAnalysisSources: many(brandAnalysisSources),
	workspace: one(workspaces, {
		fields: [brandAnalysis.workspaceId],
		references: [workspaces.id]
	}),
	company: one(companies, {
		fields: [brandAnalysis.companyId],
		references: [companies.id]
	}),
	brandAnalysisMetricEvents: many(brandAnalysisMetricEvents),
}));

export const companyUrlsRelations = relations(companyUrls, ({one}) => ({
	company: one(companies, {
		fields: [companyUrls.companyId],
		references: [companies.id]
	}),
}));

export const brandAliasesRelations = relations(brandAliases, ({one}) => ({
	company: one(companies, {
		fields: [brandAliases.companyId],
		references: [companies.id]
	}),
}));

export const brandAnalysisSourcesRelations = relations(brandAnalysisSources, ({one}) => ({
	brandAnalysis: one(brandAnalysis, {
		fields: [brandAnalysisSources.analysisId],
		references: [brandAnalysis.id]
	}),
	brandAnalysisRun: one(brandAnalysisRuns, {
		fields: [brandAnalysisSources.runId],
		references: [brandAnalysisRuns.id]
	}),
}));

export const brandAnalysisMetricEventsRelations = relations(brandAnalysisMetricEvents, ({one}) => ({
	brandAnalysisRun: one(brandAnalysisRuns, {
		fields: [brandAnalysisMetricEvents.runId],
		references: [brandAnalysisRuns.id]
	}),
	brandAnalysis: one(brandAnalysis, {
		fields: [brandAnalysisMetricEvents.brandAnalysisId],
		references: [brandAnalysis.id]
	}),
}));