-- Migration 020: Ajouter la colonne analysis_name à brand_analysis
-- Cette migration est idempotente et peut être exécutée plusieurs fois

-- 1. Ajouter la colonne analysis_name si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brand_analysis' 
        AND column_name = 'analysis_name'
    ) THEN
        ALTER TABLE brand_analysis ADD COLUMN analysis_name TEXT DEFAULT 'Analyse';
    END IF;
END $$;

-- 2. Backfill des analyses existantes avec le format "Analyse_{{company_name}}"
DO $$
DECLARE
    analysis_record RECORD;
    company_record RECORD;
BEGIN
    -- Parcourir toutes les analyses qui ont encore la valeur par défaut
    FOR analysis_record IN 
        SELECT id, company_id 
        FROM brand_analysis 
        WHERE analysis_name = 'Analyse' OR analysis_name IS NULL
    LOOP
        -- Récupérer le nom de la company
        SELECT name INTO company_record
        FROM companies 
        WHERE id = analysis_record.company_id;
        
        IF company_record.name IS NOT NULL THEN
            -- Mettre à jour avec le format "Analyse_{{company_name}}"
            UPDATE brand_analysis 
            SET analysis_name = 'Analyse_' || company_record.name
            WHERE id = analysis_record.id;
            
            RAISE NOTICE 'Updated analysis % with name: Analyse_%', analysis_record.id, company_record.name;
        END IF;
    END LOOP;
END $$;

-- 3. Ajouter un commentaire sur la colonne
COMMENT ON COLUMN brand_analysis.analysis_name IS 'Nom personnalisé de l''analyse. Format par défaut: Analyse_{{company_name}}';
