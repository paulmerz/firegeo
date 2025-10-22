-- Script SQL pour vérifier les contraintes UNIQUE dans la base de données
-- Exécuter ces requêtes dans Drizzle Studio ou psql

-- 1. Vérifier l'existence de la contrainte UNIQUE sur brand_aliases
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'brand_aliases'
  AND con.contype = 'u'
ORDER BY conname;

-- 2. Vérifier les index UNIQUE sur brand_aliases
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'brand_aliases'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

-- 3. Vérifier s'il y a des doublons dans brand_aliases
SELECT 
  alias_set_id, 
  alias, 
  COUNT(*) as count
FROM brand_aliases
GROUP BY alias_set_id, alias
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 4. Structure de la table brand_aliases
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'brand_aliases'
ORDER BY ordinal_position;

-- 5. Tester la contrainte UNIQUE (à exécuter seulement si vous voulez tester)
-- ATTENTION: Cette requête va échouer si la contrainte fonctionne correctement
-- Remplacer les UUIDs par des valeurs existantes dans votre base

/*
-- Exemple de test (décommentez et adaptez les UUIDs):
INSERT INTO brand_aliases (alias_set_id, alias)
VALUES (
  'votre-alias-set-id-ici', 
  'votre-alias-existant-ici'
);
*/

-- 6. Vérifier toutes les contraintes de la table
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'brand_aliases'
ORDER BY tc.constraint_type, tc.constraint_name;
