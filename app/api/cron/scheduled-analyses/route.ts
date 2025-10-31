import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { brandAnalysis } from '@/lib/db/schema';
import { and, eq, lte } from 'drizzle-orm';
import { executeScheduledAnalysis } from '@/lib/scheduled-analysis-runner';
import { logger } from '@/lib/logger';
import type { BrandAnalysis } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    // Vérifier la sécurité CRON
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      logger.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized CRON request', { 
        authHeader: authHeader ? 'present' : 'missing',
        expected: `Bearer ${cronSecret.substring(0, 8)}...`
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('CRON job started: checking scheduled analyses');

    // Récupérer les analyses éligibles
    const eligibleAnalyses = await db
      .select()
      .from(brandAnalysis)
      .where(
        and(
          eq(brandAnalysis.isScheduled, true),
          eq(brandAnalysis.schedulePaused, false),
          lte(brandAnalysis.nextRunAt, new Date())
        )
      );

    logger.info(`Found ${eligibleAnalyses.length} eligible analyses`, {
      analysisIds: eligibleAnalyses.map(a => a.id)
    });

    if (eligibleAnalyses.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No analyses to process'
      });
    }

    // Traiter les analyses en arrière-plan (asynchrone)
    processAnalysesAsync(eligibleAnalyses).catch(error => {
      logger.error('Background processing error:', error);
    });

    // Retourner immédiatement une réponse 200
    logger.info('CRON job queued for background processing', {
      total: eligibleAnalyses.length,
      analysisIds: eligibleAnalyses.map(a => a.id)
    });

    return NextResponse.json({
      success: true,
      processed: eligibleAnalyses.length,
      message: 'Analyses queued for background processing',
      queuedAnalyses: eligibleAnalyses.map(a => ({
        id: a.id,
        userId: a.userId,
        periodicity: a.periodicity
      }))
    });

  } catch (error) {
    logger.error('CRON job error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Traite les analyses en arrière-plan de manière asynchrone
 */
async function processAnalysesAsync(analyses: BrandAnalysis[]): Promise<void> {
  logger.info(`Starting background processing of ${analyses.length} analyses`);

  try {
    // Exécuter chaque analyse en parallèle
    const results = await Promise.allSettled(
      analyses.map(analysis => executeScheduledAnalysis(analysis))
    );

    // Analyser les résultats
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Logger les erreurs
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Background analysis ${analyses[index].id} failed:`, result.reason);
      }
    });

    logger.info('Background processing completed', {
      total: analyses.length,
      successful,
      failed
    });

  } catch (error) {
    logger.error('Background processing failed:', error);
  }
}
