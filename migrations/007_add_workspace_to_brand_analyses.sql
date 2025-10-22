-- Migration 007: Ajouter workspace_id dans brand_analyses
-- Permet de lier les analyses aux workspaces pour les templates

-- Ajouter la colonne workspace_id
ALTER TABLE brand_analyses 
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id);

-- Index pour performance
CREATE INDEX idx_brand_analyses_workspace 
  ON brand_analyses(workspace_id);

-- Index composite pour la requête de templates (workspace + url + date)
CREATE INDEX idx_brand_analyses_templates 
  ON brand_analyses(workspace_id, url, created_at DESC);

-- Backfill pour les analyses existantes
-- Associe chaque analyse au workspace de son utilisateur
UPDATE brand_analyses ba
SET workspace_id = (
  SELECT wm.workspace_id 
  FROM workspace_members wm 
  WHERE wm.user_id = ba.user_id 
  LIMIT 1
);
