-- Migration 025: Ajouter position à l'enum metric_type

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'position' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'metric_type')) THEN
        ALTER TYPE metric_type ADD VALUE 'position';
    END IF;
END $$;
