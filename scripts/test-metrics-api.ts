import { db } from '@/lib/db';
import { brandAnalysisMetricEvents, brandAnalysisRuns, brandAnalysis } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

async function testMetricsData() {
  try {
    logger.info('🔍 Testing metrics data...');

    // 1. Vérifier les données dans brand_analysis_metric_events
    const metricEvents = await db
      .select()
      .from(brandAnalysisMetricEvents)
      .limit(10);

    logger.info(`📊 Found ${metricEvents.length} metric events:`, metricEvents);

    if (metricEvents.length === 0) {
      logger.warn('❌ No metric events found in brand_analysis_metric_events');
      return;
    }

    // 2. Vérifier les runs associés
    const runIds = [...new Set(metricEvents.map(e => e.runId))];
    logger.info(`🏃 Found ${runIds.length} unique run IDs:`, runIds);

    const runs = await db
      .select()
      .from(brandAnalysisRuns)
      .where(eq(brandAnalysisRuns.id, runIds[0]));

    logger.info(`📋 Run details:`, runs[0]);

    // 3. Vérifier l'analyse associée
    if (runs.length > 0) {
      const analysis = await db
        .select()
        .from(brandAnalysis)
        .where(eq(brandAnalysis.id, runs[0].brandAnalysisId));

      logger.info(`🎯 Analysis details:`, analysis[0]);

      // 4. Tester la requête complète
      const testQuery = await db
        .select({
          runId: brandAnalysisMetricEvents.runId,
          competitorName: brandAnalysisMetricEvents.competitorName,
          provider: brandAnalysisMetricEvents.provider,
          metricValue: brandAnalysisMetricEvents.metricValue,
          recordedAt: brandAnalysisMetricEvents.recordedAt,
          completedAt: brandAnalysisRuns.completedAt,
        })
        .from(brandAnalysisMetricEvents)
        .innerJoin(brandAnalysisRuns, eq(brandAnalysisMetricEvents.runId, brandAnalysisRuns.id))
        .innerJoin(brandAnalysis, eq(brandAnalysisMetricEvents.brandAnalysisId, brandAnalysis.id))
        .where(
          and(
            eq(brandAnalysisMetricEvents.brandAnalysisId, runs[0].brandAnalysisId),
            eq(brandAnalysisMetricEvents.metricType, 'visibility_score'),
            eq(brandAnalysisRuns.status, 'completed')
          )
        )
        .orderBy(desc(brandAnalysisRuns.completedAt));

      logger.info(`✅ Test query results (${testQuery.length} rows):`, testQuery);
    }

  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

testMetricsData().catch(err => {
  logger.error('Script failed:', err);
  process.exit(1);
});
