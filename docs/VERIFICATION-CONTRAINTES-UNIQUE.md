# 🔍 Vérification des Contraintes UNIQUE en Base de Données

## Vue d'ensemble

Ce guide explique comment vérifier que les contraintes UNIQUE sont bien appliquées dans votre base de données PostgreSQL, notamment la contrainte `UNIQUE(alias_set_id, alias)` sur la table `brand_aliases`.

## 📋 Méthodes de Vérification

### 1. **Via Drizzle Studio (Recommandé)**

```bash
pnpm db:studio
```

Puis exécutez les requêtes SQL suivantes dans l'interface :

```sql
-- Vérifier les contraintes UNIQUE
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'brand_aliases'
  AND con.contype = 'u'
ORDER BY conname;
```

### 2. **Via Scripts Automatisés**

```bash
# Vérifier le statut des migrations et schémas
npx tsx scripts/check-migration-status.ts

# Vérifier les contraintes en base (nécessite une connexion DB)
npx tsx scripts/check-unique-constraints.ts
```

### 3. **Via Requêtes SQL Directes**

Exécutez le fichier `scripts/check-constraints-sql.sql` dans votre client PostgreSQL préféré.

### 4. **Via psql (Ligne de commande)**

```bash
# Se connecter à la base
psql -h localhost -U votre_utilisateur -d votre_base

# Puis exécuter les requêtes de vérification
\i scripts/check-constraints-sql.sql
```

## ✅ Résultats Attendus

### Contrainte UNIQUE sur brand_aliases

Vous devriez voir :

```sql
constraint_name                    | constraint_type | definition
----------------------------------|-----------------|----------------------------------------
brand_aliases_alias_set_id_alias_key | u             | UNIQUE (alias_set_id, alias)
```

### Index UNIQUE

```sql
indexname                         | indexdef
----------------------------------|----------------------------------------
brand_aliases_alias_set_id_alias_key | CREATE UNIQUE INDEX brand_aliases_alias_set_id_alias_key ON public.brand_aliases USING btree (alias_set_id, alias)
```

## 🧪 Test de la Contrainte

### Test 1: Vérifier l'absence de doublons

```sql
SELECT 
  alias_set_id, 
  alias, 
  COUNT(*) as count
FROM brand_aliases
GROUP BY alias_set_id, alias
HAVING COUNT(*) > 1;
```

**Résultat attendu :** Aucune ligne retournée

### Test 2: Tenter d'insérer un doublon

```sql
-- Remplacer par des valeurs existantes dans votre base
INSERT INTO brand_aliases (alias_set_id, alias)
VALUES (
  'votre-alias-set-id-existant', 
  'votre-alias-existant'
);
```

**Résultat attendu :** Erreur de contrainte unique

```
ERROR: duplicate key value violates unique constraint "brand_aliases_alias_set_id_alias_key"
DETAIL: Key (alias_set_id, alias)=(votre-id, votre-alias) already exists.
```

## 🔧 Dépannage

### Si la contrainte n'existe pas

1. **Vérifier que la migration a été appliquée :**
   ```bash
   pnpm db:migrate
   ```

2. **Vérifier le statut des migrations :**
   ```bash
   pnpm db:generate
   ```

3. **Appliquer manuellement la contrainte :**
   ```sql
   ALTER TABLE brand_aliases
   ADD CONSTRAINT brand_aliases_alias_set_id_alias_key
   UNIQUE (alias_set_id, alias);
   ```

### Si des doublons existent

1. **Identifier les doublons :**
   ```sql
   SELECT 
     alias_set_id, 
     alias, 
     COUNT(*) as count,
     array_agg(id) as ids
   FROM brand_aliases
   GROUP BY alias_set_id, alias
   HAVING COUNT(*) > 1;
   ```

2. **Supprimer les doublons (garder le premier) :**
   ```sql
   DELETE FROM brand_aliases ba1
   WHERE ba1.id NOT IN (
     SELECT DISTINCT ON (alias_set_id, alias) id
     FROM brand_aliases
     ORDER BY alias_set_id, alias, id
   );
   ```

3. **Puis créer la contrainte :**
   ```sql
   ALTER TABLE brand_aliases
   ADD CONSTRAINT brand_aliases_alias_set_id_alias_key
   UNIQUE (alias_set_id, alias);
   ```

## 📊 Monitoring Continu

### Script de surveillance

Créez un script de monitoring pour vérifier régulièrement l'intégrité :

```typescript
// scripts/monitor-constraints.ts
import { db } from '../lib/db';

async function monitorConstraints() {
  const duplicates = await db.execute(`
    SELECT COUNT(*) as duplicate_count
    FROM (
      SELECT alias_set_id, alias, COUNT(*)
      FROM brand_aliases
      GROUP BY alias_set_id, alias
      HAVING COUNT(*) > 1
    ) duplicates
  `);
  
  if (duplicates.rows[0].duplicate_count > 0) {
    console.error('❌ Doublons détectés dans brand_aliases!');
  } else {
    console.log('✅ Aucun doublon dans brand_aliases');
  }
}
```

## 🎯 Points Clés

- ✅ La contrainte `UNIQUE(alias_set_id, alias)` est définie dans le schéma Drizzle
- ✅ La migration 004 l'applique avec nettoyage des doublons
- ✅ L'index `brand_aliases_alias_set_id_alias_key` est créé automatiquement
- ✅ Les tests de contrainte confirment le bon fonctionnement

## 📚 Ressources

- [Documentation PostgreSQL - Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [Documentation Drizzle - Unique Indexes](https://orm.drizzle.team/docs/indexes#unique-indexes)
- [Migration 004](../migrations/004_add_companies_competitors_aliases.sql)
