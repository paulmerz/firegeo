import { AIResponse, AnalysisProgressData, Company, PartialResultData, ProgressData, PromptGeneratedData, ScoringProgressData, SSEEvent, AnalysisSource, BrandPrompt, CompetitorRanking, ProviderSpecificRanking, ProviderComparisonData, ApiUsageSummaryData } from './types';
import { generatePromptsForCompany, analyzePromptWithProvider, calculateBrandScores, analyzeCompetitors, identifyCompetitors, analyzeCompetitorsByProvider } from './ai-utils';
import { analyzePromptWithProvider as analyzePromptWithProviderEnhanced } from './ai-utils-enhanced';
import { extractAnalysisSources } from './brand-monitor-sources';
import { getConfiguredProviders } from './provider-config';
import { apiUsageTracker } from './api-usage-tracker';
import { logger } from './logger';
import { ensureBrandVariationsForBrand } from './brand-detection-service';
import type { BrandVariation } from './types';

export interface AnalysisConfig {
  company: Company;
  customPrompts?: string[];
  userSelectedCompetitors?: { name: string }[];
  useWebSearch?: boolean;
  sendEvent: (event: SSEEvent) => Promise<void>;
  locale?: string;
}

export interface AnalysisResult {
  company: Company;
  knownCompetitors: string[];
  prompts: BrandPrompt[];
  responses: AIResponse[];
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
<<<<<<< Updated upstream
  apiUsageSummary?: ApiUsageSummaryData;
=======
  apiUsageSummary?: any;
  brandVariations?: Record<string, BrandVariation>;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
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
  locale
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

  // Use custom prompts if provided, otherwise generate them
  let analysisPrompts;
  if (customPrompts && customPrompts.length > 0) {
    // Convert string prompts to BrandPrompt objects
    analysisPrompts = customPrompts.map((prompt: string, index: number) => ({
      id: `custom-${index}`,
      prompt,
      category: 'custom' as const
    }));
  } else {
    const prompts = await generatePromptsForCompany(company, competitors);
    // Note: Changed from 8 to 4 to match UI - this should be configurable
    analysisPrompts = prompts.slice(0, 4);
  }

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
      message: `Starting AI analysis${useWebSearch ? ' with web search' : ''}...`
    } as ProgressData,
    timestamp: new Date()
  });

  const responses: AIResponse[] = [];
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

  // Check if we should use mock mode (no API keys configured)
  const useMockMode = process.env.USE_MOCK_MODE === 'true' || availableProviders.length === 0;

  // If no providers are available and we're not in mock mode, add mock providers
  let workingProviders = availableProviders;
  if (availableProviders.length === 0) {
    logger.warn('No providers configured, using mock providers for demonstration');
    workingProviders = [
      { name: 'OpenAI', model: 'gpt-4', icon: '🤖' },
      { name: 'Anthropic', model: 'claude-3', icon: '🔮' },
      { name: 'Google', model: 'gemini-pro', icon: '🌟' }
    ];
  }

  // If still no providers available, return early with error
  if (workingProviders.length === 0) {
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
          logger.debug(`Use mock mode: ${useMockMode}`);
          logger.debug(`Use web search: ${useWebSearch}`);
          logger.debug(`Brand: ${company.name}`);
          logger.debug(`Competitors: ${competitors.slice(0, 3).join(', ')}${competitors.length > 3 ? '...' : ''}`);
          
          // Call the appropriate analysis function based on useWebSearch
          const response = useWebSearch 
            ? await analyzePromptWithProviderEnhanced(
                prompt.prompt, 
                provider.name, 
                company.name, 
                competitors,
                useMockMode,
                true, // useWebSearch parameter for enhanced version
                locale,
                brandVariations // Pass pre-generated brand variations
              )
            : await analyzePromptWithProvider(
                prompt.prompt, 
                provider.name, 
                company.name, 
                competitors,
                useMockMode,
                locale,
                brandVariations // Pass pre-generated brand variations
              );
          
          logger.debug(`\n=== ANALYSIS COMPLETED ===`);
          logger.debug(`Provider: ${provider.name}`);
          logger.debug(`Has response: ${!!response}`);
          if (response) {
            logger.debug(`Response provider: ${response.provider}`);
            logger.debug(`Brand mentioned: ${response.brandMentioned}`);
            logger.debug(`Response length: ${response.response?.length || 0}`);
            logger.debug(`Response preview: "${response.response?.substring(0, 100) || 'NO RESPONSE'}"`); 
            logger.debug(`Competitors found: ${response.competitors?.length || 0}`);
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
          
          // If using mock mode, add a small delay for visual effect
          if (useMockMode) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
          }
          
          responses.push(response);
          logger.debug(`[AnalyzeCommon] ✅ Response added to collection. Total responses: ${responses.length}`);
          logger.debug(`[AnalyzeCommon] Response details:`, {
            provider: response.provider,
            promptPreview: response.prompt.substring(0, 50) + '...',
            responseLength: response.response.length,
            brandMentioned: response.brandMentioned
          });

          // Send partial result
          await sendEvent({
            type: 'partial-result',
            stage: 'analyzing-prompts',
            data: {
              provider: provider.name,
              prompt: prompt.prompt,
              response: {
                provider: response.provider,
                brandMentioned: response.brandMentioned,
                brandPosition: response.brandPosition,
                sentiment: response.sentiment
              }
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

  // Generate brand variations once for all brands (target + competitors)
  await sendEvent({
    type: 'stage',
    stage: 'generating-brand-variations',
    data: {
      stage: 'generating-brand-variations',
      progress: 0,
      message: 'Generating intelligent brand variations...'
    } as ProgressData,
    timestamp: new Date()
  });

  const allBrands = [company.name, ...competitors];

  try {
    const variationPromises = allBrands.map(async (brandName) => {
      try {
        const variations = await ensureBrandVariationsForBrand(brandName, locale);
        return { brandName, variations };
      } catch (error) {
        logger.warn(`Failed to generate variations for brand "${brandName}":`, error);
        return {
          brandName,
          variations: {
            original: brandName,
            variations: [brandName, brandName.toLowerCase()],
            confidence: 0.5
          }
        };
      }
    });

    const variationResults = await Promise.all(variationPromises);
    const variationRecord: Record<string, BrandVariation> = {};

    variationResults.forEach(({ brandName, variations }) => {
      variationRecord[brandName] = variations;
    });

    brandVariations = variationRecord;

    logger.info(`[Brand Variations] Generated variations for ${variationResults.length} brands`);
  } catch (error) {
    logger.error('[Brand Variations] Failed to generate brand variations:', error);
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

  // Analyze competitors from all responses
  let competitorRankings = await analyzeCompetitors(company, responses, competitors);

  // Harmonize with provider-level detections: if a brand has 0 mentions across all providers,
  // force its visibility score to 0% to avoid discrepancies (e.g., 0 mentions showing ~6%).
  try {
    const zeroMentionBrands = new Set<string>();
    providerComparison.forEach((row) => {
      const providersData = row?.providers || {};
      const totalMentions = Object.values(providersData).reduce((sum, p) => sum + (p?.mentions || 0), 0);
      if (totalMentions === 0) {
        zeroMentionBrands.add(row.competitor);
      }
    });

    if (zeroMentionBrands.size > 0) {
      competitorRankings = competitorRankings.map(r =>
        zeroMentionBrands.has(r.name)
          ? { ...r, mentions: 0, visibilityScore: 0 }
          : r
      );
    }
  } catch (e) {
    logger.warn('[AnalyzeCommon] Failed to harmonize zero-mention brands:', (e as Error)?.message);
  }

  // Recompute global visibility as average of provider scores for consistency
  try {
    competitorRankings = competitorRankings.map(r => {
      // Find this brand in providerComparison
      const providerRow = providerComparison.find(row => row.competitor === r.name);
      if (!providerRow || !providerRow.providers) return r;

      // Calculate average visibility score across all providers
      const providerScores = Object.values(providerRow.providers)
        .map((p) => p?.visibilityScore || 0)
        .filter(score => typeof score === 'number' && !isNaN(score));
      
      if (providerScores.length === 0) return r;

      const averageVisibility = providerScores.reduce((sum, score) => sum + score, 0) / providerScores.length;
      
      // Calculate total mentions across all providers for share of voice
      const totalMentions = Object.values(providerRow.providers)
        .reduce((sum, p) => sum + (p?.mentions || 0), 0);

      return {
        ...r,
        mentions: totalMentions,
        visibilityScore: Math.round(averageVisibility * 10) / 10,
      };
    });

    // Recompute share of voice with the adjusted mentions
    const totalMentionsAdjusted = competitorRankings.reduce((sum, c) => sum + c.mentions, 0);
    competitorRankings = competitorRankings.map(c => ({
      ...c,
      shareOfVoice: totalMentionsAdjusted > 0 ? Math.round((c.mentions / totalMentionsAdjusted) * 1000) / 10 : 0,
    }));

    // Sort after adjustments
    competitorRankings.sort((a, b) => b.visibilityScore - a.visibilityScore);
  } catch (e) {
    logger.warn('[AnalyzeCommon] Failed to recompute global visibility from providerComparison:', (e as Error)?.message);
  }

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
        brandMentioned: r.brandMentioned
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