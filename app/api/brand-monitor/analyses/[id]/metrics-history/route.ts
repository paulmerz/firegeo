import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { brandAnalysisRuns, brandAnalysis, brandAnalysisMetricEvents } from '@/lib/db/schema';
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

    // Construire la requête pour récupérer les métriques directement depuis la table
    let query = db
      .select({
        runId: brandAnalysisMetricEvents.runId,
        competitorName: brandAnalysisMetricEvents.competitorName,
        provider: brandAnalysisMetricEvents.provider,
        metricValue: brandAnalysisMetricEvents.metricValue,
        recordedAt: brandAnalysisMetricEvents.recordedAt,
        completedAt: brandAnalysisRuns.completedAt,
        isOwn: sql<boolean>`CASE WHEN ${brandAnalysisMetricEvents.competitorName} = ${brandAnalysis.companyName} THEN true ELSE false END`
      })
      .from(brandAnalysisMetricEvents)
      .innerJoin(brandAnalysisRuns, eq(brandAnalysisMetricEvents.runId, brandAnalysisRuns.id))
      .innerJoin(brandAnalysis, eq(brandAnalysisMetricEvents.brandAnalysisId, brandAnalysis.id))
      .where(
        and(
          eq(brandAnalysisMetricEvents.brandAnalysisId, analysisId),
          eq(brandAnalysisMetricEvents.metricType, metricType),
          eq(brandAnalysisRuns.status, 'completed')
        )
      );

    // Filtres optionnels
    if (competitorNames.length > 0) {
      query = query.where(inArray(brandAnalysisMetricEvents.competitorName, competitorNames));
    }

    if (providers.length > 0) {
      query = query.where(inArray(brandAnalysisMetricEvents.provider, providers));
    }

    if (startDate) {
      const start = new Date(startDate);
      query = query.where(gte(brandAnalysisRuns.completedAt, start));
    }

    if (endDate) {
      const end = new Date(endDate);
      query = query.where(lte(brandAnalysisRuns.completedAt, end));
    }

    // Ordonner par date de completion
    query = query.orderBy(desc(brandAnalysisRuns.completedAt));

    const results = await query;

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

      seriesMap.get(key)!.dataPoints.push({
        runId: row.runId,
        date: row.completedAt || row.recordedAt,
        value: row.metricValue
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
