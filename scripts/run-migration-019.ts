#!/usr/bin/env tsx

/**
 * Script pour exécuter la migration 019 - Migration brand_analysis vers company_id
 */

import { db } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🚀 Début de la migration 019 - Migration brand_analysis vers company_id');
  
  try {
    // Lire le fichier de migration
    const migrationPath = join(process.cwd(), 'migrations', '019_migrate_brand_analysis_to_company_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration SQL chargée');
    
    // Exécuter la migration
    await db.execute(migrationSQL);
    
    console.log('✅ Migration 019 exécutée avec succès');
    
    // Vérifier les résultats
    const result = await db.execute(`
      SELECT 
        COUNT(*) as total_analyses,
        COUNT(company_id) as analyses_with_company_id,
        COUNT(*) - COUNT(company_id) as analyses_without_company_id
      FROM brand_analysis
    `);
    
    console.log('📊 Résultats de la migration:');
    console.log(result.rows[0]);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
