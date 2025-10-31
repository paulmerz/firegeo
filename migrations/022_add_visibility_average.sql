-- Migration 022: Ajouter visibility_average à l'enum metric_type

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'visibility_average' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'metric_type')) THEN
        ALTER TYPE metric_type ADD VALUE 'visibility_average';
    END IF;
END $$;
