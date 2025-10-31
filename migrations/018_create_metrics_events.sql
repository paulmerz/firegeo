-- Migration 018: Créer table d'événements métriques et materialized view
-- Structure "narrow" pour stocker les métriques par concurrent, provider et run

-- Créer enum pour les types de métriques (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metric_type') THEN
        CREATE TYPE metric_type AS ENUM(
            'visibility_score', 
            'mentions', 
            'average_position', 
            'sentiment_score', 
            'position',
            'share_of_voices',
            'visibility_average',
            'average_score'
        );
    END IF;
END $$;

-- Créer table brand_analysis_metric_events (idempotent)
CREATE TABLE IF NOT EXISTS brand_analysis_metric_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES brand_analysis_runs(id) ON DELETE CASCADE,
  brand_analysis_id UUID NOT NULL REFERENCES brand_analysis(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  metric_type metric_type NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Index BTree composite pour requêtes fréquentes (idempotent)
CREATE INDEX IF NOT EXISTS idx_metric_events_analysis_competitor_provider 
ON brand_analysis_metric_events(brand_analysis_id, competitor_name, provider, metric_type, recorded_at DESC);

-- Index BRIN sur recorded_at pour performance temporelle (idempotent)
CREATE INDEX IF NOT EXISTS idx_metric_events_recorded_at_brin 
ON brand_analysis_metric_events USING brin(recorded_at);

-- Index pour requêtes par run (idempotent)
CREATE INDEX IF NOT EXISTS idx_metric_events_run_id 
ON brand_analysis_metric_events(run_id);

-- Index pour requêtes par provider (idempotent)
CREATE INDEX IF NOT EXISTS idx_metric_events_provider 
ON brand_analysis_metric_events(provider, recorded_at DESC);

-- Créer materialized view pour agrégations journalières (idempotent)
CREATE MATERIALIZED VIEW IF NOT EXISTS brand_analysis_daily_metrics AS
SELECT 
  brand_analysis_id as analysis_id,
  competitor_name,
  provider,
  metric_type,
  DATE(recorded_at) as metric_date,
  AVG(metric_value) as avg_value,
  MAX(metric_value) as last_value,
  COUNT(*) as run_count,
  MIN(recorded_at) as first_recorded_at,
  MAX(recorded_at) as last_recorded_at
FROM brand_analysis_metric_events
GROUP BY 
  brand_analysis_id, 
  competitor_name, 
  provider, 
  metric_type, 
  DATE(recorded_at);

-- Index sur la materialized view (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_unique 
ON brand_analysis_daily_metrics(analysis_id, competitor_name, provider, metric_type, metric_date);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_analysis_date 
ON brand_analysis_daily_metrics(analysis_id, metric_date DESC);

-- Fonction pour rafraîchir la materialized view (idempotent)
CREATE OR REPLACE FUNCTION refresh_daily_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_analysis_daily_metrics;
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour documentation
COMMENT ON TABLE brand_analysis_metric_events IS 'Événements métriques granulaires par concurrent, provider et run';
COMMENT ON COLUMN brand_analysis_metric_events.competitor_name IS 'Nom du concurrent (ou marque cible si isOwn=true)';
COMMENT ON COLUMN brand_analysis_metric_events.provider IS 'Provider IA (OpenAI, Anthropic, Google, etc.)';
COMMENT ON COLUMN brand_analysis_metric_events.metric_type IS 'Type de métrique mesurée';
COMMENT ON COLUMN brand_analysis_metric_events.metric_value IS 'Valeur de la métrique (%, position, score, etc.)';
COMMENT ON COLUMN brand_analysis_metric_events.recorded_at IS 'Timestamp de la mesure (généralement completed_at du run)';

COMMENT ON MATERIALIZED VIEW brand_analysis_daily_metrics IS 'Agrégations journalières des métriques pour performance des requêtes de tendances';
