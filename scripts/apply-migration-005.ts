#!/usr/bin/env tsx

/**
 * Script pour appliquer la migration 005 - Simplification brand aliases
 */

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function applyMigration005() {
  console.log('🔄 Application de la migration 005 - Simplification brand aliases...');
  
  try {
    // 1. Supprimer les contraintes de clé étrangère existantes
    console.log('1. Suppression des contraintes existantes...');
    await db.execute(sql`ALTER TABLE brand_aliases DROP CONSTRAINT IF EXISTS brand_aliases_alias_set_id_brand_alias_sets_id_fk`);
    await db.execute(sql`ALTER TABLE brand_aliases DROP CONSTRAINT IF EXISTS brand_aliases_alias_set_id_fkey`);
    
    // 2. Supprimer les tables
    console.log('2. Suppression des tables existantes...');
    await db.execute(sql`DROP TABLE IF EXISTS brand_aliases CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS brand_alias_sets CASCADE`);
    
    // 3. Créer la nouvelle table brand_aliases
    console.log('3. Création de la nouvelle table brand_aliases...');
    await db.execute(sql`
      CREATE TABLE brand_aliases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        alias text NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `);
    
    // 4. Créer les index
    console.log('4. Création des index...');
    await db.execute(sql`CREATE INDEX idx_brand_aliases_company ON brand_aliases(company_id)`);
    await db.execute(sql`CREATE UNIQUE INDEX uq_brand_aliases_company_alias ON brand_aliases(company_id, alias)`);
    
    console.log('✅ Migration 005 appliquée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error);
    throw error;
  }
}

async function main() {
  try {
    await applyMigration005();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
