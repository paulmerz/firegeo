-- Migration pour transformer brand_analysis pour utiliser companyId au lieu de company_name, url, industry
-- Cette migration est idempotente et peut être exécutée plusieurs fois

-- 1. Ajouter la colonne company_id si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brand_analysis' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE brand_analysis ADD COLUMN company_id UUID REFERENCES companies(id);
    END IF;
END $$;

-- 2. Créer un index sur company_id si il n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'brand_analysis' 
        AND indexname = 'idx_brand_analysis_company_id'
    ) THEN
        CREATE INDEX idx_brand_analysis_company_id ON brand_analysis(company_id);
    END IF;
END $$;

-- 3. Migrer les données existantes
-- Note: Les colonnes url, company_name, industry ont été supprimées par la migration 017
-- Cette migration ne peut plus migrer les données car la structure a changé
DO $$
BEGIN
    -- Vérifier s'il y a des analyses sans company_id
    IF EXISTS (SELECT 1 FROM brand_analysis WHERE company_id IS NULL) THEN
        RAISE NOTICE 'Found analyses without company_id, but cannot migrate due to missing columns (url, company_name, industry)';
        RAISE NOTICE 'These analyses will need to be manually updated or recreated';
    ELSE
        RAISE NOTICE 'All analyses already have company_id, no migration needed';
    END IF;
END $$;

-- 4. Supprimer les anciennes colonnes maintenant que les données sont migrées
-- Note: Les colonnes ont déjà été supprimées par la migration 017
DO $$
BEGIN
    -- Vérifier si les colonnes existent encore
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_analysis' AND column_name = 'url') THEN
        ALTER TABLE brand_analysis DROP COLUMN IF EXISTS url;
        RAISE NOTICE 'Dropped url column';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_analysis' AND column_name = 'company_name') THEN
        ALTER TABLE brand_analysis DROP COLUMN IF EXISTS company_name;
        RAISE NOTICE 'Dropped company_name column';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_analysis' AND column_name = 'industry') THEN
        ALTER TABLE brand_analysis DROP COLUMN IF EXISTS industry;
        RAISE NOTICE 'Dropped industry column';
    END IF;
    
    RAISE NOTICE 'Old columns cleanup completed';
END $$;

-- 5. Ajouter une contrainte pour s'assurer que company_id est présent pour les nouvelles analyses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'brand_analysis' 
        AND constraint_name = 'chk_company_id_not_null'
    ) THEN
        ALTER TABLE brand_analysis ADD CONSTRAINT chk_company_id_not_null CHECK (company_id IS NOT NULL);
        RAISE NOTICE 'Added company_id not null constraint';
    ELSE
        RAISE NOTICE 'Company_id constraint already exists';
    END IF;
END $$;

COMMENT ON COLUMN brand_analysis.company_id IS 'Référence vers la table companies. Remplace url, company_name, industry.';
