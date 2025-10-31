import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalysis, brandAnalysisRuns } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { 
  AuthenticationError, 
  NotFoundError
} from '@/lib/api-errors';
import { handleApiError } from '@/lib/api-errors';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Vérifier la session
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view runs');
    }

    // Récupérer l'analyse pour vérifier l'accès
    const [analysis] = await db
      .select()
      .from(brandAnalysis)
      .where(eq(brandAnalysis.id, params.id))
      .limit(1);

    if (!analysis) {
      throw new NotFoundError('Analysis not found');
    }

    // TODO: Vérifier que l'utilisateur a accès à cette analyse via le workspace

    // Récupérer les runs avec pagination
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const runs = await db
      .select({
        id: brandAnalysisRuns.id,
        status: brandAnalysisRuns.status,
        startedAt: brandAnalysisRuns.startedAt,
        completedAt: brandAnalysisRuns.completedAt,
        creditsUsed: brandAnalysisRuns.creditsUsed,
        errorMessage: brandAnalysisRuns.errorMessage,
        retryCount: brandAnalysisRuns.retryCount,
        visibilityScore: brandAnalysisRuns.visibilityScore,
        competitorsCount: brandAnalysisRuns.competitorsCount,
        promptsCount: brandAnalysisRuns.promptsCount,
        createdAt: brandAnalysisRuns.createdAt,
      })
      .from(brandAnalysisRuns)
      .where(eq(brandAnalysisRuns.brandAnalysisId, params.id))
      .orderBy(desc(brandAnalysisRuns.createdAt))
      .limit(limit)
      .offset(offset);

    // Compter le total pour la pagination
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brandAnalysisRuns)
      .where(eq(brandAnalysisRuns.brandAnalysisId, params.id));

    logger.info(`Retrieved ${runs.length} runs for analysis ${params.id}`, {
      analysisId: params.id,
      userId: sessionResponse.user.id,
      limit,
      offset
    });

    return NextResponse.json({
      runs,
      pagination: {
        total: totalCount?.count || 0,
        limit,
        offset,
        hasMore: runs.length === limit
      }
    });

  } catch (error) {
    logger.error('Runs fetch error:', error);
    return handleApiError(error);
  }
}
