-- Migration 010: Adapter brand_analysis_sources pour supporter les runs
-- Permet de lier les sources soit à une analyse (run unique) soit à un run spécifique

-- Ajouter colonne run_id optionnelle (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brand_analysis_sources' AND column_name = 'run_id'
    ) THEN
        ALTER TABLE brand_analysis_sources
          ADD COLUMN run_id UUID REFERENCES brand_analysis_runs(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Index pour performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_sources_run ON brand_analysis_sources(run_id);

-- Index composite pour requêtes par run et type (idempotent)
CREATE INDEX IF NOT EXISTS idx_sources_run_type ON brand_analysis_sources(run_id, source_type);

-- Constraint pour s'assurer qu'une source est liée soit à analysis_id soit à run_id (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_sources_analysis_or_run'
    ) THEN
        ALTER TABLE brand_analysis_sources
          ADD CONSTRAINT chk_sources_analysis_or_run 
          CHECK (
            (analysis_id IS NOT NULL AND run_id IS NULL) OR 
            (analysis_id IS NULL AND run_id IS NOT NULL)
          );
    END IF;
END $$;
