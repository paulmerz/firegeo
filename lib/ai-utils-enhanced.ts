import { generateText, LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
// import { z } from 'zod';
import { AIResponse, type MockMode } from './types';
import { getProviderModel, normalizeProviderName, getProviderConfig, PROVIDER_CONFIGS } from './provider-config';
// import { getLanguageName } from './locale-utils';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';
// Types for brand detection
export interface BrandDetectionMatch {
  text: string;
  index: number;
  brandName: string;
  variation: string;
  confidence: number;
  snippet?: string;
}
import { cleanProviderResponse } from './provider-response-utils';
import { getMockedRawResponse, getMockedSources } from './ai-utils-mock';

const OPENAI_WEB_MODEL_ID = 'gpt-5' as const;

/**
 * Extract brand name from complex brand strings
 * Focus on the actual brand, not the product
 */

// Version unifiée: génération de réponses (avec/sans web search)
export async function analyzePromptWithProviderEnhanced(
  prompt: string,
  provider: string,
  useWebSearch: boolean = true,
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
  
  let model: LanguageModel | null = null;
  const generateConfig: Record<string, unknown> = {};
  
  // Configuration par provider (model, system, tools, providerOptions)
  let systemPrompt: string = 'You are a helpful assistant.';
  let toolsOpenAI: { web_search: ReturnType<typeof openai.tools.webSearch> } | undefined;
  let toolChoice: { type: 'tool'; toolName: 'web_search' } | undefined;
  let providerOptions: {
    openai?: { reasoningEffort: 'minimal' | 'medium' | 'high'; parallelToolCalls?: true };
    google?: { useSearchGrounding: true };
  } = {};

  switch (normalizedProvider) {
    case 'openai': {
      if (useWebSearch) {
        model = openai.responses(OPENAI_WEB_MODEL_ID);
        systemPrompt = 'You are ChatGPT, a helpful assistant.';
        toolsOpenAI = {
          web_search: openai.tools.webSearch({
            userLocation: { type: 'approximate', city: undefined, region: undefined, country: undefined, timezone: undefined }
          })
        } as const;
        toolChoice = { type: 'tool', toolName: 'web_search' } as const;
        providerOptions = { openai: { reasoningEffort: 'medium', parallelToolCalls: true as const } };
      } else {
        model = getProviderModel('openai');
        systemPrompt = 'You are ChatGPT, a helpful assistant.';
        providerOptions = { openai: { reasoningEffort: 'medium' } };
      }
      break;
    }
    case 'google': {
      model = getProviderModel('google', undefined, { useWebSearch });
      systemPrompt = 'You are a helpful assistant.';
      if (useWebSearch) {
        providerOptions = { google: { useSearchGrounding: true as const } };
      }
      break;
    }
    case 'perplexity': {
      // Recherche intégrée côté Perplexity
      model = getProviderModel('perplexity');
      systemPrompt = 'You are Perplexity, a helpful search assistant trained by Perplexity AI.';
      break;
    }
    case 'anthropic': {
      model = getProviderModel('anthropic');
      systemPrompt = 'You are a helpful assistant.';
      break;
    }
    case 'mistral': {
      model = getProviderModel('mistral');
      systemPrompt = 'You are a helpful assistant.';
      break;
    }
    default: {
      model = getProviderModel(normalizedProvider, undefined, { useWebSearch });
      systemPrompt = 'You are a helpful assistant.';
    }
  }
  
  if (!model) {
    console.warn(`Failed to get model for ${provider}`);
    throw new Error(`Provider ${provider} not configured`);
  }

  // IMPORTANT: envoyer le prompt brut sans injection d'instructions supplémentaires
  const rawPrompt = trimmedPrompt;

  try {
    let text: string;
    let urlsNormalized: { url: string; title?: string }[] | undefined;

    // Ensure model exists
    if (!model) {
      throw new Error(`Invalid model for ${provider}`);
    }

    // Déterminer le modelId pour le tracking
    const providerConfigForId = PROVIDER_CONFIGS[normalizedProvider];
    const modelId = normalizedProvider === 'openai' && useWebSearch ? OPENAI_WEB_MODEL_ID : (providerConfigForId?.defaultModel || 'unknown');

    // Track API call (prompt brut)
    const callId = apiUsageTracker.trackCall({
      provider: normalizedProvider,
      model: modelId,
      operation: 'analysis',
      success: true,
      metadata: { 
        prompt: rawPrompt.substring(0, 100) + '...',
        useWebSearch
      }
    });

    const startTime = Date.now();

    if (mockMode === 'raw') {
      // Mock de la réponse LLM
      text = getMockedRawResponse(provider, rawPrompt);
      const mockUrls = getMockedSources(provider, rawPrompt);
      urlsNormalized = mockUrls.length ? mockUrls : undefined;
      apiUsageTracker.updateCall(callId, { inputTokens: 0, outputTokens: 0, cost: 0, duration: 0 });
    } else {
      const result = await generateText({
        model,
        prompt: rawPrompt,
        system: systemPrompt,
        ...generateConfig,
        maxRetries: 3,
        ...(toolsOpenAI ? { tools: toolsOpenAI } : {}),
        ...(toolChoice ? { toolChoice } : {}),
        ...(Object.keys(providerOptions).length ? { providerOptions } : {}),
      });

      text = result.text;
      const sources = result.sources;
      // Normaliser les sources en objets { url, title? }
      if (Array.isArray(sources)) {
        const items: { url: string; title?: string }[] = [];
        for (const s of sources as unknown[]) {
          if (typeof s === 'string' && s) {
            items.push({ url: s });
          } else if (typeof s === 'object' && s !== null) {
            const url = (s as Record<string, unknown>).url;
            const title = (s as Record<string, unknown>).title;
            if (typeof url === 'string' && url) {
              items.push({ url, title: typeof title === 'string' ? title : undefined });
            }
          }
        }
        urlsNormalized = items.length ? items : undefined;
      }

      const duration = Date.now() - startTime;
      const tokens = extractTokensFromUsage(result.usage);
      const inputTokens = tokens.inputTokens || Math.ceil(rawPrompt.length / 4);
      const outputTokens = tokens.outputTokens || Math.ceil(text.length / 4);
      apiUsageTracker.updateCall(callId, {
        inputTokens,
        outputTokens,
        cost: estimateCost(normalizedProvider, modelId, inputTokens, outputTokens),
        duration
      });
    }

    return {
      provider: provider,
      prompt: trimmedPrompt,
      response: text,
      timestamp: new Date(),
      ...(normalizedProvider === 'openai' || normalizedProvider === 'perplexity' || normalizedProvider === 'google') && urlsNormalized
        ? { urls: urlsNormalized }
        : {}
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
    brandVariations?: Record<string, any>;
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
    const { providerName, brandVariations } = options;
    const cleanedText = cleanProviderResponse(text, { providerName });

    // Initialize detection results
    const allBrands = [brandName, ...competitors];
    const detectionResults = new Map<string, { mentioned: boolean; matches: BrandDetectionMatch[]; confidence: number }>();
    
    // Initialize all brands
    allBrands.forEach(brand => {
      detectionResults.set(brand, { mentioned: false, matches: [], confidence: 0 });
    });

    // Use the new BrandMatcher API if brandVariations are provided
    if (brandVariations) {
      const response = await fetch('/api/brand-detection/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: cleanedText, 
          brandVariations 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Brand detection API failed: ${response.status}`);
      }
      
      const { matches } = await response.json();
      
      // Process matches
      matches.forEach((match: any) => {
        if (allBrands.includes(match.brandId)) {
          const result = detectionResults.get(match.brandId)!;
          result.mentioned = true;
          result.matches.push({
            text: match.surface,
            index: match.start,
            brandName: match.brandId,
            variation: match.surface,
            confidence: 1.0
          });
          result.confidence = Math.max(result.confidence, 1.0);
        }
      });
    }

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

// Note: L'AI SDK actuel ne fournit plus d'index d'annotations; nous renvoyons donc urls: []
