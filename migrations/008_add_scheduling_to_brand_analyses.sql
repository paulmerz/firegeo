-- Migration 008: Ajouter colonnes scheduling à brand_analyses
-- Permet de configurer des analyses périodiques (quotidiennes, hebdomadaires, mensuelles)

-- Créer ENUM periodicity (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodicity') THEN
        CREATE TYPE periodicity AS ENUM('none', 'daily', 'weekly', 'monthly');
    END IF;
END $$;

-- Ajouter colonnes scheduling (idempotent)
DO $$ 
BEGIN
    -- Ajouter periodicity si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brand_analyses' AND column_name = 'periodicity'
    ) THEN
        ALTER TABLE brand_analyses ADD COLUMN periodicity periodicity DEFAULT 'none';
    END IF;
    
    -- Ajouter is_scheduled si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brand_analyses' AND column_name = 'is_scheduled'
    ) THEN
        ALTER TABLE brand_analyses ADD COLUMN is_scheduled BOOLEAN DEFAULT false;
    END IF;
    
    -- Ajouter next_run_at si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brand_analyses' AND column_name = 'next_run_at'
    ) THEN
        ALTER TABLE brand_analyses ADD COLUMN next_run_at TIMESTAMP;
    END IF;
    
    -- Ajouter last_run_at si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brand_analyses' AND column_name = 'last_run_at'
    ) THEN
        ALTER TABLE brand_analyses ADD COLUMN last_run_at TIMESTAMP;
    END IF;
    
    -- Ajouter schedule_paused si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brand_analyses' AND column_name = 'schedule_paused'
    ) THEN
        ALTER TABLE brand_analyses ADD COLUMN schedule_paused BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Index pour performance des requêtes CRON (idempotent)
CREATE INDEX IF NOT EXISTS idx_brand_analyses_scheduled 
  ON brand_analyses(is_scheduled, next_run_at) 
  WHERE is_scheduled = true;

-- Index pour requêtes par workspace et scheduling (idempotent)
CREATE INDEX IF NOT EXISTS idx_brand_analyses_workspace_scheduled 
  ON brand_analyses(workspace_id, is_scheduled, next_run_at);

-- S'assurer que workspaceId est bien rempli pour les analyses existantes
UPDATE brand_analyses 
SET workspace_id = (
  SELECT wm.workspace_id 
  FROM workspace_members wm 
  WHERE wm.user_id = brand_analyses.user_id 
  LIMIT 1
)
WHERE workspace_id IS NULL;
