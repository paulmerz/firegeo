import OpenAI from 'openai';
import { AIResponse, type BrandVariation, type MockMode } from './types';
// import { ensureBrandVariationsForBrand } from './brand-detection-service';
import { apiUsageTracker, estimateCost } from './api-usage-tracker';
import { getLanguageName } from './locale-utils';
import { getMockedRawResponse } from './ai-utils-mock';

// const ensureBrandVariations = ensureBrandVariationsForBrand;

// function textIncludesAnyVariation(textLower: string, variations: string[]): boolean {
//   return variations.some((variation) => textLower.includes(variation.toLowerCase()));
// }

// Utility: get hostname from URL (without www)
// function hostnameFromUrl(url: string): string {
//   try {
//     const { hostname } = new URL(url);
//     return hostname.replace(/^www\./i, '') || hostname;
//   } catch {
//     return 'Source web';
//   }
// }


/**
 * OpenAI Web Search Implementation using the Responses API
 * Documentation: https://platform.openai.com/docs/guides/tools-web-search?api-mode=responses
 */

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Models that support web search via responses API
 */
const WEB_SEARCH_SUPPORTED_MODELS = [
  'gpt-4o',
  'gpt-4o-mini'
];

/**
 * Analyze prompt with OpenAI using web search
 */
export async function analyzePromptWithOpenAIWebSearch(
  originalPrompt: string,
  brandName: string,
  competitors: string[],
  locale?: string,
  model: string = 'gpt-4o-mini',
  precomputedVariations?: Map<string, BrandVariation> | Record<string, BrandVariation>,
  options?: { mockMode?: MockMode }
): Promise<AIResponse> {
  const client = getOpenAIClient();
  const languageName = locale ? getLanguageName(locale) : 'English';

  // Ensure the model supports web search
  if (!WEB_SEARCH_SUPPORTED_MODELS.includes(model)) {
    console.warn(`Model ${model} does not support web search, falling back to gpt-4o-mini`);
    model = 'gpt-4o-mini';
  }

  // Enhanced prompt for web search - do not ask model to append sources section in text
  const enhancedPrompt = `Question: ${originalPrompt}

IMPORTANT:
1/ Do not append any explicit "Sources consultées" section to the text.
2/ Keep your response concise and under 800 tokens.
3/ Return the content in ${languageName} language.`;

  try {
    console.log(`[OpenAI Web Search] Starting analysis with model: ${model}`);
    console.log(`[OpenAI Web Search] Prompt preview: "${enhancedPrompt.substring(0, 100)}..."`);

    // Track API call for web search analysis
    const callId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: model,
      operation: 'analysis',
      success: true,
      metadata: { 
        type: 'web_search',
        brandName,
        competitorsCount: competitors.length,
        locale
      }
    });

    let cleanedText: string;

    if (options?.mockMode === 'raw') {
      // Mocked raw response path
      const raw = getMockedRawResponse('OpenAI', originalPrompt);
      cleanedText = raw.trim();
      apiUsageTracker.updateCall(callId, { duration: 0, inputTokens: 0, outputTokens: 0, cost: 0 });
    } else {
      const startTime = Date.now();
      // Use OpenAI Responses API with web search
      const response = await client.responses.create({
        model: model,
        tools: [
          { type: "web_search" }
        ],
        input: enhancedPrompt,
        temperature: 0.7,
        max_output_tokens: 800,
      });
      const webSearchResponse = response as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const duration = Date.now() - startTime;

      // Update API call with duration (tokens not available from responses API)
      apiUsageTracker.updateCall(callId, {
        duration,
        // Estimate tokens based on response length
        inputTokens: Math.ceil(enhancedPrompt.length / 4), // Rough estimation
        outputTokens: Math.ceil((webSearchResponse.output_text?.length || 0) / 4),
        cost: estimateCost('openai', model, Math.ceil(enhancedPrompt.length / 4), Math.ceil((webSearchResponse.output_text?.length || 0) / 4))
      });

      console.log(`[OpenAI Web Search] Response received. Length: ${webSearchResponse.output_text?.length || 0}`);
      
      if (!webSearchResponse.output_text || webSearchResponse.output_text.length === 0) {
        console.error(`[OpenAI Web Search] ERROR: Empty response for prompt: "${originalPrompt}"`);
        throw new Error('OpenAI returned empty response');
      }

      const responseText = webSearchResponse.output_text;
      cleanedText = responseText.replace(/\n?Sources consultées?:[\s\S]*$/i, '').trim();
    }

    // Return RAW AIResponse minimal
    return {
      provider: 'OpenAI',
      prompt: originalPrompt,
      response: cleanedText,
      timestamp: new Date(),
    };

  } catch (error) {
    console.error('[OpenAI Web Search] Error:', error);
    
    // Check if it's an authentication error
    const isAuthError = error instanceof Error && (
      error.message.includes('401') || 
      error.message.includes('invalid_api_key') ||
      error.message.includes('Authorization Required') ||
      error.message.includes('authentication_error') ||
      error.message.includes('Incorrect API key')
    );
    
    if (isAuthError) {
      console.log('[OpenAI Web Search] Authentication error - throwing error to skip this provider');
      throw new Error('OpenAI authentication error');
    }
    
    // For other errors, log but don't return null - let the error bubble up
    console.error('[OpenAI Web Search] Non-auth error occurred:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw error;
  }
}


/**
 * Check if OpenAI web search is available
 */
export function isOpenAIWebSearchAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Get available models that support web search
 */
export function getWebSearchSupportedModels(): string[] {
  return [...WEB_SEARCH_SUPPORTED_MODELS];
}