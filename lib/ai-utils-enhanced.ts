import { generateText, generateObject, LanguageModelV1 } from 'ai';
import { z } from 'zod';
<<<<<<< Updated upstream
import { AIResponse } from './types';
import { getProviderModel, normalizeProviderName, getProviderConfig } from './provider-config';
import { analyzePromptWithOpenAIWebSearch, isOpenAIWebSearchAvailable } from './openai-web-search';
import { getLanguageName } from './locale-utils';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';
import { detectMultipleBrands, BrandDetectionMatch } from './brand-detection-service';

interface WebSearchSource {
  url: string;
  title?: string;
  text?: string;
  source?: string;
  domain?: string;
  type?: string;
}
=======
import { AIResponse, type BrandVariation } from './types';
import { getProviderModel, normalizeProviderName, getProviderConfig, PROVIDER_CONFIGS } from './provider-config';
import { isOpenAIWebSearchAvailable, analyzePromptWithOpenAIWebSearch } from './openai-web-search';
import { getLanguageName } from './locale-utils';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';
import { detectMultipleBrands, type BrandDetectionMatch, ensureBrandVariationsForBrand } from './brand-detection-service';
import { cleanProviderResponse } from './provider-response-utils';
>>>>>>> Stashed changes

/**
 * Extract brand name from complex brand strings
 * Focus on the actual brand, not the product
 */
function extractBrandName(brandString: string): string {
  let brand = brandString.trim();
  
  // Handle parentheses format like "Citroën (Ami)" -> "Citroën"
  const parenthesesMatch = brand.match(/^([^(]+)\s*\(/);
  if (parenthesesMatch) {
    brand = parenthesesMatch[1].trim();
  }
  
  // Handle comma format like "Renault, Twizy" -> "Renault"
  const commaMatch = brand.match(/^([^,]+),/);
  if (commaMatch) {
    brand = commaMatch[1].trim();
  }
  
  return brand;
}

/**
 * Create simple variations for basic brand names (case, accents)
 * For complex multi-word brands, use AI-powered detection
 */
function createSimpleBrandVariations(brandString: string): string[] {
  const coreBrand = extractBrandName(brandString);
  const variations = new Set<string>();
  
  // Add original
  variations.add(coreBrand);
  
  // Add lowercase
  const lower = coreBrand.toLowerCase();
  variations.add(lower);
  
  // Add without accents
  const normalized = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized !== lower) {
    variations.add(normalized);
  }
  
  // Add uppercase version of normalized
  if (normalized !== lower) {
    variations.add(normalized.charAt(0).toUpperCase() + normalized.slice(1));
  }
  
  const list = Array.from(variations).filter(v => v.length > 1);
  return filterBrandVariations(coreBrand, list);
}

async function resolveBrandVariations(
  brandName: string,
  locale?: string,
  precomputed?: Record<string, BrandVariation>
): Promise<BrandVariation> {
  if (precomputed && precomputed[brandName]) {
    return precomputed[brandName];
  }

  return ensureBrandVariationsForBrand(brandName, locale);
}

function textIncludesAnyVariation(textLower: string, variations: string[]): boolean {
  return variations.some(variation => textLower.includes(variation.toLowerCase()));
}

const RankingSchema = z.object({
  rankings: z.array(z.object({
    position: z.number().nullable(),
    company: z.string(),
    reason: z.string().optional(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  })),
  analysis: z.object({
    brandMentioned: z.boolean(),
    brandPosition: z.number().nullable().optional(),
    competitors: z.array(z.string()),
    overallSentiment: z.enum(['positive', 'neutral', 'negative']),
    confidence: z.number().min(0).max(1),
  }),
});

// Enhanced version with web search grounding
export async function analyzePromptWithProviderEnhanced(
  prompt: string,
  provider: string,
  brandName: string,
  competitors: string[],
  useMockMode: boolean = false,
  useWebSearch: boolean = true, // New parameter
<<<<<<< Updated upstream
  locale?: string // Locale parameter
): Promise<AIResponse | null> {
=======
  locale?: string, // Locale parameter
  brandVariations?: Record<string, BrandVariation> // Pre-generated brand variations
): Promise<AIResponse> {
>>>>>>> Stashed changes
  const trimmedPrompt = prompt.trim();
  // Mock mode for demo/testing without API keys
  if (useMockMode || provider === 'Mock') {
    return generateMockResponse(trimmedPrompt, provider, brandName, competitors);
  }

  // Normalize provider name for consistency
  const normalizedProvider = normalizeProviderName(provider);
  const providerConfig = getProviderConfig(normalizedProvider);
  
  if (!providerConfig || !providerConfig.isConfigured()) {
    console.warn(`Provider ${provider} not configured, skipping provider`);
    return null;
  }
  
  let model: LanguageModelV1 | string | null = null;
  const generateConfig: Record<string, unknown> = {};
  
  // Handle provider-specific web search configurations
  if (normalizedProvider === 'openai' && useWebSearch) {
    // Use the new OpenAI web search implementation
    if (!isOpenAIWebSearchAvailable()) {
      console.warn('OpenAI web search not available, falling back to standard OpenAI');
      model = getProviderModel('openai');
    } else {
      // We'll handle OpenAI web search separately, so just mark it
      model = 'openai-web-search';
    }
  } else {
    // Get model with web search options if supported
    model = getProviderModel(normalizedProvider, undefined, { useWebSearch });
  }
  
  if (!model) {
    console.warn(`Failed to get model for ${provider}`);
    return null;
  }

  const languageName = locale ? getLanguageName(locale) : 'English';
  
  // IMPORTANT: envoyer le prompt brut sans injection d'instructions supplémentaires
  const rawPrompt = trimmedPrompt;

  try {
    let text: string;
    let sources: WebSearchSource[] = [];

    // Handle OpenAI web search separately using the new implementation
    if (normalizedProvider === 'openai' && useWebSearch && model === 'openai-web-search') {
      console.log(`[${provider}] Using OpenAI web search implementation`);
      
      // Use the dedicated OpenAI web search function
      const openaiResult = await analyzePromptWithOpenAIWebSearch(
        trimmedPrompt,
        brandName,
        competitors,
        locale,
        undefined, // model (use default gpt-4o-mini)
        brandVariations as any // Pass precomputed variations to avoid regeneration
      );
      
      // Guard against null result to satisfy strict null checks
      if (!openaiResult) {
        console.warn('OpenAI web search returned null; skipping provider result.');
        return null;
      }
      
      // Enhanced brand detection fallback for web search results
      // Apply the same robust detection logic as the non-web search version
<<<<<<< Updated upstream
      const text = openaiResult.response;
      const textLower = text.toLowerCase();
=======
      const rawResponseText = openaiResult.response;
      const cleanedResponseText = cleanProviderResponse(rawResponseText, { providerName: provider });
      const textLower = cleanedResponseText.toLowerCase();
      const brandNameLower = brandName.toLowerCase();
>>>>>>> Stashed changes
      
      // Enhanced brand detection with pre-generated variations or fallback to generation
      const brandVariationData = await resolveBrandVariations(brandName, locale, brandVariations);
      const enhancedBrandMentioned = openaiResult.brandMentioned ||
        textIncludesAnyVariation(textLower, brandVariationData.variations);
        
      // Add any missed competitors from text search with smart variations
      const aiCompetitors = new Set(openaiResult.competitors);
      const allMentionedCompetitors = new Set([...aiCompetitors]);
      
      for (const competitor of competitors) {
        const competitorVariationData = await resolveBrandVariations(competitor, locale, brandVariations);
        const found = textIncludesAnyVariation(textLower, competitorVariationData.variations);
        
        if (found) {
          allMentionedCompetitors.add(competitor);
        }
      }

      // Filter competitors to only include the ones we're tracking
      const relevantCompetitors = Array.from(allMentionedCompetitors).filter(c => 
        competitors.includes(c) && c !== brandName
      );
      
      // Return enhanced result with improved brand detection
      return {
        ...openaiResult,
        brandMentioned: enhancedBrandMentioned,
        competitors: relevantCompetitors,
      };
    } else {
<<<<<<< Updated upstream
      if (typeof model === 'string') {
        // This path should not be reachable due to the logic above.
        // It's here to satisfy TypeScript's type checker.
        throw new Error(`Unexpected string model for provider ${normalizedProvider}`);
      }
      // Log web search configuration for debugging
      if (useWebSearch) {
        console.log(`[${provider}] Web search enabled with config:`, {
          model: typeof model === 'string' ? model : 'LanguageModelV1',
          include: generateConfig.include,
          tools: generateConfig.tools,
          prompt: enhancedPrompt.substring(0, 100) + '...'
        });
      }
=======
      // Log basique (sans afficher d'instructions enrichies)
      console.log(`[${provider}] Analyzing with raw prompt${useWebSearch ? ' (web search requested but not supported by SDK ai for this provider)' : ''}`);
>>>>>>> Stashed changes
      
      // Get the model ID from provider config instead of trying to extract from model object
      const providerConfig = PROVIDER_CONFIGS[normalizedProvider];
      const modelId = providerConfig?.defaultModel || 'unknown';
      
      // Track API call for analysis (avec prompt brut)
      const callId = apiUsageTracker.trackCall({
        provider: normalizedProvider,
<<<<<<< Updated upstream
        model: (model as { id?: string }).id || 'unknown',
=======
        model: modelId,
>>>>>>> Stashed changes
        operation: 'analysis',
        success: true,
        metadata: { 
          prompt: rawPrompt.substring(0, 100) + '...',
          brandName,
          competitorsCount: competitors.length,
          locale,
          useWebSearch
        }
      });

      const startTime = Date.now();
      // First, get the response en envoyant le prompt BRUT (sans system ni instructions)
      const result = await generateText({
        model,
        prompt: rawPrompt,
        maxTokens: 800,
        ...generateConfig,
      });
      const duration = Date.now() - startTime;

      // Extract tokens from usage
      const tokens = extractTokensFromUsage(result.usage);
      
      // Update API call with actual usage
      apiUsageTracker.updateCall(callId, {
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
<<<<<<< Updated upstream
        cost: estimateCost(normalizedProvider, (model as { id?: string }).id || 'unknown', tokens.inputTokens, tokens.outputTokens),
=======
        cost: estimateCost(normalizedProvider, modelId, tokens.inputTokens, tokens.outputTokens),
>>>>>>> Stashed changes
        duration
      });
      
      text = result.text;
      sources = result.sources || [];
    }

    // Then analyze it with structured output
    const analysisPrompt = `Analyze this AI response about ${brandName} and its competitors:

Response: "${text}"

Your task:
1. Look for ANY mention of ${brandName} anywhere in the response (even if not ranked)
2. Look for ANY mention of these competitors: ${competitors.join(', ')}
3. For each mentioned company, determine if it has a specific ranking position
4. Identify the sentiment towards each mentioned company
5. Rate your confidence in this analysis (0-1)

IMPORTANT: A company is "mentioned" if it appears anywhere in the response text, even without a specific ranking. Count ALL mentions, not just ranked ones. Return the analysis in ${languageName} language.

Be very thorough in detecting company names - they might appear in different contexts (listed, compared, recommended, etc.)`;

    let object;
    try {
      // Use a fast model for structured output
      const analysisModel = getProviderModel('openai', 'gpt-4o-mini');
      if (!analysisModel) {
        throw new Error('Analysis model not available');
      }
      
      // Track API call for structured analysis
      const analysisCallId = apiUsageTracker.trackCall({
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'structured_analysis',
        success: true,
        metadata: { 
          step: 'structured_analysis',
          brandName,
          competitorsCount: competitors.length,
          locale,
          // Lier le coût structuré au prompt source (aperçu)
          prompt: (analysisPrompt || '').substring(0, 120) + '...'
        }
      });

      const analysisStartTime = Date.now();
      console.log('SELECTED MODEL (analyzePromptWithProviderEnhanced.generateObject structured):', typeof analysisModel === 'string' ? analysisModel : analysisModel);
      const result = await generateObject({
        model: analysisModel,
        system: 'You are an expert at analyzing text and extracting structured information about companies and rankings.',
        prompt: analysisPrompt,
        schema: RankingSchema,
      });
      const analysisDuration = Date.now() - analysisStartTime;

      // Extract tokens from usage
      const analysisTokens = extractTokensFromUsage(result.usage);
      
      // Update API call with actual usage
      apiUsageTracker.updateCall(analysisCallId, {
        inputTokens: analysisTokens.inputTokens,
        outputTokens: analysisTokens.outputTokens,
        cost: estimateCost('openai', 'gpt-4o-mini', analysisTokens.inputTokens, analysisTokens.outputTokens),
        duration: analysisDuration
      });

      object = result.object;
    } catch (error) {
      console.error('Structured analysis failed:', error);
      // Fallback to basic analysis
      const cleanedResponseText = cleanProviderResponse(text, { providerName: provider });
      const textLower = cleanedResponseText.toLowerCase();
      const brandNameLower = brandName.toLowerCase();
      
      // More robust brand detection
      const mentioned = textLower.includes(brandNameLower) ||
        textLower.includes(brandNameLower.replace(/\s+/g, '')) ||
        textLower.includes(brandNameLower.replace(/[^a-z0-9]/g, ''));
        
      // More robust competitor detection
      const detectedCompetitors = competitors.filter(c => {
        const cLower = c.toLowerCase();
        return textLower.includes(cLower) ||
          textLower.includes(cLower.replace(/\s+/g, '')) ||
          textLower.includes(cLower.replace(/[^a-z0-9]/g, ''));
      });
      
      object = {
        rankings: [],
        analysis: {
          brandMentioned: mentioned,
          brandPosition: undefined,
          competitors: detectedCompetitors,
          overallSentiment: 'neutral' as const,
          confidence: 0.5,
        },
      };
    }

    // Fallback: simple text-based mention detection 
    // This complements the AI analysis in case it misses obvious mentions
<<<<<<< Updated upstream
    
    // Use centralized brand detection service for accurate detection
    let detectionResult;
    try {
      detectionResult = await detectBrandsInResponse(text, brandName, competitors);
=======
    type EnhancedDetectionResult = {
      brandMentioned: boolean;
      competitors: string[];
      sentiment: 'neutral';
      confidence: number;
      detectionDetails: {
        brandMatches: BrandDetectionMatch[];
        competitorMatches: Map<string, BrandDetectionMatch[]>;
      };
    };

    let detectionResult: EnhancedDetectionResult;
    try {
      const detectionText = cleanProviderResponse(text, { providerName: provider });

      const brandDetection = await detectMultipleBrands(detectionText, [brandName], {
        caseSensitive: false,
        excludeNegativeContext: false,
        minConfidence: 0.3
      });

      const competitorDetections = await detectMultipleBrands(detectionText, competitors, {
        caseSensitive: false,
        excludeNegativeContext: false,
        minConfidence: 0.3
      }, locale);

      const brandMentioned = brandDetection.get(brandName)?.mentioned || false;
      const competitorsDetected = Array.from(competitorDetections.keys());

      const brandMatches = brandDetection.get(brandName)?.matches ?? [];
      const competitorMatches = new Map<string, BrandDetectionMatch[]>(
        Array.from(competitorDetections.entries()).map(([competitor, result]) => [
          competitor,
          result.matches ?? []
        ])
      );

      detectionResult = {
        brandMentioned,
        competitors: competitorsDetected,
        sentiment: 'neutral',
        confidence: brandDetection.get(brandName)?.confidence || 0,
        detectionDetails: {
          brandMatches,
          competitorMatches
        }
      };
>>>>>>> Stashed changes
    } catch (error) {
      console.error('Brand detection failed, using AI analysis only:', error);
      // If brand detection fails, use only AI analysis
      detectionResult = {
        brandMentioned: false,
        competitors: [],
        sentiment: 'neutral',
        confidence: 0,
        detectionDetails: {
          brandMatches: [],
          competitorMatches: new Map()
        }
      };
    }
    
    const brandMentioned = object.analysis.brandMentioned || detectionResult.brandMentioned;
    
    // Combine AI-detected competitors with centralized detection
    const aiCompetitors = new Set(object.analysis.competitors);
    const allMentionedCompetitors = new Set([...aiCompetitors, ...detectionResult.competitors]);

    // Filter competitors to only include the ones we're tracking
    const relevantCompetitors = Array.from(allMentionedCompetitors).filter(c => 
      competitors.includes(c) && c !== brandName
    );

    // Get the proper display name for the provider
    const providerDisplayName = provider === 'openai' ? 'OpenAI' :
                               provider === 'anthropic' ? 'Anthropic' :
                               provider === 'google' ? 'Google' :
                               provider === 'perplexity' ? 'Perplexity' :
                               provider; // fallback to original

    return {
      provider: providerDisplayName,
      prompt: trimmedPrompt, // ensure trimmed
      response: text,
      rankings: object.rankings,
      competitors: relevantCompetitors,
      brandMentioned,
      brandPosition: object.analysis.brandPosition ?? undefined,
      sentiment: object.analysis.overallSentiment,
      confidence: object.analysis.confidence,
      timestamp: new Date(),
      webSearchSources: (sources || [])
        .filter(s => Boolean(s.url))
        .map(s => ({
          title: s.title || s.domain || s.source || 'Source',
          url: s.url,
          snippet: s.text || '',
        })),
      detectionDetails: detectionResult.detectionDetails,
    };
  } catch (error) {
    console.error(`Error with ${provider}:`, error);
    
    // Check if it's an authentication error
    const isAuthError = error instanceof Error && (
      error.message.includes('401') || 
      error.message.includes('invalid_api_key') ||
      error.message.includes('invalid x-api-key') ||
      error.message.includes('Authorization Required') ||
      error.message.includes('Unauthorized') ||
      error.message.includes('authentication_error') ||
      error.message.includes('Incorrect API key')
    );
    
    if (isAuthError) {
      console.log(`Authentication error with ${provider} - returning null to skip this provider`);
      return null; // Return null to indicate this provider should be skipped
    }
    
    // For other errors, log detailed information
    console.error(`Non-auth error with ${provider}:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: typeof error,
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw error;
  }
}

// Helper function to generate mock responses
function generateMockResponse(
  prompt: string,
  provider: string,
  brandName: string,
  competitors: string[]
): AIResponse {
  const mentioned = Math.random() > 0.3;
  const position = mentioned ? Math.floor(Math.random() * 5) + 1 : undefined;
  
  // Get the proper display name for the provider
  const providerDisplayName = provider === 'openai' ? 'OpenAI' :
                             provider === 'anthropic' ? 'Anthropic' :
                             provider === 'google' ? 'Google' :
                             provider === 'perplexity' ? 'Perplexity' :
                             provider; // fallback to original
  
  return {
    provider: providerDisplayName,
    prompt,
    response: `Mock response for ${prompt}`,
    rankings: competitors.slice(0, 5).map((comp, idx) => ({
      position: idx + 1,
      company: comp,
      reason: 'Mock reason',
      sentiment: 'neutral' as const,
    })),
    competitors: competitors.slice(0, 3),
    brandMentioned: mentioned,
    brandPosition: position,
    sentiment: mentioned ? 'positive' : 'neutral',
    confidence: 0.8,
    timestamp: new Date(),
  };
}

/**
 * Enhanced brand detection using the centralized service
 * This replaces the old brand detection logic with intelligent AI-based detection
 */
export async function detectBrandsInResponse(
  text: string,
  brandName: string,
<<<<<<< Updated upstream
  competitors: string[]
=======
  competitors: string[],
  options: {
    locale?: string;
    providerName?: string;
  } = {}
>>>>>>> Stashed changes
): Promise<{
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  detectionDetails?: {
    brandMatches?: BrandDetectionMatch[];
    competitorMatches?: Map<string, BrandDetectionMatch[]>;
  };
}> {
  try {
    const { providerName } = options;
    const cleanedText = cleanProviderResponse(text, { providerName });

    // Detect all brands using the centralized service
    const allBrands = [brandName, ...competitors];
    const detectionResults = await detectMultipleBrands(cleanedText, allBrands, {
      caseSensitive: false,
      excludeNegativeContext: false,
      minConfidence: 0.3
    });

    // Check if target brand is mentioned
    const brandResult = detectionResults.get(brandName);
    const brandMentioned = brandResult?.mentioned || false;
    const brandConfidence = brandResult?.confidence || 0;

    // Find mentioned competitors
    const mentionedCompetitors: string[] = [];
    const competitorMatches = new Map<string, BrandDetectionMatch[]>();
    
    competitors.forEach(competitor => {
      const result = detectionResults.get(competitor);
      if (result?.mentioned) {
        mentionedCompetitors.push(competitor);
        competitorMatches.set(competitor, result.matches);
      }
    });

    // Simple sentiment analysis (can be enhanced later)
    const sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    
    // Simple position detection (can be enhanced later)
    const brandPosition = brandResult?.matches.length ? 1 : undefined;

    return {
      brandMentioned,
      brandPosition,
      competitors: mentionedCompetitors,
      sentiment,
      confidence: brandConfidence,
      detectionDetails: {
        brandMatches: brandResult?.matches || [],
        competitorMatches
      }
    };
  } catch (error) {
    console.error('Brand detection in response failed:', error);
    // Re-throw the error instead of returning empty result
    throw new Error(`Brand detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export the enhanced function as the default
export { analyzePromptWithProviderEnhanced as analyzePromptWithProvider };

// Filtre générique similaire à openai-web-search.ts pour éviter des faux positifs
function filterBrandVariations(coreBrand: string, variations: string[]): string[] {
  const coreWords = coreBrand.trim().split(/\s+/).filter(Boolean);
  const isMultiWord = coreWords.length >= 2;
  const coreLower = coreBrand.toLowerCase();
  const genericSingles = new Set<string>([
    'the','and','of','for','group','international','global','worldwide','inc','llc','corp','corporation','ltd','limited','sa','sas','gmbh','plc','bv','ag',
    'urban','mobility','ecomobility','systems','solutions','technologies','technology'
  ]);

  const keep = new Set<string>();
  for (const v of (variations || [])) {
    if (!v || typeof v !== 'string') continue;
    const vv = v.trim();
    if (vv.length <= 1) continue;

    const vvLower = vv.toLowerCase();
    if (vvLower === coreLower) { keep.add(vv); continue; }

    const wordCount = vv.split(/\s+/).filter(Boolean).length;
    if (isMultiWord) {
      if (wordCount === 1) {
        const isAcronym = /^[A-Z0-9]{2,5}$/.test(vv);
        if (!isAcronym) continue;
        if (genericSingles.has(vvLower)) continue;
      }
    }

    if (wordCount === 1 && genericSingles.has(vvLower)) continue;

    keep.add(vv);
  }

  if (![...keep].some(x => x.toLowerCase() === coreLower)) {
    keep.add(coreBrand);
  }
  return Array.from(keep);
}
