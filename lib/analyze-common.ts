import { AIResponse, AnalysisProgressData, Company, PartialResultData, ProgressData, PromptGeneratedData, ScoringProgressData, SSEEvent, AnalysisSource, BrandPrompt, CompetitorRanking, ProviderSpecificRanking, ProviderComparisonData, type MockMode, AIResponseAnalysis } from './types';
import { analyzePromptWithProvider, calculateBrandScores, identifyCompetitors, analyzeCompetitorsByProvider } from './ai-utils';
import { analyzePromptWithProvider as analyzePromptWithProviderEnhanced } from './ai-utils-enhanced';
import { analyzeAIResponse } from './ai-response-analyzer';
import { extractAnalysisSources } from './brand-monitor-sources';
import { getConfiguredProviders } from './provider-config';
import { apiUsageTracker, type ApiUsageSummary } from './api-usage-tracker';
import { logger } from './logger';
import { ensureBrandVariationsForBrand } from './brand-variations-service';
import type { BrandVariation } from './types';

export interface AnalysisConfig {
  company: Company;
  customPrompts?: string[];
  userSelectedCompetitors?: { name: string }[];
  useWebSearch?: boolean;
  sendEvent: (event: SSEEvent) => Promise<void>;
  locale?: string;
  mockMode?: MockMode;
}

export interface AnalysisResult {
  company: Company;
  knownCompetitors: string[];
  prompts: BrandPrompt[];
  responses: AIResponse[];
  analyses?: AIResponseAnalysis[];
  scores: {
    visibilityScore: number;
    sentimentScore: number;
    shareOfVoice: number;
    overallScore: number;
    averagePosition: number;
  };
  competitors: CompetitorRanking[];
  providerRankings: ProviderSpecificRanking[];
  providerComparison: ProviderComparisonData[];
  sources: AnalysisSource[];
  errors?: string[];
  webSearchUsed?: boolean;
  apiUsageSummary?: ApiUsageSummary;
  brandVariations?: Record<string, BrandVariation>;
  // Signature d'index pour compatibilité avec Record<string, unknown>
  [key: string]: unknown;
}

/**
 * Common analysis logic extracted from both API routes
 */
export async function performAnalysis({
  company,
  customPrompts,
  userSelectedCompetitors,
  useWebSearch = false,
  sendEvent,
  locale,
  mockMode = 'none'
}: AnalysisConfig): Promise<AnalysisResult> {
  // Send start event
  await sendEvent({
    type: 'start',
    stage: 'initializing',
    data: { 
      message: `Starting analysis for ${company.name}${useWebSearch ? ' with web search' : ''}` 
    } as ProgressData,
    timestamp: new Date()
  });

  // Stage 1: Identify competitors
  await sendEvent({
    type: 'stage',
    stage: 'identifying-competitors',
    data: { 
      stage: 'identifying-competitors',
      progress: 0,
      message: 'Identifying competitors...'
    } as ProgressData,
    timestamp: new Date()
  });

  // Use user-selected competitors if provided, otherwise identify them
  let competitors: string[];
  if (userSelectedCompetitors && userSelectedCompetitors.length > 0) {
    competitors = userSelectedCompetitors.map(c => c.name);
    logger.info('Using user-selected competitors:', competitors);
    
    // Send competitor events for UI
    for (let i = 0; i < competitors.length; i++) {
      await sendEvent({
        type: 'competitor-found',
        stage: 'identifying-competitors',
        data: { 
          competitor: competitors[i],
          index: i + 1,
          total: competitors.length
        },
        timestamp: new Date()
      });
    }
  } else {
    competitors = await identifyCompetitors(company, sendEvent);
  }

  // Keep competitor names as provided; brand variations will handle detection

  // Stage 2: Generate prompts
  // Skip the 100% progress for competitors and go straight to the next stage
  await sendEvent({
    type: 'stage',
    stage: 'generating-prompts',
    data: {
      stage: 'generating-prompts',
      progress: 0,
      message: 'Generating analysis prompts...'
    } as ProgressData,
    timestamp: new Date()
  });

  // Use the prompts provided by the UI (already generated)
  // No need to regenerate prompts since they are always provided from the UI
  if (!customPrompts || customPrompts.length === 0) {
    // Keep a stable message to allow client-side i18n mapping
    throw new Error('Please provide a prompt for the analysis');
  }
  
  // Pre-warm brand variations cache for target brand and competitors
  try {
    const prewarmBrands = [company.name, ...(competitors || [])];
    await Promise.all(
      prewarmBrands.map(async (brand) => {
        try {
          await ensureBrandVariationsForBrand(brand, locale);
        } catch (e) {
          logger.warn(`[Brand Variations] Prewarm failed for "${brand}":`, e);
        }
      })
    );
  } catch (e) {
    logger.warn('[Brand Variations] Prewarm batch failed:', e);
  }

  // Convert string prompts to BrandPrompt objects
  const analysisPrompts = customPrompts.map((prompt: string, index: number) => ({
    id: `prompt-${index}`,
    prompt,
    category: 'custom' as const
  }));

  // Send prompt generated events
  for (let i = 0; i < analysisPrompts.length; i++) {
    await sendEvent({
      type: 'prompt-generated',
      stage: 'generating-prompts',
      data: {
        prompt: analysisPrompts[i].prompt,
        category: analysisPrompts[i].category,
        index: i + 1,
        total: analysisPrompts.length
      } as PromptGeneratedData,
      timestamp: new Date()
    });
  }

  // Stage 3: Analyze with AI providers (0-70% of total progress)
  await sendEvent({
    type: 'stage',
    stage: 'analyzing-prompts',
    data: {
      stage: 'analyzing-prompts',
      progress: 0,
      message: `Starting prompts analysis${useWebSearch ? ' with web search' : ''}...`
    } as ProgressData,
    timestamp: new Date()
  });

  const responses: AIResponse[] = [];
  const analyses: AIResponseAnalysis[] = [];
  const errors: string[] = [];
  let brandVariations: Record<string, BrandVariation> | undefined;
  
  // Filter providers based on available API keys
  const availableProviders = getAvailableProviders();
  
  logger.debug('=== PROVIDER DIAGNOSIS ===');
  logger.debug('Available providers for analysis:', availableProviders.map(p => p.name));
  logger.debug('Available provider details:', availableProviders.map(p => ({ name: p.name, model: p.model })));
  logger.debug('Environment variables:', {
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    hasGoogle: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    hasPerplexity: !!process.env.PERPLEXITY_API_KEY
  });
  logger.debug('Raw configured providers:', getConfiguredProviders().map(p => ({ 
    name: p.name, 
    enabled: p.enabled, 
    configured: p.isConfigured() 
  })));
  logger.info('Web search enabled:', useWebSearch);
  logger.info('Number of prompts:', analysisPrompts.length);
  logger.info('Number of available providers:', availableProviders.length);
  
  let completedAnalyses = 0;

  // If no providers are available, return early with error
  if (availableProviders.length === 0) {
    logger.error('No providers available for analysis');
    await sendEvent({
      type: 'error',
      stage: 'analyzing-prompts',
      data: {
        message: 'Aucun fournisseur d\'IA configuré. Veuillez configurer au moins une clé API (OpenAI, Anthropic, Google, ou Perplexity).'
      },
      timestamp: new Date()
    });
    return {
      company,
      knownCompetitors: [],
      prompts: analysisPrompts,
      responses: [],
      scores: {
        visibilityScore: 0,
        sentimentScore: 0,
        shareOfVoice: 0,
        overallScore: 0,
        averagePosition: 0
      },
      competitors: [],
      providerRankings: [],
      providerComparison: [],
      sources: [],
      errors: ['No AI providers configured'],
      webSearchUsed: useWebSearch,
    };
  }

  const workingProviders = availableProviders;

  // Recalculate total analyses with working providers
  const totalAnalyses = analysisPrompts.length * workingProviders.length;
  logger.info('Updated total analyses to perform:', totalAnalyses);

  // Process prompts in parallel batches of 3
  const BATCH_SIZE = 3;
  
  for (let batchStart = 0; batchStart < analysisPrompts.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, analysisPrompts.length);
    const batchPrompts = analysisPrompts.slice(batchStart, batchEnd);
    
    // Create all analysis promises for this batch
    const batchPromises = batchPrompts.flatMap((prompt, batchIndex) => 
      workingProviders.map(async (provider) => {
        const promptIndex = batchStart + batchIndex;
        
        // Send analysis start event
        await sendEvent({
          type: 'analysis-start',
          stage: 'analyzing-prompts',
          data: {
            provider: provider.name,
            prompt: prompt.prompt,
            promptIndex: promptIndex + 1,
            totalPrompts: analysisPrompts.length,
            providerIndex: 0,
            totalProviders: workingProviders.length,
            status: 'started'
          } as AnalysisProgressData,
          timestamp: new Date()
        });

        try {
          // Debug log for each provider attempt
          logger.debug(`\n=== STARTING ANALYSIS ===`);
          logger.debug(`Provider: ${provider.name}`);
          logger.debug(`Prompt: "${prompt.prompt.substring(0, 50)}..."`); 
          logger.debug(`Use web search: ${useWebSearch}`);
          logger.debug(`Brand: ${company.name}`);
          logger.debug(`Competitors: ${competitors.slice(0, 3).join(', ')}${competitors.length > 3 ? '...' : ''}`);
          
          // Call the appropriate analysis function based on useWebSearch
          const response = useWebSearch 
            ? await analyzePromptWithProviderEnhanced(
                prompt.prompt,
                provider.name,
                true,
                { mockMode }
              )
            : await analyzePromptWithProvider(
                prompt.prompt, 
                provider.name, 
                company.name, 
                competitors,
                locale,
                { mockMode }
              );
          
          logger.debug(`\n=== ANALYSIS COMPLETED ===`);
          logger.debug(`Provider: ${provider.name}`);
          logger.debug(`Has response: ${!!response}`);
          if (response) {
            logger.debug(`Response provider: ${response.provider}`);
            logger.debug(`Response length: ${response.response?.length || 0}`);
            logger.debug(`Response preview: "${response.response?.substring(0, 100) || 'NO RESPONSE'}"`); 
          } else {
            logger.debug(`Response is null - provider likely not configured`);
          }
          
          // Skip if provider returned null (not configured)
          if (response === null) {
            logger.debug(`Skipping ${provider.name} - not configured`);
            
            // Send analysis complete event with skipped status
            await sendEvent({
              type: 'analysis-complete',
              stage: 'analyzing-prompts',
              data: {
                provider: provider.name,
                prompt: prompt.prompt,
                promptIndex: promptIndex + 1,
                totalPrompts: analysisPrompts.length,
                providerIndex: 0,
                totalProviders: workingProviders.length,
                status: 'failed'
              } as AnalysisProgressData,
              timestamp: new Date()
            });
            
            // Continue with next provider instead of returning early
            completedAnalyses++;
            const progress = Math.round((completedAnalyses / totalAnalyses) * 100);
            
            await sendEvent({
              type: 'progress',
              stage: 'analyzing-prompts',
              data: {
                stage: 'analyzing-prompts',
                progress,
                message: `Completed ${completedAnalyses} of ${totalAnalyses} analyses`
              } as ProgressData,
              timestamp: new Date()
            });
            
            return; // Return early to continue with next provider
          }
          
          responses.push(response);
          try {
            if (!brandVariations) {
              // Generate variations lazily only if not generated yet later in pipeline
            }
            const localAnalysis = await analyzeAIResponse(response, company.name, competitors, brandVariations || {});
            analyses.push(localAnalysis);
          } catch (e) {
            logger.warn('[AnalyzeCommon] Local analysis failed:', (e as Error)?.message);
          }
          logger.debug(`[AnalyzeCommon] ✅ Response added to collection. Total responses: ${responses.length}`);
          logger.debug(`[AnalyzeCommon] Response details:`, {
            provider: response.provider,
            promptPreview: response.prompt.substring(0, 50) + '...',
            responseLength: response.response.length,
          });

          // Send partial result
          const lastAnalysis = analyses[analyses.length - 1];
          await sendEvent({
            type: 'partial-result',
            stage: 'analyzing-prompts',
            data: {
              provider: provider.name,
              prompt: prompt.prompt,
              response: lastAnalysis ? {
                provider: lastAnalysis.provider,
                brandMentioned: lastAnalysis.brandMentioned,
                brandPosition: lastAnalysis.brandPosition,
                sentiment: lastAnalysis.sentiment
              } : {}
            } as PartialResultData,
            timestamp: new Date()
          });

          // Send analysis complete event
          await sendEvent({
            type: 'analysis-complete',
            stage: 'analyzing-prompts',
            data: {
              provider: provider.name,
              prompt: prompt.prompt,
              promptIndex: promptIndex + 1,
              totalPrompts: analysisPrompts.length,
              providerIndex: 0,
              totalProviders: workingProviders.length,
              status: 'completed'
            } as AnalysisProgressData,
            timestamp: new Date()
          });

        } catch (error) {
          logger.error(`Error with ${provider.name} for prompt "${prompt.prompt}":`, error);
          
          // Check if it's an authentication error
          const isAuthError = error instanceof Error && (
            error.message.includes('401') || 
            error.message.includes('invalid') || 
            error.message.includes('Authorization Required') ||
            error.message.includes('authentication_error')
          );
          
          if (isAuthError) {
            logger.warn(`Skipping ${provider.name} - authentication error (API key issue)`);
            errors.push(`${provider.name}: API key not configured or invalid`);
          } else {
            errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          
          // Send analysis failed event
          await sendEvent({
            type: 'analysis-complete',
            stage: 'analyzing-prompts',
            data: {
              provider: provider.name,
              prompt: prompt.prompt,
              promptIndex: promptIndex + 1,
              totalPrompts: analysisPrompts.length,
              providerIndex: 0,
              totalProviders: workingProviders.length,
              status: 'failed'
            } as AnalysisProgressData,
            timestamp: new Date()
          });
        }

        completedAnalyses++;
        const progress = Math.round((completedAnalyses / totalAnalyses) * 100);
        
        await sendEvent({
          type: 'progress',
          stage: 'analyzing-prompts',
          data: {
            stage: 'analyzing-prompts',
            progress,
            message: `Completed ${completedAnalyses} of ${totalAnalyses} analyses`
          } as ProgressData,
          timestamp: new Date()
        });
      })
    );
    
    // Wait for all promises in this batch to complete
    await Promise.all(batchPromises);
  }

  // Load brand variations from database (pre-generated before analysis)
  await sendEvent({
    type: 'stage',
    stage: 'generating-brand-variations',
    data: {
      stage: 'generating-brand-variations',
      progress: 0,
      message: 'Loading brand variations from database...'
    } as ProgressData,
    timestamp: new Date()
  });

  try {
    // Import the new aliases service
    const { getBulkAliases } = await import('@/lib/db/aliases-service');
    
    // Get company IDs for target and competitors
    // For competitors, we need to resolve them to get their company IDs
    const companyIds = [company.id];
    const competitorNameToId: Record<string, string> = {};
    
    // Resolve competitors to get their company IDs
    for (const competitorName of competitors) {
      try {
        // Try to find the competitor by name in the database
        const { db } = await import('@/lib/db');
        const { companies } = await import('@/lib/db/schema/companies');
        const { eq } = await import('drizzle-orm');
        
        const [competitorCompany] = await db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.name, competitorName))
          .limit(1);
        
        if (competitorCompany) {
          companyIds.push(competitorCompany.id);
          competitorNameToId[competitorName] = competitorCompany.id;
          logger.debug(`[Brand Variations] Resolved competitor "${competitorName}" to ID: ${competitorCompany.id}`);
        } else {
          logger.warn(`[Brand Variations] Could not resolve competitor "${competitorName}" to company ID`);
        }
      } catch (error) {
        logger.warn(`[Brand Variations] Error resolving competitor "${competitorName}":`, error);
      }
    }
    
    const aliasesFromDb = await getBulkAliases(companyIds);

    // Convert to BrandVariation format for compatibility
    const variationRecord: Record<string, BrandVariation> = {};
    
    // Add target company variations
    if (aliasesFromDb[company.id]) {
      variationRecord[company.name] = {
        original: company.name,
        variations: aliasesFromDb[company.id],
        confidence: 1.0
      };
    }

    // Add competitor variations with their aliases from database
    competitors.forEach(competitorName => {
      const competitorId = competitorNameToId[competitorName];
      
      if (competitorId && aliasesFromDb[competitorId]) {
        // Use aliases from database
        variationRecord[competitorName] = {
          original: competitorName,
          variations: aliasesFromDb[competitorId],
          confidence: 1.0
        };
        logger.debug(`[Brand Variations] Loaded ${aliasesFromDb[competitorId].length} aliases for competitor "${competitorName}"`);
      } else {
        // Fallback to basic variations if no aliases found
        variationRecord[competitorName] = {
          original: competitorName,
          variations: [competitorName, competitorName.toLowerCase()],
          confidence: 0.8
        };
        logger.debug(`[Brand Variations] Using basic variations for competitor "${competitorName}"`);
      }
    });

    // Add normalized keys for robust matching
    const normalizeKey = (value: string) =>
      (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

    Object.keys(variationRecord).forEach(brandName => {
      variationRecord[normalizeKey(brandName)] = variationRecord[brandName];
    });

    brandVariations = variationRecord;

    logger.info(`[Brand Variations] Loaded variations for ${Object.keys(aliasesFromDb).length} companies from database`);
    logger.debug(`[Brand Variations] Competitor name to ID mapping:`, competitorNameToId);
  } catch (error) {
    logger.error('[Brand Variations] Failed to load brand variations from database:', error);
    // Fallback: create basic variations
    const allBrands = [company.name, ...competitors];
    brandVariations = {};
    allBrands.forEach(brandName => {
      brandVariations![brandName] = {
        original: brandName,
        variations: [brandName, brandName.toLowerCase()],
        confidence: 0.5
      };
    });
  }

  // Stage 4: Extract brands from responses (70-90% of total progress)
  await sendEvent({
    type: 'stage',
    stage: 'extracting-brands',
    data: {
      stage: 'extracting-brands',
      progress: 70,
      message: 'Extracting brand mentions from AI responses...'
    } as ProgressData,
    timestamp: new Date()
  });

  // Analyze competitors by provider with progress tracking
  const { providerRankings, providerComparison } = await analyzeCompetitorsByProvider(
    company, 
    responses, 
    competitors,
    brandVariations,
    sendEvent
  );

  await sendEvent({
    type: 'progress',
    stage: 'extracting-brands',
    data: {
      stage: 'extracting-brands',
      progress: 90,
      message: 'Brand extraction complete'
    } as ProgressData,
    timestamp: new Date()
  });

  // Stage 5: Calculate scores (90-100% of total progress)
  await sendEvent({
    type: 'stage',
    stage: 'calculating-scores',
    data: {
      stage: 'calculating-scores',
      progress: 90,
      message: 'Calculating brand visibility scores...'
    } as ProgressData,
    timestamp: new Date()
  });

  // Calculer le classement global directement depuis providerComparison
  let competitorRankings = providerComparison.map(row => {
    const providersData = row.providers || {};
    const values = Object.values(providersData);
    const visibilityScores = values.map(v => v?.visibilityScore || 0);
    const totalMentions = values.reduce((sum, v) => sum + (v?.mentions || 0), 0);
    const averageVisibility = visibilityScores.length
      ? visibilityScores.reduce((a, b) => a + b, 0) / visibilityScores.length
      : 0;

    // Position moyenne (ignorer 0/undefined)
    const positions = values
      .map(v => v?.position)
      .filter((p): p is number => typeof p === 'number' && !isNaN(p));
    const averagePosition = positions.length
      ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
      : 0;

    // Sentiment majoritaire
    const sentiments = values.map(v => v?.sentiment).filter(Boolean) as ('positive' | 'neutral' | 'negative')[];
    const sentimentCounts = sentiments.reduce((acc, s) => {
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<'positive' | 'neutral' | 'negative', number>);
    const sentiment = (['positive','neutral','negative'] as const)
      .reduce((best, cur) => (sentimentCounts[cur] > (sentimentCounts[best] || 0) ? cur : best), 'neutral');

    // Sentiment score simple aligné sur la fonction existante
    const sentimentScores: number[] = sentiments.map(s => (s === 'positive' ? 100 : s === 'neutral' ? 50 : 0));
    const sentimentScore = sentiments.length
      ? Math.round(sentimentScores.reduce((a,b)=>a+b,0) / sentiments.length)
      : 50;

    return {
      name: row.competitor,
      mentions: totalMentions,
      visibilityScore: Math.round(averageVisibility * 10) / 10,
      averagePosition,
      sentiment,
      sentimentScore,
      shareOfVoice: 0,
      weeklyChange: undefined,
      isOwn: row.isOwn,
    };
  });

  // Recalculer la share of voice à partir des mentions agrégées
  const totalMentionsGlobal = competitorRankings.reduce((sum, c) => sum + c.mentions, 0);
  competitorRankings = competitorRankings.map(c => ({
    ...c,
    shareOfVoice: totalMentionsGlobal > 0 ? Math.round((c.mentions / totalMentionsGlobal) * 1000) / 10 : 0,
  }));

  // Trier par visibilité
  competitorRankings.sort((a, b) => b.visibilityScore - a.visibilityScore);

  // Send scoring progress for each competitor
  for (let i = 0; i < competitorRankings.length; i++) {
    await sendEvent({
      type: 'scoring-start',
      stage: 'calculating-scores',
      data: {
        competitor: competitorRankings[i].name,
        score: competitorRankings[i].visibilityScore,
        index: i + 1,
        total: competitorRankings.length
      } as ScoringProgressData,
      timestamp: new Date()
    });
  }

  // Calculate final scores
  const scores = calculateBrandScores(responses, company.name, competitorRankings);

  await sendEvent({
    type: 'progress',
    stage: 'calculating-scores',
    data: {
      stage: 'calculating-scores',
      progress: 100,
      message: 'Scoring complete'
    } as ProgressData,
    timestamp: new Date()
  });

  // Stage 6: Finalize
  await sendEvent({
    type: 'stage',
    stage: 'finalizing',
    data: {
      stage: 'finalizing',
      progress: 100,
      message: 'Analysis complete!'
    } as ProgressData,
    timestamp: new Date()
  });

  logger.info(`[AnalyzeCommon] 🎯 Final analysis result:`, {
    totalResponses: responses.length,
    totalPrompts: analysisPrompts.length,
    responsesPerPrompt: responses.length / Math.max(analysisPrompts.length, 1),
    webSearchUsed: useWebSearch,
    errors: errors.length
  });
  
  if (responses.length > 0) {
    logger.debug(`[AnalyzeCommon] ✅ Responses summary:`, 
      responses.map(r => ({
        provider: r.provider,
        promptPreview: r.prompt.substring(0, 30) + '...',
      }))
    );
  } else {
    logger.error(`[AnalyzeCommon] ❌ No responses collected!`);
  }

  const analysisResult: AnalysisResult = {
    company,
    knownCompetitors: competitors,
    prompts: analysisPrompts,
    responses,
    analyses,
    scores,
    competitors: competitorRankings,
    providerRankings,
    providerComparison,
    sources: [],
    errors: errors.length > 0 ? errors : undefined,
    webSearchUsed: useWebSearch,
    apiUsageSummary: apiUsageTracker.getSummary(),
    brandVariations,
  };

  analysisResult.sources = extractAnalysisSources(analysisResult);

  return analysisResult;
}

/**
 * Get available providers based on configured API keys
 */
export function getAvailableProviders() {
  const configuredProviders = getConfiguredProviders();
  // Map to the format expected by the rest of the code
  return configuredProviders.map(provider => ({
    name: provider.name,
    model: provider.defaultModel,
    icon: provider.icon,
  }));
}

/**
 * Create SSE message with proper format
 */
export function createSSEMessage(event: SSEEvent): string {
  // Ensure proper SSE format with event type
  const lines: string[] = [];
  if (event.type) {
    lines.push(`event: ${event.type}`);
  }
  lines.push(`data: ${JSON.stringify(event)}`);
  lines.push(''); // Empty line to signal end of event
  lines.push(''); // Extra newline for proper SSE format
  return lines.join('\n');
}