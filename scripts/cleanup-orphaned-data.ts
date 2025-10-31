#!/usr/bin/env tsx

/**
 * Script pour nettoyer les données orphelines avant la migration
 */

import { db } from '@/lib/db';

async function cleanupOrphanedData() {
  console.log('🧹 Nettoyage des données orphelines...');
  
  try {
    // 1. Supprimer les brand_analysis_runs orphelins
    const orphanedRuns = await db.execute(`
      DELETE FROM brand_analysis_runs 
      WHERE brand_analysis_id NOT IN (
        SELECT id FROM brand_analysis
      )
    `);
    
    console.log(`✅ Supprimé ${orphanedRuns.rowCount} brand_analysis_runs orphelins`);
    
    // 2. Supprimer les brand_analysis_sources orphelins
    const orphanedSources = await db.execute(`
      DELETE FROM brand_analysis_sources 
      WHERE analysis_id NOT IN (
        SELECT id FROM brand_analysis
      )
    `);
    
    console.log(`✅ Supprimé ${orphanedSources.rowCount} brand_analysis_sources orphelins`);
    
    // 3. Supprimer les brand_analysis_sources liés à des runs orphelins
    const orphanedSourcesByRun = await db.execute(`
      DELETE FROM brand_analysis_sources 
      WHERE run_id NOT IN (
        SELECT id FROM brand_analysis_runs
      )
    `);
    
    console.log(`✅ Supprimé ${orphanedSourcesByRun.rowCount} brand_analysis_sources liés à des runs orphelins`);
    
    // 4. Vérifier l'état final
    const stats = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM brand_analysis) as brand_analysis_count,
        (SELECT COUNT(*) FROM brand_analysis_runs) as brand_analysis_runs_count,
        (SELECT COUNT(*) FROM brand_analysis_sources) as brand_analysis_sources_count
    `);
    
    console.log('📊 État final des données:');
    console.log(stats.rows[0]);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

cleanupOrphanedData();
