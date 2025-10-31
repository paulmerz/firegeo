import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

async function checkAnalysesWithRuns() {
  try {
    logger.info('🔍 Checking analyses with runs...');

    // Vérifier les analyses avec des runs complétés
    const analysesResult = await db.execute(sql`
      SELECT 
        ba.id as analysis_id,
        ba.company_name,
        ba.analysis_name,
        COUNT(DISTINCT bar.id) as run_count,
        MAX(bar.completed_at) as last_run
      FROM brand_analysis ba
      LEFT JOIN brand_analysis_runs bar ON ba.id = bar.brand_analysis_id
      WHERE bar.status = 'completed'
      GROUP BY ba.id, ba.company_name, ba.analysis_name
      HAVING COUNT(DISTINCT bar.id) > 0
      ORDER BY run_count DESC, last_run DESC
    `);

    logger.info(`📊 Found ${analysesResult.rows.length} analyses with completed runs:`);
    analysesResult.rows.forEach((analysis, index) => {
      logger.info(`${index + 1}. ${analysis.analysis_name || analysis.company_name} (${analysis.analysis_id}) - ${analysis.run_count} runs - Last: ${analysis.last_run}`);
    });

    if (analysesResult.rows.length === 0) {
      logger.warn('❌ No analyses with completed runs found');
      return;
    }

    // Vérifier les métriques pour la première analyse
    const firstAnalysis = analysesResult.rows[0];
    logger.info(`🔍 Checking metrics for analysis ${firstAnalysis.analysis_id}...`);

    const metricsResult = await db.execute(sql`
      SELECT 
        bame.metric_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT bame.competitor_name) as competitors_count,
        COUNT(DISTINCT bame.provider) as providers_count
      FROM brand_analysis_metric_events bame
      WHERE bame.brand_analysis_id = ${firstAnalysis.analysis_id}
      GROUP BY bame.metric_type
      ORDER BY event_count DESC
    `);

    logger.info(`📈 Metrics for analysis ${firstAnalysis.analysis_id}:`);
    metricsResult.rows.forEach(metric => {
      logger.info(`  - ${metric.metric_type}: ${metric.event_count} events, ${metric.competitors_count} competitors, ${metric.providers_count} providers`);
    });

    if (metricsResult.rows.length === 0) {
      logger.warn('❌ No metric events found for this analysis');
      logger.info('💡 You may need to run the backfill script: pnpm backfill:metrics');
    }

  } catch (error) {
    logger.error('❌ Check failed:', error);
  }
}

checkAnalysesWithRuns().catch(err => {
  logger.error('Script failed:', err);
  process.exit(1);
});
