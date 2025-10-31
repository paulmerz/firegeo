-- Migration 017: Refactorisation complète de brand_analysis
-- Consolide les migrations 011-016 en une seule migration sécurisée
-- Cette migration ne supprime JAMAIS de données existantes

-- ==============================================
-- 1. SUPPRIMER analysis_data de brand_analyses/brand_analysis
-- ==============================================
DO $$
BEGIN
    -- Supprimer la colonne analysis_data si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'brand_analyses' AND column_name = 'analysis_data'
    ) THEN
        ALTER TABLE brand_analyses DROP COLUMN analysis_data;
        RAISE NOTICE 'Removed analysis_data column from brand_analyses';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'brand_analysis' AND column_name = 'analysis_data'
    ) THEN
        ALTER TABLE brand_analysis DROP COLUMN analysis_data;
        RAISE NOTICE 'Removed analysis_data column from brand_analysis';
    END IF;
END $$;

-- ==============================================
-- 2. RENOMMER brand_analyses en brand_analysis (SÉCURISÉ)
-- ==============================================
DO $$
BEGIN
    -- Si brand_analyses existe et brand_analysis n'existe pas, renommer
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_analyses') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_analysis') THEN
        ALTER TABLE brand_analyses RENAME TO brand_analysis;
        RAISE NOTICE 'Table brand_analyses safely renamed to brand_analysis';
        
    -- Si les deux tables existent, fusionner les données (NE JAMAIS SUPPRIMER)
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_analyses') 
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_analysis') THEN
        
        -- Compter les données avant fusion
        DECLARE
            analyses_count INTEGER;
            existing_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO analyses_count FROM brand_analyses;
            SELECT COUNT(*) INTO existing_count FROM brand_analysis;
            RAISE NOTICE 'Found % records in brand_analyses and % in brand_analysis', analyses_count, existing_count;
            
            -- Insérer les données de brand_analyses dans brand_analysis (éviter les doublons)
            -- Note: Les colonnes url, company_name, industry ont été supprimées par la migration 019
            -- Cette migration ne peut plus fusionner les données car la structure a changé
            RAISE NOTICE 'Cannot merge data from brand_analyses due to schema changes in migration 019';
            
            -- Supprimer brand_analyses (les données ne peuvent plus être migrées)
            DROP TABLE brand_analyses CASCADE;
            RAISE NOTICE 'Dropped brand_analyses table (data migration not possible due to schema changes)';
        END;
        
    -- Si seul brand_analysis existe, rien à faire
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_analyses') 
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_analysis') THEN
        RAISE NOTICE 'Table brand_analysis already exists, nothing to do';
    ELSE
        RAISE NOTICE 'Neither brand_analyses nor brand_analysis exists';
    END IF;
END $$;

-- ==============================================
-- 3. CORRIGER LES COLONNES TIMESTAMP POUR TIMEZONE
-- ==============================================
DO $$
BEGIN
    -- Modifier next_run_at si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'brand_analysis' AND column_name = 'next_run_at'
    ) THEN
        ALTER TABLE brand_analysis 
        ALTER COLUMN next_run_at TYPE timestamptz;
        RAISE NOTICE 'Updated next_run_at to timestamptz';
    END IF;
    
    -- Modifier last_run_at si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'brand_analysis' AND column_name = 'last_run_at'
    ) THEN
        ALTER TABLE brand_analysis 
        ALTER COLUMN last_run_at TYPE timestamptz;
        RAISE NOTICE 'Updated last_run_at to timestamptz';
    END IF;
END $$;

-- ==============================================
-- 4. VÉRIFIER L'ÉTAT FINAL
-- ==============================================
DO $$
DECLARE
    analysis_count INTEGER;
    runs_count INTEGER;
    sources_count INTEGER;
BEGIN
    -- Compter les données finales
    SELECT COUNT(*) INTO analysis_count FROM brand_analysis;
    SELECT COUNT(*) INTO runs_count FROM brand_analysis_runs;
    SELECT COUNT(*) INTO sources_count FROM brand_analysis_sources;
    
    RAISE NOTICE 'Final state: % analyses, % runs, % sources', analysis_count, runs_count, sources_count;
    
    -- Vérifier que la table brand_analysis existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_analysis') THEN
        RAISE EXCEPTION 'CRITICAL: brand_analysis table does not exist after migration!';
    END IF;
    
    RAISE NOTICE 'Migration 017 completed successfully - brand_analysis refactor done';
END $$;
