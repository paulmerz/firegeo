-- Migration 023: Supprimer mention_percentage de l'enum metric_type
-- Note: PostgreSQL ne permet pas de supprimer des valeurs d'enum directement
-- On va juste documenter que mention_percentage ne doit plus être utilisé

-- Mettre à jour les données existantes pour utiliser visibility_score au lieu de mention_percentage
UPDATE brand_analysis_metric_events 
SET metric_type = 'visibility_score'::metric_type 
WHERE metric_type = 'mention_percentage'::metric_type;
