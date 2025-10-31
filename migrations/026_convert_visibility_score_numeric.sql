-- Migration 026: Convertir visibility_score en numeric(10,2)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'brand_analysis_runs'
          AND column_name = 'visibility_score'
          AND data_type <> 'numeric'
    ) THEN
        ALTER TABLE brand_analysis_runs
        ALTER COLUMN visibility_score TYPE numeric(10,2)
        USING visibility_score::numeric(10,2);
    END IF;
END $$;

