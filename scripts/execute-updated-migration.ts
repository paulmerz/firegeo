#!/usr/bin/env tsx

/**
 * Script pour exécuter la migration mise à jour avec suppression des anciennes colonnes
 */

import { db } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function executeUpdatedMigration() {
  console.log('🚀 Exécution de la migration mise à jour...');
  
  try {
    // 1. Vérifier l'état actuel
    console.log('📊 État actuel:');
    const currentState = await db.execute(`
      SELECT 
        COUNT(*) as total_analyses,
        COUNT(company_id) as analyses_with_company_id,
        COUNT(*) - COUNT(company_id) as analyses_without_company_id
      FROM brand_analysis
    `);
    console.log(currentState.rows[0]);

    // 2. Vérifier les colonnes existantes
    const columns = await db.execute(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'brand_analysis' 
      AND column_name IN ('company_id', 'url', 'company_name', 'industry')
      ORDER BY column_name
    `);
    console.log('📋 Colonnes actuelles:');
    columns.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // 3. Exécuter la migration
    console.log('🔄 Exécution de la migration...');
    const migrationPath = join(process.cwd(), 'migrations', '019_migrate_brand_analysis_to_company_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    await db.execute(migrationSQL);
    console.log('✅ Migration exécutée avec succès');

    // 4. Vérifier l'état final
    console.log('📊 État final:');
    const finalState = await db.execute(`
      SELECT 
        COUNT(*) as total_analyses,
        COUNT(company_id) as analyses_with_company_id,
        COUNT(*) - COUNT(company_id) as analyses_without_company_id
      FROM brand_analysis
    `);
    console.log(finalState.rows[0]);

    // 5. Vérifier les colonnes finales
    const finalColumns = await db.execute(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'brand_analysis' 
      ORDER BY column_name
    `);
    console.log('📋 Colonnes finales:');
    finalColumns.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // 6. Vérifier la contrainte
    const constraints = await db.execute(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'brand_analysis' 
      AND constraint_name = 'chk_company_id_not_null'
    `);
    console.log('🔒 Contraintes:');
    constraints.rows.forEach((row: any) => {
      console.log(`  - ${row.constraint_name}: ${row.constraint_type}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

executeUpdatedMigration();
