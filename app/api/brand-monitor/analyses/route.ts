import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalysis, brandAnalysisSources, brandAnalysisRuns, companies } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { extractAnalysisSources } from '@/lib/brand-monitor-sources';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { getUserDefaultWorkspace } from '@/lib/db/workspace-service';
import { getOrCreateCompanyByUrl } from '@/lib/db/companies-service';
import { insertMetricEvents } from '@/lib/scheduled-analysis-runner';

// GET /api/brand-monitor/analyses - Get user's brand analyses
export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view your analyses');
    }


    const analyses = await db.query.brandAnalysis.findMany({
      where: eq(brandAnalysis.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalysis.createdAt),
      with: {
        sources: true,
        company: {
          with: {
            locales: true, // Inclure les locales de la company
          },
        },
      },
    });
    
    const enrichedAnalyses = analyses.map((analysis) => {
      // Récupérer les sources depuis le dernier run
      const sources = analysis.sources || [];
    
      return {
        ...analysis,
        sources,
        analysisData: {
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
    
    // Vérifier qu'on a soit une URL (nouvelle analyse) soit un companyId (analyse existante)
    if (!body.url && !body.companyId) {
      throw new ValidationError('Invalid request', { 
        url: 'URL is required for new analysis',
        companyId: 'CompanyId is required for existing analysis'
      });
    }

    const workspaceId = await getUserDefaultWorkspace(sessionResponse.user.id);

    let company;
    if (body.companyId) {
      // Récupérer la company existante par ID
      const existingCompany = await db.query.companies.findFirst({
        where: eq(companies.id, body.companyId),
        with: {
          locales: true,
        },
      });
      
      if (!existingCompany) {
        throw new ValidationError('Invalid request', { companyId: 'Company not found' });
      }
      
      company = existingCompany;
    } else {
      // Obtenir ou créer la company à partir de l'URL
      const result = await getOrCreateCompanyByUrl({
        url: body.url,
        preferredName: body.companyName,
      });
      company = result.company;
    }

    const [analysis] = await db.insert(brandAnalysis).values({
      userId: sessionResponse.user.id,
      workspaceId,
      companyId: company.id, // Utiliser companyId au lieu de url, companyName, industry
      analysisName: `Analyse_${company.name}`, // Générer le nom au format "Analyse_{{company_name}}"
      competitors: body.competitors,
      prompts: body.prompts,
      creditsUsed: body.creditsUsed || 10,
    }).returning();

    // Créer un run initial pour la première analyse
    const [initialRun] = await db.insert(brandAnalysisRuns).values({
      brandAnalysisId: analysis.id,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      creditsUsed: body.creditsUsed || 10,
      analysisData: body.analysisData,
      visibilityScore: body.analysisData?.visibilityScore || null,
      competitorsCount: body.competitors?.length || 0,
      promptsCount: body.prompts?.length || 0,
    }).returning();
    
    const extractedSources = extractAnalysisSources(body.analysisData);
    let persistedSources: Array<{ [key: string]: unknown }> = [];
    
    if (extractedSources.length > 0) {
      const values = extractedSources.map((source) => ({
        runId: initialRun.id, // Lier aux runs au lieu de l'analyse
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
    
    // Insérer les métriques dans brand_analysis_metric_events
    if (body.analysisData) {
      try {
        await insertMetricEvents(initialRun.id, analysis.id, body.analysisData);
      } catch (error) {
        // Log l'erreur mais ne pas faire échouer la sauvegarde
        console.error('Failed to insert metric events:', error);
      }
    }
    
    return NextResponse.json({
      ...analysis,
      sources: normalizedSources,
      analysisData: {
        sources: normalizedSources,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
