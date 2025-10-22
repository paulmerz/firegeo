import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses, brandAnalysisSources } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { extractAnalysisSources } from '@/lib/brand-monitor-sources';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { getUserDefaultWorkspace } from '@/lib/db/workspace-service';

// GET /api/brand-monitor/analyses - Get user's brand analyses
export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view your analyses');
    }


    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
      with: {
        sources: true,
      },
    });
    
    const enrichedAnalyses = analyses.map((analysis) => {
      const sources = extractAnalysisSources(analysis.analysisData, analysis.sources);
      const baseData = analysis.analysisData && typeof analysis.analysisData === 'object'
        ? { ...analysis.analysisData }
        : {};
    
      return {
        ...analysis,
        sources,
        analysisData: {
          ...baseData,
          sources,
        },
      };
    });
    
    return NextResponse.json(enrichedAnalyses);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/brand-monitor/analyses - Save a new brand analysis
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to save analyses');
    }

    const body = await request.json();
    
    if (!body.url || !body.analysisData) {
      const fields: Record<string, string> = {};
      if (!body.url) fields.url = 'URL is required';
      if (!body.analysisData) fields.analysisData = 'Analysis data is required';
      
      throw new ValidationError('Invalid request', fields);
    }

    const workspaceId = await getUserDefaultWorkspace(sessionResponse.user.id);

    const [analysis] = await db.insert(brandAnalyses).values({
      userId: sessionResponse.user.id,
      workspaceId, // NOUVEAU
      url: body.url,
      companyName: body.companyName,
      industry: body.industry,
      analysisData: body.analysisData,
      competitors: body.competitors,
      prompts: body.prompts,
      creditsUsed: body.creditsUsed || 10,
    }).returning();
    
    const extractedSources = extractAnalysisSources(body.analysisData);
    let persistedSources: Array<{ [key: string]: unknown }> = [];
    
    if (extractedSources.length > 0) {
      const values = extractedSources.map((source) => ({
        analysisId: analysis.id,
        provider: source.provider ?? null,
        prompt: source.prompt ?? null,
        domain: source.domain ?? null,
        url: source.url ?? null,
        sourceType: source.sourceType ?? null,
        metadata: source.metadata ?? null,
      }));
    
      persistedSources = await db.insert(brandAnalysisSources)
        .values(values)
        .returning();
    }
    
    const normalizedSources = extractAnalysisSources(body.analysisData, persistedSources);
    const baseData = analysis.analysisData && typeof analysis.analysisData === 'object'
      ? { ...analysis.analysisData }
      : {};
    
    return NextResponse.json({
      ...analysis,
      sources: normalizedSources,
      analysisData: {
        ...baseData,
        sources: normalizedSources,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
