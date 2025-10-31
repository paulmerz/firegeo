-- Migration 021a: Ajouter mention_percentage à l'enum metric_type

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'mention_percentage' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'metric_type')) THEN
        ALTER TYPE metric_type ADD VALUE 'mention_percentage';
    END IF;
END $$;
