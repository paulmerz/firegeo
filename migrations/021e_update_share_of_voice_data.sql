-- Migration 021e: Mettre à jour les données existantes pour utiliser share_of_voices

UPDATE brand_analysis_metric_events 
SET metric_type = 'share_of_voices'::metric_type 
WHERE metric_type = 'share_of_voice'::metric_type;
