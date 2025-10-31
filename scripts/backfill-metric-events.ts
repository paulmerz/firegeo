#!/usr/bin/env tsx

/**
 * Script de backfill pour migrer les runs existants vers la structure événementielle
 * 
 * Ce script:
 * 1. Récupère tous les runs existants avec analysisData non null
 * 2. Parse le JSONB pour extraire providerRankings et providerComparison
 * 3. Insère les événements métriques correspondants
 * 4. Utilise completed_at comme recorded_at
 */

import { config } from 'dotenv';

config({ path: '.env.local' });

import { db } from '../lib/db';
import { brandAnalysisRuns } from '../lib/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

interface AnalysisData {
  providerRankings?: Array<{
    provider: string;
    competitors: Array<{
      name: string;
      visibilityScore?: number;
      mentions?: number;
      averagePosition?: number;
      sentimentScore?: number;
      shareOfVoice?: number;
      isOwn?: boolean;
    }>;
  }>;
  providerComparison?: Array<{
    competitor: string;
    providers: Record<string, {
      visibilityScore?: number;
      mentions?: number;
      position?: number;
      sentiment?: string;
    }>;
    isOwn?: boolean;
  }>;
  company?: {
    brand?: string;
  };
}

async function backfillMetricEvents() {
  logger.info('Starting backfill of metric events...');

  try {
    // Récupérer tous les runs avec analysisData
    const runs = await db
      .select({
        id: brandAnalysisRuns.id,
        brandAnalysisId: brandAnalysisRuns.brandAnalysisId,
        analysisData: brandAnalysisRuns.analysisData,
        completedAt: brandAnalysisRuns.completedAt,
        createdAt: brandAnalysisRuns.createdAt
      })
      .from(brandAnalysisRuns)
      .where(
        isNotNull(brandAnalysisRuns.analysisData)
      );

    logger.info(`Found ${runs.length} runs with analysis data`);

    if (runs.length === 0) {
      logger.info('No runs to backfill');
      return;
    }

    let totalEvents = 0;
    let processedRuns = 0;
    let errors = 0;

    for (const run of runs) {
      try {
        const analysisData = run.analysisData as AnalysisData;
        const recordedAt = run.completedAt || run.createdAt || new Date();
        
        const metricEvents: Array<{
          run_id: string;
          brand_analysis_id: string;
          competitor_name: string;
          provider: string;
          metric_type: string;
          metric_value: number;
          recorded_at: Date;
        }> = [];

        // Extraire les métriques depuis providerRankings
        if (analysisData.providerRankings && Array.isArray(analysisData.providerRankings)) {
          const providerRankings = analysisData.providerRankings;
          const allBrands = new Set<string>();
          const targetBrand = analysisData.company?.brand;

          providerRankings.forEach((providerRanking) => {
            const provider = typeof providerRanking.provider === 'string' ? providerRanking.provider : null;

            if (!provider) {
              return;
            }

            if (providerRanking.competitors && Array.isArray(providerRanking.competitors)) {
              providerRanking.competitors.forEach((competitor) => {
                const competitorName = typeof competitor.name === 'string' ? competitor.name : null;

                if (!competitorName) {
                  return;
                }

                allBrands.add(competitorName);

                if (typeof competitor.visibilityScore === 'number') {
                  metricEvents.push({
                    run_id: run.id,
                    brand_analysis_id: run.brandAnalysisId,
                    competitor_name: competitorName,
                    provider,
                    metric_type: 'visibility_score',
                    metric_value: competitor.visibilityScore,
                    recorded_at: recordedAt
                  });
                }

                if (typeof competitor.mentions === 'number') {
                  metricEvents.push({
                    run_id: run.id,
                    brand_analysis_id: run.brandAnalysisId,
                    competitor_name: competitorName,
                    provider,
                    metric_type: 'mentions',
                    metric_value: competitor.mentions,
                    recorded_at: recordedAt
                  });
                }

                if (typeof competitor.averagePosition === 'number') {
                  metricEvents.push({
                    run_id: run.id,
                    brand_analysis_id: run.brandAnalysisId,
                    competitor_name: competitorName,
                    provider,
                    metric_type: 'position',
                    metric_value: competitor.averagePosition,
                    recorded_at: recordedAt
                  });
                }

                if (typeof competitor.sentimentScore === 'number') {
                  metricEvents.push({
                    run_id: run.id,
                    brand_analysis_id: run.brandAnalysisId,
                    competitor_name: competitorName,
                    provider,
                    metric_type: 'sentiment_score',
                    metric_value: competitor.sentimentScore,
                    recorded_at: recordedAt
                  });
                }

                if (typeof competitor.shareOfVoice === 'number') {
                  metricEvents.push({
                    run_id: run.id,
                    brand_analysis_id: run.brandAnalysisId,
                    competitor_name: competitorName,
                    provider,
                    metric_type: 'share_of_voices',
                    metric_value: competitor.shareOfVoice,
                    recorded_at: recordedAt
                  });
                }
              });
            }
          });

          allBrands.forEach((brandName) => {
            const visibilityScores = providerRankings
              .map((pr) => {
                const competitors = Array.isArray(pr.competitors) ? pr.competitors : [];
                const competitor = competitors.find((c) => typeof c.name === 'string' && c.name === brandName);
                return typeof competitor?.visibilityScore === 'number' ? competitor.visibilityScore : null;
              })
              .filter((score): score is number => typeof score === 'number');

            if (visibilityScores.length > 0) {
              const avgVisibilityScore = visibilityScores.reduce((sum, score) => sum + score, 0) / visibilityScores.length;
              metricEvents.push({
                run_id: run.id,
                brand_analysis_id: run.brandAnalysisId,
                competitor_name: brandName,
                provider: 'all',
                metric_type: 'visibility_average',
                metric_value: avgVisibilityScore,
                recorded_at: recordedAt
              });
            }

            const positions = providerRankings
              .map((pr) => {
                const competitors = Array.isArray(pr.competitors) ? pr.competitors : [];
                const competitor = competitors.find((c) => typeof c.name === 'string' && c.name === brandName);
                return typeof competitor?.averagePosition === 'number' ? competitor.averagePosition : null;
              })
              .filter((pos): pos is number => typeof pos === 'number');

            if (positions.length > 0) {
              const avgPosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
              metricEvents.push({
                run_id: run.id,
                brand_analysis_id: run.brandAnalysisId,
                competitor_name: brandName,
                provider: 'all',
                metric_type: 'average_position',
                metric_value: avgPosition,
                recorded_at: recordedAt
              });
            }
          });

          if (targetBrand) {
            const targetScores = providerRankings
              .flatMap((pr) => {
                const competitors = Array.isArray(pr.competitors) ? pr.competitors : [];
                return competitors.filter((c) => typeof c.name === 'string' && c.name === targetBrand);
              })
              .map((competitor) => (typeof competitor.visibilityScore === 'number' ? competitor.visibilityScore : null))
              .filter((score): score is number => typeof score === 'number');

            if (targetScores.length > 0) {
              const avgScore = targetScores.reduce((sum, score) => sum + score, 0) / targetScores.length;
              metricEvents.push({
                run_id: run.id,
                brand_analysis_id: run.brandAnalysisId,
                competitor_name: targetBrand,
                provider: 'target',
                metric_type: 'average_score',
                metric_value: avgScore,
                recorded_at: recordedAt
              });
            }
          }
        }

        // Insérer les événements pour ce run
        if (metricEvents.length > 0) {
          await db.execute(sql`
            INSERT INTO brand_analysis_metric_events 
            (run_id, brand_analysis_id, competitor_name, provider, metric_type, metric_value, recorded_at)
            VALUES ${sql.join(
              metricEvents.map(event => 
                sql`(${event.run_id}, ${event.brand_analysis_id}, ${event.competitor_name}, ${event.provider}, ${event.metric_type}::metric_type, ${event.metric_value}, ${event.recorded_at})`
              ), 
              sql`, `
            )}
          `);
          
          totalEvents += metricEvents.length;
          logger.info(`Processed run ${run.id}: ${metricEvents.length} events`);
        }

        processedRuns++;

        // Log progress every 10 runs
        if (processedRuns % 10 === 0) {
          logger.info(`Progress: ${processedRuns}/${runs.length} runs processed, ${totalEvents} events created`);
        }

      } catch (error) {
        errors++;
        logger.error(`Failed to process run ${run.id}:`, error);
        // Continue with next run
      }
    }

    logger.info('Backfill completed', {
      totalRuns: runs.length,
      processedRuns,
      totalEvents,
      errors
    });

    // Rafraîchir la materialized view après le backfill
    logger.info('Refreshing materialized view...');
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY brand_analysis_daily_metrics`);
    logger.info('Materialized view refreshed');

  } catch (error) {
    logger.error('Backfill failed:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  backfillMetricEvents()
    .then(() => {
      logger.info('Backfill script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Backfill script failed:', error);
      process.exit(1);
    });
}

export { backfillMetricEvents };
