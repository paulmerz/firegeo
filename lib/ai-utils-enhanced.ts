import { generateText, LanguageModelV1 } from 'ai';
// import { z } from 'zod';
import { AIResponse, type BrandVariation, type MockMode } from './types';
import { getProviderModel, normalizeProviderName, getProviderConfig, PROVIDER_CONFIGS } from './provider-config';
import { isOpenAIWebSearchAvailable, analyzePromptWithOpenAIWebSearch } from './openai-web-search';
// import { getLanguageName } from './locale-utils';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';
import { detectMultipleBrands, type BrandDetectionMatch } from './brand-detection-service';
import { cleanProviderResponse } from './provider-response-utils';
import { getMockedRawResponse } from './ai-utils-mock';

/**
 * Extract brand name from complex brand strings
 * Focus on the actual brand, not the product
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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


// Enhanced version with web search grounding
export async function analyzePromptWithProviderEnhanced(
  prompt: string,
  provider: string,
  brandName: string,
  competitors: string[],
  useWebSearch: boolean = true, // New parameter
  locale?: string, // Locale parameter
  brandVariations?: Record<string, BrandVariation>, // Pre-generated brand variations
  options?: { mockMode?: MockMode }
): Promise<AIResponse> {
  // Use mock mode in test environment
  const mockMode = options?.mockMode || 'none';

  const trimmedPrompt = prompt.trim();

  // Normalize provider name for consistency
  const normalizedProvider = normalizeProviderName(provider);
  const providerConfig = getProviderConfig(normalizedProvider);
  
  if (!providerConfig || !providerConfig.isConfigured()) {
    console.warn(`Provider ${provider} not configured, skipping provider`);
    throw new Error(`Provider ${provider} not configured`);
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
    throw new Error(`Provider ${provider} not configured`);
  }

  // const languageName = locale ? getLanguageName(locale) : 'English';
  
  // IMPORTANT: envoyer le prompt brut sans injection d'instructions supplémentaires
  const rawPrompt = trimmedPrompt;

  try {
  let text: string;

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
        brandVariations as Record<string, BrandVariation> | undefined, // Not used here anymore
        { mockMode } // ensure mocked raw response when requested
      );
      // Return RAW minimal from web search path
      return openaiResult;
    } else {
      // Log basique (sans afficher d'instructions enrichies)
      console.log(`[${provider}] Analyzing with raw prompt${useWebSearch ? ' (web search requested but not supported by SDK ai for this provider)' : ''}`);
      
      // Ensure model is a LanguageModelV1 at this point
      if (typeof model === 'string' || !model) {
        throw new Error(`Invalid model type for ${provider}`);
      }
      
      // Get the model ID from provider config instead of trying to extract from model object
      const providerConfig = PROVIDER_CONFIGS[normalizedProvider];
      const modelId = providerConfig?.defaultModel || 'unknown';
      
      // Track API call for analysis (avec prompt brut)
      const callId = apiUsageTracker.trackCall({
        provider: normalizedProvider,
        model: modelId,
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
      
      // Partial mock via options (mock only raw LLM response)
      if (mockMode === 'raw') {
        console.log(`[${provider}] Using partial mock mode - mocking raw LLM response only`);
        text = getMockedRawResponse(provider, rawPrompt);
        
        // Update API call with mock usage (no real tokens)
        apiUsageTracker.updateCall(callId, {
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          duration: 0
        });
      } else {
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
          cost: estimateCost(normalizedProvider, modelId, tokens.inputTokens, tokens.outputTokens),
          duration
        });
        
        text = result.text;
      }
    }
    // Return RAW minimal for non-web-search path
    return {
      provider: provider === 'openai' ? 'OpenAI' : provider,
      prompt: trimmedPrompt,
      response: text,
      timestamp: new Date(),
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
      console.log(`Authentication error with ${provider} - throwing error to skip this provider`);
      throw new Error(`Authentication error with ${provider}`);
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


/**
 * Enhanced brand detection using the centralized service
 * This replaces the old brand detection logic with intelligent AI-based detection
 */
export async function detectBrandsInResponse(
  text: string,
  brandName: string,
  competitors: string[],
  options: {
    locale?: string;
    providerName?: string;
  } = {}
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
