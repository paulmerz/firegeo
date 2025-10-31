import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { brandAnalysisRuns, brandAnalysis, brandAnalysisMetricEvents, companies } from '@/lib/db/schema';
import { eq, and, inArray, gte, lte, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id;
    const { searchParams } = new URL(request.url);
    
    // Paramètres de requête
    const competitorNames = searchParams.getAll('competitorNames');
    const providers = searchParams.get('providers')?.split(',').filter(Boolean) || [];
    const metricType = searchParams.get('metricType') || 'visibility_score';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    logger.info(`🔍 Metrics API called for analysis ${analysisId}`, {
      metricType,
      providers,
      competitorNames,
      startDate,
      endDate
    });

    // Vérifier que l'analyse existe et appartient à l'utilisateur
    const analysis = await db
      .select({ id: brandAnalysis.id, userId: brandAnalysis.userId })
      .from(brandAnalysis)
      .where(eq(brandAnalysis.id, analysisId))
      .limit(1);

    if (analysis.length === 0) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Conditions dynamiques pour la requête
    const conditions = [
      eq(brandAnalysisMetricEvents.brandAnalysisId, analysisId),
      eq(brandAnalysisMetricEvents.metricType, metricType),
      eq(brandAnalysisRuns.status, 'completed')
    ];

    if (competitorNames.length > 0) {
      conditions.push(inArray(brandAnalysisMetricEvents.competitorName, competitorNames));
    }

    if (providers.length > 0) {
      conditions.push(inArray(brandAnalysisMetricEvents.provider, providers));
    }

    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) {
        conditions.push(gte(brandAnalysisRuns.completedAt, start));
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!Number.isNaN(end.getTime())) {
        conditions.push(lte(brandAnalysisRuns.completedAt, end));
      }
    }

    const whereClause = and(...conditions);

    const results = await db
      .select({
        runId: brandAnalysisMetricEvents.runId,
        competitorName: brandAnalysisMetricEvents.competitorName,
        provider: brandAnalysisMetricEvents.provider,
        metricValue: brandAnalysisMetricEvents.metricValue,
        recordedAt: brandAnalysisMetricEvents.recordedAt,
        completedAt: brandAnalysisRuns.completedAt,
        isOwn: sql<boolean>`CASE WHEN ${brandAnalysisMetricEvents.competitorName} = ${companies.name} THEN true ELSE false END`
      })
      .from(brandAnalysisMetricEvents)
      .innerJoin(brandAnalysisRuns, eq(brandAnalysisMetricEvents.runId, brandAnalysisRuns.id))
      .innerJoin(brandAnalysis, eq(brandAnalysisMetricEvents.brandAnalysisId, brandAnalysis.id))
      .innerJoin(companies, eq(brandAnalysis.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(brandAnalysisRuns.completedAt));

    logger.info(`📊 Query returned ${results.length} results`);

    // Grouper les données par concurrent et provider
    const seriesMap = new Map<string, {
      competitor: string;
      provider: string;
      isOwn: boolean;
      dataPoints: Array<{
        runId: string;
        date: Date;
        value: number;
      }>;
    }>();

    results.forEach(row => {
      const key = `${row.competitorName}-${row.provider}`;
      
      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          competitor: row.competitorName,
          provider: row.provider,
          isOwn: row.isOwn,
          dataPoints: []
        });
      }

      const numericValue = typeof row.metricValue === 'number'
        ? row.metricValue
        : Number(row.metricValue);

      if (Number.isNaN(numericValue)) {
        logger.warn('Invalid metric value encountered in metrics history', {
          runId: row.runId,
          competitor: row.competitorName,
          provider: row.provider,
          rawValue: row.metricValue
        });
        return;
      }

      seriesMap.get(key)!.dataPoints.push({
        runId: row.runId,
        date: row.completedAt || row.recordedAt,
        value: numericValue
      });
    });

    // Convertir en array et trier les dataPoints par date
    const series = Array.from(seriesMap.values()).map(serie => ({
      ...serie,
      dataPoints: serie.dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime())
    }));

    logger.info(`Retrieved metrics history for analysis ${analysisId}`, {
      analysisId,
      metricType,
      seriesCount: series.length,
      totalDataPoints: series.reduce((sum, s) => sum + s.dataPoints.length, 0)
    });

    const response = {
      metricType,
      series
    };

    logger.info(`📤 Returning response:`, JSON.stringify(response, null, 2));

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to retrieve metrics history:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics history' },
      { status: 500 }
    );
  }
}
