-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."enrichment_status" AS ENUM('stub', 'partial', 'full');--> statement-breakpoint
CREATE TYPE "public"."metric_type" AS ENUM('visibility_score', 'mentions', 'average_position', 'sentiment_score', 'position', 'share_of_voices', 'visibility_average', 'average_score');--> statement-breakpoint
CREATE TYPE "public"."periodicity" AS ENUM('none', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'insufficient_credits');--> statement-breakpoint
CREATE TYPE "public"."scope" AS ENUM('global', 'workspace');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('scrape', 'user');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"canonical_domain" text NOT NULL,
	"logo" text,
	"favicon" text,
	"primary_language" text,
	"business_type" text,
	"market_segment" text,
	"target_customers" text,
	"primary_markets" text[],
	"technologies" text[],
	"business_model" text,
	"confidence_score" numeric(4, 2) DEFAULT '0',
	"enrichment_status" "enrichment_status" DEFAULT 'stub',
	"last_refreshed_at" timestamp,
	"next_refresh_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_name_unique" UNIQUE("name"),
	CONSTRAINT "companies_canonical_domain_unique" UNIQUE("canonical_domain")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer,
	"feedback" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"phone" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"theme" "theme" DEFAULT 'light',
	"email_notifications" boolean DEFAULT true,
	"marketing_emails" boolean DEFAULT false,
	"default_model" text DEFAULT 'gpt-3.5-turbo',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scrape_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"locale" text,
	"source_url" text NOT NULL,
	"raw" text NOT NULL,
	"etag" text,
	"fetched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitor_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"competitor_id" uuid NOT NULL,
	"competition_score" numeric(4, 2) NOT NULL,
	"source" "source" NOT NULL,
	"scope" "scope" DEFAULT 'global' NOT NULL,
	"workspace_id" uuid,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_scope_consistency" CHECK (((scope = 'global'::scope) AND (workspace_id IS NULL)) OR ((scope = 'workspace'::scope) AND (workspace_id IS NOT NULL))),
	CONSTRAINT "chk_source_scope" CHECK (((source = 'scrape'::source) AND (scope = 'global'::scope)) OR ((source = 'user'::source) AND (scope = 'workspace'::scope)))
);
--> statement-breakpoint
CREATE TABLE "competitor_edge_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"competitor_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"description" text,
	"keywords" text[],
	"main_content" text,
	"main_products" text[],
	"og_image" text,
	"favicon" text,
	"og_title" text,
	"og_description" text,
	"meta_keywords" text[],
	"raw_metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brand_analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_analysis_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'pending',
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"credits_used" integer,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"analysis_data" jsonb,
	"visibility_score" numeric(10, 2),
	"competitors_count" integer,
	"prompts_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "company_urls_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "brand_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brand_analysis_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid,
	"provider" text,
	"prompt" text,
	"domain" text,
	"url" text,
	"source_type" text DEFAULT 'web_search',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"run_id" uuid,
	"title" text
);
--> statement-breakpoint
CREATE TABLE "brand_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"competitors" jsonb,
	"prompts" jsonb,
	"credits_used" integer DEFAULT 10,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"workspace_id" uuid,
	"periodicity" "periodicity" DEFAULT 'none',
	"is_scheduled" boolean DEFAULT false,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"schedule_paused" boolean DEFAULT false,
	"company_id" uuid NOT NULL,
	"analysis_name" text DEFAULT 'Analyse'
);
--> statement-breakpoint
CREATE TABLE "brand_analysis_metric_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"brand_analysis_id" uuid NOT NULL,
	"competitor_name" text NOT NULL,
	"provider" text NOT NULL,
	"metric_type" "metric_type" NOT NULL,
	"metric_value" numeric(10, 2) NOT NULL,
	"recorded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_snapshots" ADD CONSTRAINT "scrape_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edges" ADD CONSTRAINT "competitor_edges_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edges" ADD CONSTRAINT "competitor_edges_competitor_id_companies_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edges" ADD CONSTRAINT "competitor_edges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edge_overrides" ADD CONSTRAINT "competitor_edge_overrides_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edge_overrides" ADD CONSTRAINT "competitor_edge_overrides_competitor_id_companies_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edge_overrides" ADD CONSTRAINT "competitor_edge_overrides_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_locales" ADD CONSTRAINT "company_locales_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analysis_runs" ADD CONSTRAINT "brand_analysis_runs_brand_analysis_id_brand_analysis_id_fk" FOREIGN KEY ("brand_analysis_id") REFERENCES "public"."brand_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_urls" ADD CONSTRAINT "company_urls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_aliases" ADD CONSTRAINT "brand_aliases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analysis_sources" ADD CONSTRAINT "brand_analysis_sources_analysis_id_brand_analysis_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."brand_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analysis_sources" ADD CONSTRAINT "brand_analysis_sources_run_id_brand_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."brand_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analysis" ADD CONSTRAINT "brand_analysis_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analysis" ADD CONSTRAINT "brand_analysis_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analysis_metric_events" ADD CONSTRAINT "brand_analysis_metric_events_run_id_brand_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."brand_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analysis_metric_events" ADD CONSTRAINT "brand_analysis_metric_events_brand_analysis_id_brand_analysis_i" FOREIGN KEY ("brand_analysis_id") REFERENCES "public"."brand_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_companies_domain" ON "companies" USING btree ("canonical_domain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_snapshots_company_time" ON "scrape_snapshots" USING btree ("company_id" timestamp_ops,"fetched_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_competitor_edges_company" ON "competitor_edges" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_competitor_edges_competitor" ON "competitor_edges" USING btree ("competitor_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_competitor_edge_scope" ON "competitor_edges" USING btree ("company_id" uuid_ops,"competitor_id" uuid_ops,"scope" uuid_ops,"workspace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_competitor_edge_overrides_company" ON "competitor_edge_overrides" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_competitor_edge_overrides_competitor" ON "competitor_edge_overrides" USING btree ("competitor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_competitor_edge_overrides_workspace" ON "competitor_edge_overrides" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_competitor_edge_override" ON "competitor_edge_overrides" USING btree ("company_id" uuid_ops,"competitor_id" uuid_ops,"workspace_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "company_locales_company_id_locale_key" ON "company_locales" USING btree ("company_id" text_ops,"locale" text_ops);--> statement-breakpoint
CREATE INDEX "idx_company_locales_company" ON "company_locales" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_company_urls_company" ON "company_urls" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_aliases_company" ON "brand_aliases" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_brand_aliases_company_alias" ON "brand_aliases" USING btree ("company_id" text_ops,"alias" text_ops);
*/