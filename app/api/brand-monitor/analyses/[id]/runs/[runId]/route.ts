import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalysis, brandAnalysisRuns, brandAnalysisSources } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { 
  AuthenticationError, 
  NotFoundError
} from '@/lib/api-errors';
import { handleApiError } from '@/lib/api-errors';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  try {
    // Vérifier la session
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view run details');
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

    // Récupérer le run avec ses sources
    const [run] = await db
      .select()
      .from(brandAnalysisRuns)
      .where(
        and(
          eq(brandAnalysisRuns.id, params.runId),
          eq(brandAnalysisRuns.brandAnalysisId, params.id)
        )
      )
      .limit(1);

    if (!run) {
      throw new NotFoundError('Run not found');
    }

    // Récupérer les sources du run
    const sources = await db
      .select()
      .from(brandAnalysisSources)
      .where(eq(brandAnalysisSources.runId, params.runId))
      .orderBy(brandAnalysisSources.createdAt);

    logger.info(`Retrieved run details for ${params.runId}`, {
      analysisId: params.id,
      runId: params.runId,
      userId: sessionResponse.user.id,
      status: run.status
    });

    return NextResponse.json({
      run: {
        ...run,
        sources
      }
    });

  } catch (error) {
    logger.error('Run details fetch error:', error);
    return handleApiError(error);
  }
}
