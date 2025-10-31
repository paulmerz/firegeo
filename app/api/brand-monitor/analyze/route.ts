import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { Autumn } from 'autumn-js';
import { performAnalysis, createSSEMessage, type AnalysisResult } from '@/lib/analyze-common';
import { SSEEvent, type MockMode } from '@/lib/types';
import { getLocaleFromRequest } from '@/lib/locale-utils';
import { 
  AuthenticationError, 
  InsufficientCreditsError, 
  ValidationError, 
  ExternalServiceError
} from '@/lib/api-errors';
import { 
  FEATURE_ID_CREDITS, 
  ERROR_MESSAGES
} from '@/config/constants';
import { apiUsageTracker } from '@/lib/api-usage-tracker';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { brandAnalysis, brandAnalysisRuns } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getOrCreateCompanyByUrl } from '@/lib/db/companies-service';
import { getUserDefaultWorkspace } from '@/lib/db/workspace-service';
import { insertMetricEvents } from '@/lib/scheduled-analysis-runner';

function getAutumn() {
  const secret = process.env.AUTUMN_SECRET_KEY;
  if (!secret) {
    throw new Error('Autumn secret key or publishable key is required');
  }
  return new Autumn({ secretKey: secret });
}

export const runtime = 'nodejs'; // Use Node.js runtime for streaming
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Get the session
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to use brand monitor');
    }

  // Plus de débit forfaitaire ici. Le coût est désormais distribué par action (URL, concurrents, prompts).

    const { company, prompts: customPrompts, competitors: userSelectedCompetitors, useWebSearch = false } = await request.json();

    if (!company || !company.name) {
      throw new ValidationError(ERROR_MESSAGES.COMPANY_INFO_REQUIRED, {
        company: 'Company name is required'
      });
    }

    // Start tracking for this analysis
    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    apiUsageTracker.startAnalysis(analysisId);
    logger.info(`[ApiUsageTracker] Début du tracking pour l'analyse: ${analysisId}`);

    // Créer l'entrée brand_analysis dès le début avec les prompts
    const workspaceId = await getUserDefaultWorkspace(sessionResponse.user.id);
    
    // Obtenir ou créer la company
    const { company: resolvedCompany } = await getOrCreateCompanyByUrl({
      url: company.url,
      preferredName: company.name,
    });

    // Créer l'analyse avec les prompts
    const [newAnalysis] = await db.insert(brandAnalysis).values({
      userId: sessionResponse.user.id,
      workspaceId,
      companyId: resolvedCompany.id,
      analysisName: `Analyse_${resolvedCompany.name}`,
      competitors: userSelectedCompetitors || [],
      prompts: customPrompts || [],
      creditsUsed: (Array.isArray(customPrompts) ? customPrompts.length : 0) * 2,
    }).returning();

    logger.info(`[Analyze] Created brand_analysis: ${newAnalysis.id}`);



    // Get remaining credits after deduction
    let remainingCredits = 0;
    try {
      const usage = await getAutumn().check({
        customer_id: sessionResponse.user.id,
        feature_id: FEATURE_ID_CREDITS,
      });
      remainingCredits = usage.data?.balance || 0;
    } catch (err) {
      logger.error('Failed to get remaining credits:', err);
    }

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Function to send SSE events
    const sendEvent = async (event: SSEEvent) => {
      await writer.write(encoder.encode(createSSEMessage(event)));
    };

    // Start the async processing
    (async () => {
      try {
        // Send initial credit info
        await sendEvent({
          type: 'progress',
          stage: 'initializing',
          data: {
            remainingCredits,
            creditsUsed: (Array.isArray(customPrompts) ? customPrompts.length : 0) * 2
          },
          timestamp: new Date()
        });

        // Extract locale and mockMode from request
        const locale = getLocaleFromRequest(request);
        const headerMock = request.headers.get('x-mock-mode') as MockMode | null;
        const urlMock = (request as NextRequest).nextUrl?.searchParams?.get('mockMode') as MockMode | null;
        const mockMode = (headerMock || urlMock || 'none') as MockMode;
        
        // Brand variations are now pre-generated before analysis starts
        // No need to fetch them here anymore
        
        // Perform the analysis using common logic
        const analysisResult = await performAnalysis({
          company,
          customPrompts,
          userSelectedCompetitors,
          useWebSearch,
          sendEvent,
          locale,
          mockMode
        });

        // Brand variations are now pre-generated before analysis starts
        // No need to save them here anymore
        
        // Send final complete event with all data
        // Log API usage summary
        apiUsageTracker.logSummary();
        
        // Créer le brand_analysis_runs avec les résultats
        const [analysisRun] = await db.insert(brandAnalysisRuns).values({
          brandAnalysisId: newAnalysis.id,
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          creditsUsed: (Array.isArray(customPrompts) ? customPrompts.length : 0) * 2,
          analysisData: analysisResult,
          visibilityScore: (analysisResult as any)?.visibilityScore || null,
          competitorsCount: userSelectedCompetitors?.length || 0,
          promptsCount: customPrompts?.length || 0,
        }).returning();

        logger.info(`[Analyze] Created brand_analysis_runs: ${analysisRun.id}`);

        // Parser les résultats pour brand_analysis_metric_events
        if (analysisResult) {
          try {
            await insertMetricEvents(analysisRun.id, newAnalysis.id, analysisResult as Record<string, unknown>);
            logger.info(`[Analyze] Inserted metric events for run: ${analysisRun.id}`);
          } catch (error) {
            logger.error('Failed to insert metric events:', error);
          }
        }

        await sendEvent({
          type: 'complete',
          stage: 'finalizing',
          data: {
            analysis: analysisResult,
            analysisId: newAnalysis.id, // Inclure l'ID de l'analyse créée
            apiUsageSummary: apiUsageTracker.getSummary()
          },
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Analysis error:', error);
        
        // Créer un run avec le statut "failed"
        try {
          await db.insert(brandAnalysisRuns).values({
            brandAnalysisId: newAnalysis.id,
            status: 'failed',
            startedAt: new Date(),
            completedAt: new Date(),
            creditsUsed: 0,
            analysisData: null,
            visibilityScore: null,
            competitorsCount: userSelectedCompetitors?.length || 0,
            promptsCount: customPrompts?.length || 0,
          });
          logger.info(`[Analyze] Created failed brand_analysis_runs for analysis: ${newAnalysis.id}`);
        } catch (dbError) {
          logger.error('Failed to create failed analysis run:', dbError);
        }
        
        await sendEvent({
          type: 'error',
          stage: 'finalizing',
          data: {
            message: error instanceof Error ? error.message : 'Analysis failed'
          },
          timestamp: new Date()
        });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    // For SSE endpoints, we need to return a proper error response
    // instead of using handleApiError which returns NextResponse
    logger.error('Brand monitor analyze API error:', error);
    
    if (error instanceof AuthenticationError ||
        error instanceof InsufficientCreditsError ||
        error instanceof ValidationError ||
        error instanceof ExternalServiceError) {
      return new Response(
        JSON.stringify({
          error: {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            timestamp: new Date().toISOString(),
            metadata: error instanceof InsufficientCreditsError ? {
              creditsRequired: error.creditsRequired,
              creditsAvailable: error.creditsAvailable
            } : undefined
          }
        }),
        { 
          status: error.statusCode, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}