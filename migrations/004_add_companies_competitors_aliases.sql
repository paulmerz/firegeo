-- Migration 004: Add companies, competitors, and aliases tables
-- Multi-tenant persistence layer for brand monitoring

-- Workspaces and members
CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "workspace_members" (
    "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL,
    "role" text CHECK (role IN ('owner','admin','member','viewer')) DEFAULT 'member',
    "created_at" timestamptz DEFAULT now(),
    PRIMARY KEY ("workspace_id", "user_id")
);

-- Companies table
CREATE TABLE IF NOT EXISTS "companies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text UNIQUE NOT NULL,
    "url" text NOT NULL,
    "canonical_domain" text UNIQUE NOT NULL,
    "logo" text,
    "favicon" text,
    "primary_language" text,
    "business_type" text,
    "market_segment" text,
    "target_customers" text,
    "primary_markets" text[],
    "technologies" text[],
    "business_model" text,
    "confidence_score" numeric(4,2) DEFAULT 0,
    "enrichment_status" text CHECK (enrichment_status IN ('stub','partial','full')) DEFAULT 'stub',
    "last_refreshed_at" timestamptz,
    "next_refresh_at" timestamptz,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_companies_domain" ON "companies"("canonical_domain");

-- Company locales table - localized company information
CREATE TABLE IF NOT EXISTS "company_locales" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
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
    "raw_metadata" jsonb,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

-- Add UNIQUE constraint if it doesn't exist (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'company_locales'
          AND con.contype = 'u'
          AND con.conname = 'company_locales_company_id_locale_key'
    ) THEN
        -- Remove potential duplicates first (keep most recent)
        DELETE FROM company_locales cl1
        WHERE cl1.id NOT IN (
            SELECT DISTINCT ON (company_id, locale) id
            FROM company_locales
            ORDER BY company_id, locale, created_at DESC
        );
        
        -- Create the UNIQUE constraint
        ALTER TABLE company_locales
        ADD CONSTRAINT company_locales_company_id_locale_key
        UNIQUE (company_id, locale);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_company_locales_company" ON "company_locales"("company_id");

-- Company URLs table
CREATE TABLE IF NOT EXISTS "company_urls" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "url" text UNIQUE NOT NULL,
    "created_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_company_urls_company" ON "company_urls"("company_id");

-- Scrape snapshots table
CREATE TABLE IF NOT EXISTS "scrape_snapshots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "locale" text,
    "source_url" text NOT NULL,
    "raw" jsonb NOT NULL,
    "etag" text,
    "fetched_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_snapshots_company_time" ON "scrape_snapshots"("company_id", "fetched_at" DESC);

-- Competitor edges table with multi-tenant scope
CREATE TABLE IF NOT EXISTS "competitor_edges" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "competitor_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "competition_score" numeric(4,2) NOT NULL,
    "source" text CHECK (source IN ('scrape','user')) NOT NULL,
    "scope" text CHECK (scope IN ('global','workspace')) NOT NULL DEFAULT 'global',
    "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "created_by_user_id" text,
    "updated_by_user_id" text,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    CONSTRAINT "chk_scope_consistency" CHECK (
        (scope = 'global' AND workspace_id IS NULL) OR
        (scope = 'workspace' AND workspace_id IS NOT NULL)
    ),
    CONSTRAINT "chk_source_scope" CHECK (
        (source = 'scrape' AND scope = 'global') OR
        (source = 'user' AND scope = 'workspace')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_competitor_edge_scope" ON "competitor_edges"(
    "company_id", "competitor_id", "scope", 
    COALESCE("workspace_id", '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX IF NOT EXISTS "idx_competitor_edges_company" ON "competitor_edges"("company_id");
CREATE INDEX IF NOT EXISTS "idx_competitor_edges_competitor" ON "competitor_edges"("competitor_id");

-- Brand alias sets table
CREATE TABLE IF NOT EXISTS "brand_alias_sets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "original" text NOT NULL,
    "confidence" numeric(4,2) DEFAULT 1.00,
    "scope" text CHECK (scope IN ('global','workspace')) NOT NULL DEFAULT 'global',
    "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "created_by_user_id" text,
    "updated_by_user_id" text,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    CONSTRAINT "chk_alias_scope_consistency" CHECK (
        (scope = 'global' AND workspace_id IS NULL) OR
        (scope = 'workspace' AND workspace_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_alias_set_scope" ON "brand_alias_sets"(
    "company_id", "original", "scope",
    COALESCE("workspace_id", '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX IF NOT EXISTS "idx_brand_alias_sets_company" ON "brand_alias_sets"("company_id");

-- Brand aliases table - individual alias variations
CREATE TABLE IF NOT EXISTS "brand_aliases" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "alias_set_id" uuid NOT NULL REFERENCES "brand_alias_sets"("id") ON DELETE CASCADE,
    "alias" text NOT NULL
);

-- Add UNIQUE constraint if it doesn't exist (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'brand_aliases'
          AND con.contype = 'u'
          AND con.conname = 'brand_aliases_alias_set_id_alias_key'
    ) THEN
        -- Remove potential duplicates first (keep first occurrence)
        DELETE FROM brand_aliases ba1
        WHERE ba1.id NOT IN (
            SELECT DISTINCT ON (alias_set_id, alias) id
            FROM brand_aliases
            ORDER BY alias_set_id, alias, id
        );
        
        -- Create the UNIQUE constraint
        ALTER TABLE brand_aliases
        ADD CONSTRAINT brand_aliases_alias_set_id_alias_key
        UNIQUE (alias_set_id, alias);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_brand_aliases_set" ON "brand_aliases"("alias_set_id");

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "idx_brand_alias_trgm" ON "brand_aliases" USING GIN("alias" gin_trgm_ops);
