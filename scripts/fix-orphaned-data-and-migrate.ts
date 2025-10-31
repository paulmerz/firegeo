#!/usr/bin/env tsx

/**
 * Script pour nettoyer les données orphelines et exécuter la migration
 */

import { db } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function fixAndMigrate() {
  console.log('🔧 Nettoyage des données orphelines et migration...');
  
  try {
    // 1. Vérifier l'état actuel
    console.log('📊 État actuel des données:');
    const currentStats = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM brand_analysis) as brand_analysis_count,
        (SELECT COUNT(*) FROM brand_analysis_runs) as brand_analysis_runs_count,
        (SELECT COUNT(*) FROM brand_analysis_sources) as brand_analysis_sources_count
    `);
    console.log(currentStats.rows[0]);

    // 2. Nettoyer les données orphelines
    console.log('🧹 Nettoyage des données orphelines...');
    
    // Supprimer les sources liées à des analyses inexistantes
    const orphanedSources = await db.execute(`
      DELETE FROM brand_analysis_sources 
      WHERE analysis_id NOT IN (
        SELECT id FROM brand_analysis
      )
    `);
    console.log(`✅ Supprimé ${orphanedSources.rowCount} brand_analysis_sources orphelins`);

    // Supprimer les runs liés à des analyses inexistantes
    const orphanedRuns = await db.execute(`
      DELETE FROM brand_analysis_runs 
      WHERE brand_analysis_id NOT IN (
        SELECT id FROM brand_analysis
      )
    `);
    console.log(`✅ Supprimé ${orphanedRuns.rowCount} brand_analysis_runs orphelins`);

    // Supprimer les sources liées à des runs inexistants
    const orphanedSourcesByRun = await db.execute(`
      DELETE FROM brand_analysis_sources 
      WHERE run_id NOT IN (
        SELECT id FROM brand_analysis_runs
      )
    `);
    console.log(`✅ Supprimé ${orphanedSourcesByRun.rowCount} brand_analysis_sources liés à des runs orphelins`);

    // 3. Vérifier l'état après nettoyage
    console.log('📊 État après nettoyage:');
    const cleanStats = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM brand_analysis) as brand_analysis_count,
        (SELECT COUNT(*) FROM brand_analysis_runs) as brand_analysis_runs_count,
        (SELECT COUNT(*) FROM brand_analysis_sources) as brand_analysis_sources_count
    `);
    console.log(cleanStats.rows[0]);

    // 4. Exécuter la migration
    console.log('🚀 Exécution de la migration 019...');
    const migrationPath = join(process.cwd(), 'migrations', '019_migrate_brand_analysis_to_company_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    await db.execute(migrationSQL);
    console.log('✅ Migration 019 exécutée avec succès');

    // 5. Vérifier les résultats de la migration
    console.log('📊 Résultats de la migration:');
    const migrationResults = await db.execute(`
      SELECT 
        COUNT(*) as total_analyses,
        COUNT(company_id) as analyses_with_company_id,
        COUNT(*) - COUNT(company_id) as analyses_without_company_id
      FROM brand_analysis
    `);
    console.log(migrationResults.rows[0]);

    // 6. Vérifier que la colonne company_id existe
    const columnCheck = await db.execute(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'brand_analysis' 
      AND column_name IN ('company_id', 'url', 'company_name', 'industry')
      ORDER BY column_name
    `);
    console.log('📋 Colonnes de brand_analysis:');
    columnCheck.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixAndMigrate();
