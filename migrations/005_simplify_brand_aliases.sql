-- Migration 005: Simplify brand aliases architecture
-- Remove brand_alias_sets table and simplify brand_aliases to point directly to companies

-- Drop old tables and recreate brand_aliases
DROP TABLE IF EXISTS brand_aliases CASCADE;
DROP TABLE IF EXISTS brand_alias_sets CASCADE;

-- Create simplified brand_aliases table
CREATE TABLE brand_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_brand_aliases_company ON brand_aliases(company_id);
CREATE UNIQUE INDEX uq_brand_aliases_company_alias ON brand_aliases(company_id, alias);
