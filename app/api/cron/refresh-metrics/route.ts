import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

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
      logger.warn('Unauthorized CRON request for metrics refresh', { 
        authHeader: authHeader ? 'present' : 'missing',
        expected: `Bearer ${cronSecret.substring(0, 8)}...`
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('CRON job started: refreshing metrics materialized view');

    // Rafraîchir la materialized view
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY brand_analysis_daily_metrics`);

    // Vérifier les statistiques de la materialized view
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT analysis_id) as unique_analyses,
        COUNT(DISTINCT competitor_name) as unique_competitors,
        COUNT(DISTINCT provider) as unique_providers,
        MIN(metric_date) as earliest_date,
        MAX(metric_date) as latest_date
      FROM brand_analysis_daily_metrics
    `);

    const statsData = stats.rows[0] as {
      total_records: number;
      unique_analyses: number;
      unique_competitors: number;
      unique_providers: number;
      earliest_date: string;
      latest_date: string;
    };

    logger.info('CRON job completed: metrics materialized view refreshed', {
      totalRecords: statsData.total_records,
      uniqueAnalyses: statsData.unique_analyses,
      uniqueCompetitors: statsData.unique_competitors,
      uniqueProviders: statsData.unique_providers,
      dateRange: `${statsData.earliest_date} to ${statsData.latest_date}`
    });

    return NextResponse.json({
      success: true,
      message: 'Metrics materialized view refreshed successfully',
      stats: statsData
    });

  } catch (error) {
    logger.error('CRON job error for metrics refresh:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
