-- Add title column to brand_analysis_sources
ALTER TABLE IF EXISTS brand_analysis_sources
  ADD COLUMN IF NOT EXISTS title text;


