CREATE TABLE IF NOT EXISTS brand_analysis_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id uuid NOT NULL REFERENCES brand_analyses(id) ON DELETE CASCADE,
    provider text,
    prompt text,
    domain text,
    url text,
    source_type text DEFAULT 'web_search',
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_analysis_sources_analysis_id
    ON brand_analysis_sources (analysis_id);
