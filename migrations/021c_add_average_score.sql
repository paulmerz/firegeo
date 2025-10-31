-- Migration 021c: Ajouter average_score à l'enum metric_type

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'average_score' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'metric_type')) THEN
        ALTER TYPE metric_type ADD VALUE 'average_score';
    END IF;
END $$;
