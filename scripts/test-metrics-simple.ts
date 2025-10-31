import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

async function testMetricsSimple() {
  try {
    logger.info('🔍 Testing metrics data with raw SQL...');

    // Test 1: Vérifier si la table existe et contient des données
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM brand_analysis_metric_events
    `);
    
    logger.info(`📊 Total metric events: ${countResult.rows[0]?.count || 0}`);

    if (countResult.rows[0]?.count === 0) {
      logger.warn('❌ No metric events found');
      return;
    }

    // Test 2: Récupérer quelques exemples
    const sampleResult = await db.execute(sql`
      SELECT 
        bame.run_id,
        bame.competitor_name,
        bame.provider,
        bame.metric_type,
        bame.metric_value,
        bame.recorded_at,
        bar.completed_at,
        bar.status
      FROM brand_analysis_metric_events bame
      LEFT JOIN brand_analysis_runs bar ON bame.run_id = bar.id
      ORDER BY bame.recorded_at DESC
      LIMIT 5
    `);

    logger.info('📋 Sample data:', sampleResult.rows);

    // Test 3: Vérifier les analyses avec des runs
    const analysisResult = await db.execute(sql`
      SELECT 
        ba.id as analysis_id,
        ba.company_name,
        COUNT(DISTINCT bar.id) as run_count,
        COUNT(bame.id) as metric_events_count
      FROM brand_analysis ba
      LEFT JOIN brand_analysis_runs bar ON ba.id = bar.brand_analysis_id
      LEFT JOIN brand_analysis_metric_events bame ON bar.id = bame.run_id
      WHERE bar.status = 'completed'
      GROUP BY ba.id, ba.company_name
      HAVING COUNT(DISTINCT bar.id) > 0
      ORDER BY run_count DESC
      LIMIT 3
    `);

    logger.info('🎯 Analyses with runs:', analysisResult.rows);

    if (analysisResult.rows.length > 0) {
      const firstAnalysis = analysisResult.rows[0];
      logger.info(`🔍 Testing API query for analysis ${firstAnalysis.analysis_id}...`);

      // Test 4: Simuler la requête de l'API
      const apiQueryResult = await db.execute(sql`
        SELECT 
          bame.run_id,
          bame.competitor_name,
          bame.provider,
          bame.metric_value,
          bame.recorded_at,
          bar.completed_at,
          CASE WHEN bame.competitor_name = ba.company_name THEN true ELSE false END as is_own
        FROM brand_analysis_metric_events bame
        INNER JOIN brand_analysis_runs bar ON bame.run_id = bar.id
        INNER JOIN brand_analysis ba ON bame.brand_analysis_id = ba.id
        WHERE bame.brand_analysis_id = ${firstAnalysis.analysis_id}
          AND bame.metric_type = 'visibility_score'
          AND bar.status = 'completed'
        ORDER BY bar.completed_at DESC
      `);

      logger.info(`✅ API query result (${apiQueryResult.rows.length} rows):`, apiQueryResult.rows);
    }

  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

testMetricsSimple().catch(err => {
  logger.error('Script failed:', err);
  process.exit(1);
});
