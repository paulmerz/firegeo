import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalysis, brandAnalysisRuns } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { extractAnalysisSources } from '@/lib/brand-monitor-sources';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/api-errors';

// GET /api/brand-monitor/analyses/[id] - Get a specific analysis
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view this analysis');
    }

    const { id: analysisId } = await params;

    const analysis = await db.query.brandAnalysis.findFirst({
      where: and(
        eq(brandAnalysis.id, analysisId),
        eq(brandAnalysis.userId, sessionResponse.user.id)
      ),
      with: {
        sources: true,
        company: {
          with: {
            locales: true, // Inclure les locales de la company
          },
        },
      },
    });

    if (!analysis) {
      throw new NotFoundError('Analysis not found');
    }

    // Récupérer le dernier run pour obtenir les données d'analyse complètes
    const [latestRun] = await db
      .select()
      .from(brandAnalysisRuns)
      .where(eq(brandAnalysisRuns.brandAnalysisId, analysisId))
      .orderBy(desc(brandAnalysisRuns.createdAt))
      .limit(1);

    const sources = analysis.sources || [];

    // Construire les données d'analyse complètes
    const analysisData = latestRun?.analysisData || null;

    return NextResponse.json({
      ...analysis,
      sources,
      analysisData: analysisData ? {
        ...analysisData,
        sources,
      } : {
        sources,
      },
      // Inclure les métadonnées du dernier run
      latestRun: latestRun ? {
        id: latestRun.id,
        status: latestRun.status,
        startedAt: latestRun.startedAt,
        completedAt: latestRun.completedAt,
        visibilityScore: latestRun.visibilityScore,
        competitorsCount: latestRun.competitorsCount,
        promptsCount: latestRun.promptsCount,
      } : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/brand-monitor/analyses/[id] - Delete an analysis
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to delete this analysis');
    }

    const { id: analysisId } = await params;

    const result = await db.delete(brandAnalysis)
      .where(and(
        eq(brandAnalysis.id, analysisId),
        eq(brandAnalysis.userId, sessionResponse.user.id)
      ))
      .returning();

    if (result.length === 0) {
      throw new NotFoundError('Analysis not found');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}