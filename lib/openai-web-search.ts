import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { AIResponse, type MockMode } from './types';
import { apiUsageTracker, estimateCost } from './api-usage-tracker';
import { getMockedRawResponse } from './ai-utils-mock';

/**
 * OpenAI Web Search Implementation using the Responses API
 * Documentation: https://platform.openai.com/docs/guides/tools-web-search?api-mode=responses

// No direct OpenAI REST client needed; we rely on @ai-sdk/openai

/**
 * Models that support web search via responses API (IDs)
 */
const WEB_SEARCH_SUPPORTED_MODEL_IDS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-5',
] as const;

/**
 * Analyze prompt with OpenAI using web search
 */
export async function analyzePromptWithOpenAIWebSearch(
  originalPrompt: string,
  brandName: string,
  competitors: string[],
  locale?: string,
  modelId: string = 'gpt-5',
  options?: { mockMode?: MockMode }
): Promise<AIResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Ensure the model supports web search
  if (!WEB_SEARCH_SUPPORTED_MODEL_IDS.includes(modelId as (typeof WEB_SEARCH_SUPPORTED_MODEL_IDS)[number])) {
    console.warn(`Model ${modelId} does not support web search, falling back to gpt-4o-mini`);
    modelId = 'gpt-4o-mini';
  }

  // Enhanced prompt for web search - do not ask model to append sources section in text
  const prompt = `${originalPrompt}`;
  const model = openai.responses(modelId);

  try {
    console.log(`[OpenAI Web Search] Starting analysis with model: ${modelId}`);

    // Track API call for web search analysis
    const callId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: modelId,
      operation: 'analysis',
      success: true,
      metadata: { 
        type: 'web_search',
        brandName,
        competitorsCount: competitors.length,
        locale
      }
    });

    /*let cleanedText: string;*/
    let responseText: string;
    let urls: { url: string; title?: string | undefined; start_index: number; end_index: number}[] = [];

    if (options?.mockMode === 'raw') {
      // Mocked raw response path
      const raw = getMockedRawResponse('OpenAI', originalPrompt);
      /*cleanedText = raw.trim();*/
      responseText = raw.trim();
      apiUsageTracker.updateCall(callId, { duration: 0, inputTokens: 0, outputTokens: 0, cost: 0 });
    } else {
      const startTime = Date.now();
      // Use OpenAI Chat Completions API
      const result = await generateText({
        model: model,
        system: 'You are chatGPT, a helpful assistant.',
        prompt: prompt,
        tools: {
          web_search: openai.tools.webSearch({
            userLocation: { type: 'approximate', city: undefined, region: undefined, country: undefined, timezone: undefined }
          })
        },
        maxRetries: 3,
        toolChoice: { type: 'tool', toolName: 'web_search' },
        providerOptions: {
          openai: {
            parallelToolCalls: true,
            reasoningEffort: 'minimal',
          }
        },
        
      });
      const content = result.text;
      // Safely extract annotations (URLs) from the response
      urls = extractUrlAnnotations(result.sources);
      
      const duration = Date.now() - startTime;

      // Update API call with duration (tokens not available from responses API)
      apiUsageTracker.updateCall(callId, {
        duration,
        // Estimate tokens based on response length
        inputTokens: Math.ceil(prompt.length / 4), // Rough estimation
        outputTokens: Math.ceil(content.length / 4),
        cost: estimateCost('openai', modelId, Math.ceil(prompt.length / 4), Math.ceil(content.length / 4))
      });

      console.log(`[OpenAI Web Search] Response received. Length: ${content.length}`);
      console.log(`[OpenAI Web Search] Response received: ${content}`);
      
      if (!content || content.length === 0) {
        console.error(`[OpenAI Web Search] ERROR: Empty response for prompt: "${originalPrompt}"`);
        throw new Error('OpenAI returned empty response');
      }

      /*const responseText = content;
      cleanedText = responseText.replace(/\n?Sources consultées?:[\s\S]*$/i, '').trim();*/
      responseText = content;
      console.log(`[OpenAI Web Search] Response received. Length: ${responseText.length}`);
    }

    // Return RAW AIResponse minimal
    return {
      provider: 'OpenAI',
      prompt: originalPrompt,
      response: responseText,
      timestamp: new Date(),
      urls,
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

// No markdown injection: we return responseText as provided by the model

// Narrowing helper to extract URL annotations (with start/end indices) from OpenAI Responses API without using any
function extractUrlAnnotations(response: unknown): { url: string; title?: string; start_index: number; end_index: number }[] {
  const urls: { url: string; title?: string; start_index: number; end_index: number }[] = [];

  // Response may expose top-level annotations
  if (typeof response === 'object' && response !== null) {
    const maybeAnnotations = (response as Record<string, unknown>)['annotations'];
    if (Array.isArray(maybeAnnotations)) {
      for (const it of maybeAnnotations) {
        if (typeof it === 'object' && it !== null) {
          const url = (it as Record<string, unknown>)['url'];
          const title = (it as Record<string, unknown>)['title'];
          const start_index = (it as Record<string, unknown>)['start_index'];
          const end_index = (it as Record<string, unknown>)['end_index'];
          if (typeof url === 'string' && typeof start_index === 'number' && typeof end_index === 'number') {
            urls.push({ url, title: typeof title === 'string' ? title : undefined, start_index, end_index });
          }
        }
      }
    }

    // Some SDKs put rich content in output[] → content[] with annotations
    const maybeOutput = (response as Record<string, unknown>)['output'];
    if (Array.isArray(maybeOutput)) {
      for (const out of maybeOutput) {
        if (typeof out === 'object' && out !== null) {
          const content = (out as Record<string, unknown>)['content'];
          if (Array.isArray(content)) {
            for (const block of content) {
              if (typeof block === 'object' && block !== null) {
                const annotations = (block as Record<string, unknown>)['annotations'];
                if (Array.isArray(annotations)) {
                  for (const a of annotations) {
                    if (typeof a === 'object' && a !== null) {
                      const url = (a as Record<string, unknown>)['url'];
                      const title = (a as Record<string, unknown>)['title'];
                      const start_index = (a as Record<string, unknown>)['start_index'];
                      const end_index = (a as Record<string, unknown>)['end_index'];
                      if (typeof url === 'string' && typeof start_index === 'number' && typeof end_index === 'number') {
                        urls.push({ url, title: typeof title === 'string' ? title : undefined, start_index, end_index });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Return all annotations (no dedup to preserve multiple spans)
  return urls;
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
  return [...WEB_SEARCH_SUPPORTED_MODEL_IDS];
}