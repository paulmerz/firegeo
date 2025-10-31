-- Migration 024: Supprimer average_rank de l'enum metric_type
-- Note: PostgreSQL ne permet pas de supprimer des valeurs d'enum directement
-- On va juste documenter que average_rank ne doit plus être utilisé

-- Mettre à jour les données existantes pour utiliser average_position au lieu de average_rank
UPDATE brand_analysis_metric_events 
SET metric_type = 'average_position'::metric_type 
WHERE metric_type = 'average_rank'::metric_type;
