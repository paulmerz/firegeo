-- Migration 009: Créer table brand_analysis_runs
-- Stocke l'historique des exécutions d'analyses périodiques

-- Créer enum pour les statuts de run (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
        CREATE TYPE run_status AS ENUM('pending', 'running', 'completed', 'failed', 'insufficient_credits');
    END IF;
END $$;

-- Créer table brand_analysis_runs (idempotent)
CREATE TABLE IF NOT EXISTS brand_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_analysis_id UUID NOT NULL REFERENCES brand_analyses(id) ON DELETE CASCADE,
  status run_status DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  credits_used INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  analysis_data JSONB,
  visibility_score INTEGER,
  competitors_count INTEGER,
  prompts_count INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

-- Index pour performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_runs_analysis ON brand_analysis_runs(brand_analysis_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON brand_analysis_runs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON brand_analysis_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_analysis_data_gin ON brand_analysis_runs USING gin(analysis_data);

-- Index composite pour requêtes fréquentes (idempotent)
CREATE INDEX IF NOT EXISTS idx_runs_analysis_status ON brand_analysis_runs(brand_analysis_id, status, created_at DESC);
