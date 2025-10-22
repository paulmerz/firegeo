CREATE TYPE "public"."enrichment_status" AS ENUM('stub', 'partial', 'full');--> statement-breakpoint
CREATE TYPE "public"."scope" AS ENUM('global', 'workspace');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('scrape', 'user');--> statement-breakpoint
CREATE TABLE "brand_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "company_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "company_urls_url_unique" UNIQUE("url")
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
	CONSTRAINT "chk_scope_consistency" CHECK ((scope = 'global' AND workspace_id IS NULL) OR (scope = 'workspace' AND workspace_id IS NOT NULL)),
	CONSTRAINT "chk_source_scope" CHECK ((source = 'scrape' AND scope = 'global') OR (source = 'user' AND scope = 'workspace'))
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
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "brand_analyses" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_analysis_sources" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "brand_aliases" ADD CONSTRAINT "brand_aliases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_locales" ADD CONSTRAINT "company_locales_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_urls" ADD CONSTRAINT "company_urls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edge_overrides" ADD CONSTRAINT "competitor_edge_overrides_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edge_overrides" ADD CONSTRAINT "competitor_edge_overrides_competitor_id_companies_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edge_overrides" ADD CONSTRAINT "competitor_edge_overrides_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edges" ADD CONSTRAINT "competitor_edges_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edges" ADD CONSTRAINT "competitor_edges_competitor_id_companies_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_edges" ADD CONSTRAINT "competitor_edges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_snapshots" ADD CONSTRAINT "scrape_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_brand_aliases_company" ON "brand_aliases" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_brand_aliases_company_alias" ON "brand_aliases" USING btree ("company_id","alias");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_companies_domain" ON "companies" USING btree ("canonical_domain");--> statement-breakpoint
CREATE INDEX "idx_company_locales_company" ON "company_locales" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_locales_company_id_locale_key" ON "company_locales" USING btree ("company_id","locale");--> statement-breakpoint
CREATE INDEX "idx_company_urls_company" ON "company_urls" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_competitor_edge_override" ON "competitor_edge_overrides" USING btree ("company_id","competitor_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_competitor_edge_overrides_company" ON "competitor_edge_overrides" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_competitor_edge_overrides_competitor" ON "competitor_edge_overrides" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "idx_competitor_edge_overrides_workspace" ON "competitor_edge_overrides" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_competitor_edges_company" ON "competitor_edges" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_competitor_edges_competitor" ON "competitor_edges" USING btree ("competitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_competitor_edge_scope" ON "competitor_edges" USING btree ("company_id","competitor_id","scope","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_snapshots_company_time" ON "scrape_snapshots" USING btree ("company_id","fetched_at");--> statement-breakpoint
ALTER TABLE "brand_analyses" ADD CONSTRAINT "brand_analyses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_analysis_sources" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "brand_analysis_sources" DROP COLUMN "snippet";