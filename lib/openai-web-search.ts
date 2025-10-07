import OpenAI from 'openai';
<<<<<<< Updated upstream
import { AIResponse } from './types';
import { apiUsageTracker, estimateCost } from './api-usage-tracker';
import { getLanguageName } from './locale-utils';

interface WebSearchSource {
  url: string;
  title?: string;
  text?: string;
  source?: string; // for annotations
  domain?: string;
  type?: string;
}

interface OpenAIWebSearchResponse {
  output_text?: string;
  web_search_call?: {
    action?: {
      sources?: WebSearchSource[];
    };
  };
  sources?: WebSearchSource[];
  search_results?: WebSearchSource[];
  output?: {
    sources?: WebSearchSource[];
  };
  annotations?: {
    type?: string;
    url?: string;
    source?: string;
    title?: string;
    text?: string;
  }[];
  reasoning?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface AnalysisData {
    rankings?: {
        position: number;
        company: string;
        reason: string;
        sentiment: 'positive' | 'neutral' | 'negative';
    }[];
    analysis?: {
        brandMentioned?: boolean;
        brandPosition?: number;
        competitors?: string[];
        overallSentiment?: 'positive' | 'neutral' | 'negative';
        confidence?: number;
    };
}

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
  
  return Array.from(variations).filter(v => v.length > 1);
}

/**
 * Use OpenAI to generate smart brand variations for complex multi-word brands
 * This handles cases like "Silence Urban Mobility" → ["Silence Urban Mobility", "Silence", "silence"]
 */
export async function createAIBrandVariations(
  brandString: string,
  locale?: string,
  model: string = 'gpt-4o-mini'
): Promise<string[]> {
  const coreBrand = extractBrandName(brandString);
  
  // For simple single-word brands, use the simple function
  if (!coreBrand.includes(' ') || coreBrand.split(/\s+/).length <= 2) {
    return createSimpleBrandVariations(brandString);
  }
  
  const prompt = `Analyze this brand name and generate search variations for brand detection.

Brand: "${coreBrand}"

Generate variations that would help detect this brand in text, focusing on:
1. The full brand name
2. The distinctive part(s) that are NOT generic terms (avoid words like "Urban", "Mobility", "Systems", "Solutions", "Technologies", "Group", "International", "Global", "Worldwide", "The", "And", "Of", "For", "Inc", "LLC", "Corp")
3. Different cases (original, lowercase, proper case)

Examples:
- "Silence Urban Mobility" → ["Silence Urban Mobility", "Silence", "silence"]
- "Clean Motion Technologies" → ["Clean Motion Technologies", "Clean Motion", "clean motion", "CleanMotion", "cleanmotion"]
- "XEV YoYo" → ["XEV YoYo", "XEV", "xev", "YoYo", "yoyo"]

Return ONLY a JSON array of strings, no other text.`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a brand detection expert. Generate search variations for brand names, focusing on distinctive parts while avoiding generic terms. Return only valid JSON arrays.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    let content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.warn('No content from OpenAI brand variations');
      return createSimpleBrandVariations(brandString);
    }

    // Try to parse JSON response
    try {
      // Remove optional markdown fences ```json ... ``` if present
      if (content.startsWith('```')) {
        content = content.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
      }
      const variations = JSON.parse(content);
      if (Array.isArray(variations) && variations.every(v => typeof v === 'string')) {
        const filtered = filterBrandVariations(coreBrand, variations);
        console.log(`🤖 [AI Brand Variations] ${coreBrand} → [${filtered.join(', ')}]`);
        return filtered;
      }
    } catch {
      console.warn('Failed to parse OpenAI brand variations JSON:', content);
    }
  } catch (error) {
    console.warn('OpenAI brand variations failed:', error);
  }
  
  // Fallback to simple variations (filtered)
  return filterBrandVariations(coreBrand, createSimpleBrandVariations(brandString));
}

/**
 * Create smart variations of a brand name for better detection
 * Uses hybrid approach: simple variations for basic brands, AI for complex ones
 */
async function createSmartBrandVariations(brandString: string, locale?: string): Promise<string[]> {
  const coreBrand = extractBrandName(brandString);
  
  // For simple brands (1-2 words), use deterministic approach
  if (!coreBrand.includes(' ') || coreBrand.split(/\s+/).length <= 2) {
    return createSimpleBrandVariations(brandString);
  }
  
  // For complex multi-word brands, use AI
  return createAIBrandVariations(brandString, locale);
}
=======
import { AIResponse, type BrandVariation } from './types';
import { ensureBrandVariationsForBrand } from './brand-detection-service';
import { apiUsageTracker, estimateCost } from './api-usage-tracker';
import { getLanguageName } from './locale-utils';
import { logger } from './logger';
>>>>>>> Stashed changes

const ensureBrandVariations = ensureBrandVariationsForBrand;

function textIncludesAnyVariation(textLower: string, variations: string[]): boolean {
  return variations.some((variation) => textLower.includes(variation.toLowerCase()));
}

// Utility: get hostname from URL (without www)
function hostnameFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./i, '') || hostname;
  } catch {
    return 'Source web';
  }
}


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
<<<<<<< Updated upstream
 * Canonicalize a list of raw brand names using OpenAI.
 */
export async function canonicalizeBrandsWithOpenAI(
  rawNames: string[],
  locale?: string,
  model: string = 'gpt-4o-mini'
): Promise<{ canonicalNames: string[]; mapping: Record<string, string>; alternatives: Record<string, string[]> }> {
  const client = getOpenAIClient();
  const languageName = locale ? getLanguageName(locale) : 'English';

  const unique = Array.from(new Set((rawNames || []).filter(Boolean)));
  if (unique.length === 0) {
    return { canonicalNames: [], mapping: {}, alternatives: {} };
  }

  const instruction = `You are a brand normalization engine. Given a list of raw company/brand strings, output canonical brand names with their common alternative names.\n\nRules:\n- Collapse corporate suffixes: Inc, LLC, Corp, Corporation, Ltd, Limited, SA, SAS, GmbH, PLC, BV, AG\n- Remove geography/organization qualifiers like International, Global, Europe, USA, EU, Group, Holdings\n- Remove product models/lines and anything in parentheses or after commas\n- Treat different brands as distinct even if similar (e.g., "Ginette" is a brand; "NY" alone is NOT a brand and must not be mapped to Ginette)\n- Keep the brand root: "Renault Sport", "Renault International" -> "Renault"; "Ginette NY", "Ginette" -> "Ginette"; but do NOT map "NY" -> "Ginette"\n- Preserve diacritics/accents when known; otherwise return a natural Title Case canonicalization\n\nFor each brand, also provide common alternative names/shortcuts that people use:\n- Patek Philippe -> "Patek"\n- Louis Vuitton -> "LV"\n- Christian Dior -> "Dior"\n- Mercedes-Benz -> "Mercedes"\n- Harley-Davidson -> "Harley"\n- McDonald's -> "McDo", "McDonald's"\n- BMW -> "BMW" (no common alternative)\n- Apple -> "Apple" (no common alternative)\n\nReturn STRICT JSON with keys: canonicalNames (unique list), mapping (object from raw to canonical), alternatives (object from canonical to array of alternative names). Do not include any extra keys.\n\nLanguage for free-text (if needed): ${languageName}`;

  const user = `Raw brands:\n${unique.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;

  try {
    // Track API call for brand canonicalization
    const callId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: model,
      operation: 'analysis',
      success: true,
      metadata: { 
        step: 'brand_canonicalization',
        brandsCount: unique.length,
        locale
      }
    });

    const startTime = Date.now();
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });
    const duration = Date.now() - startTime;

    // Update API call with actual usage
    apiUsageTracker.updateCall(callId, {
      inputTokens: res.usage?.prompt_tokens || 0,
      outputTokens: res.usage?.completion_tokens || 0,
      cost: estimateCost('openai', model, res.usage?.prompt_tokens || 0, res.usage?.completion_tokens || 0),
      duration
    });

    const content = res.choices[0]?.message?.content || '{}';
    const parsed: {
      canonicalNames?: string[];
      mapping?: Record<string, string>;
      alternatives?: Record<string, string[]>;
    } = JSON.parse(content);
    const mapping: Record<string, string> = parsed?.mapping || {};
    const canonicalNames: string[] = parsed?.canonicalNames || [];
    const alternatives: Record<string, string[]> = parsed?.alternatives || {};

    // Safety net: ensure mapping for each input
    for (const raw of unique) {
      if (!mapping[raw]) {
        const base = extractBrandName(raw)
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\s*(inc|llc|corp|corporation|ltd|limited|sa|sas|gmbh|plc|bv|ag|international|global|group|holdings)\b/gi, '')
          .replace(/\s*\([^)]*\)\s*/g, ' ')
          .replace(/,.*$/, '')
          .replace(/\s+/g, ' ')
          .trim();
        const title = base.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ').trim() || raw;
        mapping[raw] = title;
        if (!canonicalNames.includes(title)) canonicalNames.push(title);
        // Add empty alternatives array if not present
        if (!alternatives[title]) alternatives[title] = [];
      }
    }

    const seen = new Set<string>();
    const dedup = canonicalNames.filter(n => (seen.has(n) ? false : (seen.add(n), true)));

    console.log('[Brand Canonicalizer] Input:', unique);
    console.log('[Brand Canonicalizer] Mapping:', mapping);
    console.log('[Brand Canonicalizer] Canonical:', dedup);
    console.log('[Brand Canonicalizer] Alternatives:', alternatives);

    return { canonicalNames: dedup, mapping, alternatives };
  } catch (e) {
    console.warn('[Brand Canonicalizer] Failed, fallback to identity mapping:', (e as Error)?.message);
    return { 
      canonicalNames: unique, 
      mapping: Object.fromEntries(unique.map(n => [n, n])), 
      alternatives: Object.fromEntries(unique.map(n => [n, []])) 
    };
  }
}

/**
=======
>>>>>>> Stashed changes
 * Analyze prompt with OpenAI using web search
 */
export async function analyzePromptWithOpenAIWebSearch(
  originalPrompt: string,
  brandName: string,
  competitors: string[],
  locale?: string,
<<<<<<< Updated upstream
  model: string = 'gpt-4o-mini'
): Promise<AIResponse | null> {
=======
  model: string = 'gpt-4o-mini',
  precomputedVariations?: Map<string, BrandVariation> | Record<string, BrandVariation>
): Promise<AIResponse> {
>>>>>>> Stashed changes
  const client = getOpenAIClient();
  const languageName = locale ? getLanguageName(locale) : 'English';

  // Ensure the model supports web search
  if (!WEB_SEARCH_SUPPORTED_MODELS.includes(model)) {
    console.warn(`Model ${model} does not support web search, falling back to gpt-4o-mini`);
    model = 'gpt-4o-mini';
  }

  // Enhanced prompt for web search - do not ask model to append sources section in text
  const enhancedPrompt = `IMPORTANT: You must search the web for current, factual information to answer this question. Do not rely on your training data alone.

Question: ${originalPrompt}

Please search for recent information, current rankings, and up-to-date data to provide an accurate and current response. Do not append any explicit "Sources consultées" section to the text.

IMPORTANT: Keep your response concise and under 800 tokens. Prioritize the most important information and rankings.

Return the content in ${languageName} language.`;

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
    const webSearchResponse = response as OpenAIWebSearchResponse;
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

    // Extract web search sources from multiple possible locations
    const webSearchSources: WebSearchSource[] = [];
    
    // Method 1: Check standard API response paths
    if (webSearchResponse.web_search_call?.action?.sources) {
      webSearchSources.push(...webSearchResponse.web_search_call.action.sources);
    } else if (webSearchResponse.sources) {
      webSearchSources.push(...webSearchResponse.sources);
    } else if (webSearchResponse.search_results) {
      webSearchSources.push(...webSearchResponse.search_results);
    } else if (webSearchResponse.output?.sources) {
      webSearchSources.push(...webSearchResponse.output.sources);
    }
    
    // Method 2: Check annotations field
    if (webSearchResponse.annotations) {
      const annotations = webSearchResponse.annotations;
      if (Array.isArray(annotations)) {
        annotations.forEach((annotation) => {
          if (annotation.type === 'citation' || annotation.url) {
            webSearchSources.push({
              url: annotation.url || annotation.source || '',
              title: annotation.title || annotation.text || 'Citation',
              type: 'annotation'
            });
          }
        });
      }
    }
    
    // Method 3: Extract sources from the response text itself
    const responseText = webSearchResponse.output_text;
    // Clean any inline sources section so it won't render in UI
    const cleanedText = responseText.replace(/\n?Sources consultées?:[\s\S]*$/i, '').trim();
    
    // Method 4: Extract URLs from anywhere in the response text with context
    if (webSearchSources.length === 0) {
      const allUrls = cleanedText.match(/https?:\/\/[^\s\)]+/g);
      if (allUrls) {
        allUrls.forEach((url: string) => {
          const cleanUrl = url.replace(/[.,;)]+$/, '');
          
          webSearchSources.push({ 
            url: cleanUrl, 
            domain: hostnameFromUrl(cleanUrl),
            type: 'url_extraction'
          });
        });
      }
    }
    
    // Method 5: Check reasoning field for sources
    if (webSearchResponse.reasoning && webSearchSources.length === 0) {
      const reasoningText = webSearchResponse.reasoning;
      if (typeof reasoningText === 'string') {
        const urlMatches = reasoningText.match(/https?:\/\/[^\s)]+/g);
        if (urlMatches) {
          urlMatches.forEach((url: string) => {
            webSearchSources.push({ 
              url, 
              domain: 'Source from reasoning',
              type: 'reasoning'
            });
          });
        }
      }
    }

    console.log(`[OpenAI Web Search] Web search sources found: ${webSearchSources.length}`);
    if (webSearchSources.length > 0) {
      console.log(`[OpenAI Web Search] Sources:`, webSearchSources.map(s => s.url || s.domain).join(', '));
    }
    
    // For debugging, show if web search was actually used
    const reasoningText = webSearchResponse.reasoning;
    const webSearchUsed = responseText.includes('recherche') || 
                         responseText.includes('récent') ||
                         responseText.includes('2024') ||
                         responseText.includes('Sources consultées') ||
                         responseText.includes('selon') ||
                         (typeof reasoningText === 'string' && reasoningText.includes('search'));
    console.log(`[OpenAI Web Search] Web search appears to have been used: ${webSearchUsed}`);

    // Convert Record to Map if necessary
    const variationsMap = precomputedVariations instanceof Map
      ? precomputedVariations
      : precomputedVariations
        ? new Map(Object.entries(precomputedVariations))
        : undefined;

    // Analyze the response for brand mentions and rankings
    const analysisResult = await analyzeResponseContent(
      cleanedText,
      brandName,
      competitors,
      languageName,
      client,
      locale,
      variationsMap
    );

    return {
      provider: 'OpenAI',
      prompt: originalPrompt, // Keep the original prompt for proper frontend matching
      response: cleanedText,
      rankings: analysisResult.rankings,
      competitors: analysisResult.competitors,
      brandMentioned: analysisResult.brandMentioned,
      brandPosition: analysisResult.brandPosition,
      sentiment: analysisResult.sentiment,
      confidence: analysisResult.confidence,
      timestamp: new Date(),
      webSearchSources: webSearchSources.map((s) => ({
        title: s.title || s.domain || 'Source web',
        url: s.url || '',
        snippet: s.text || ''
      })),
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
      console.log('[OpenAI Web Search] Authentication error - returning null to skip this provider');
      return null;
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
 * Analyze the response content for brand mentions and rankings
 */
async function analyzeResponseContent(
  text: string,
  brandName: string,
  competitors: string[],
  languageName: string,
  client: OpenAI,
  locale?: string,
  precomputedVariations?: Map<string, BrandVariation>
): Promise<{
  rankings: { position: number; company: string; reason: string; sentiment: 'positive' | 'neutral' | 'negative' }[];
  competitors: string[];
  brandMentioned: boolean;
  brandPosition?: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}> {
  const analysisPrompt = `Analyze this AI response about ${brandName} and its competitors:

Response: "${text}"

Your task:
1. Look for ANY mention of ${brandName} anywhere in the response (even if not ranked)
2. Look for ANY mention of these competitors: ${competitors.join(', ')}
3. For each mentioned company, determine if it has a specific ranking position
4. Identify the sentiment towards each mentioned company
5. Rate your confidence in this analysis (0-1)

IMPORTANT: A company is "mentioned" if it appears anywhere in the response text, even without a specific ranking. Count ALL mentions, not just ranked ones. Return the analysis in ${languageName} language.

Be very thorough in detecting company names - they might appear in different contexts (listed, compared, recommended, etc.)

Please respond in JSON format with the following structure:
{
  "rankings": [{"position": number, "company": string, "reason": string, "sentiment": "positive|neutral|negative"}],
  "analysis": {
    "brandMentioned": boolean,
    "brandPosition": number | null,
    "competitors": string[],
    "overallSentiment": "positive|neutral|negative",
    "confidence": number
  }
}`;

  try {
    // Use standard chat completion for analysis (faster and more reliable)
    const analysisResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing text and extracting structured information about companies and rankings. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const analysisText = analysisResponse.choices[0]?.message?.content;
    if (!analysisText) {
      console.warn('[OpenAI Web Search] No analysis response received, falling back to text analysis');
      throw new Error('No analysis response received');
    }

    const analysisData: AnalysisData = JSON.parse(analysisText);
    
    console.log('[OpenAI Web Search] Structured analysis successful');
    
    // Enhanced brand detection fallback (same as ai-utils-enhanced.ts)
    // Apply robust detection logic even after successful structured analysis
    const textLower = text.toLowerCase();
    
    // Enhanced brand detection with smart variations
    const brandVariationsRecord = precomputedVariations instanceof Map
      ? precomputedVariations.get(brandName)
      : (precomputedVariations?.[brandName] ?? undefined);
    const resolvedBrandVariations = brandVariationsRecord ?? await ensureBrandVariations(brandName, locale);
    const enhancedBrandMentioned = analysisData.analysis?.brandMentioned ||
      textIncludesAnyVariation(textLower, resolvedBrandVariations.variations);
      
    // Add any missed competitors from text search with smart variations
    const aiCompetitors = new Set<string>((analysisData.analysis?.competitors || []) as string[]);
    const allMentionedCompetitors = new Set<string>([...aiCompetitors]);
    
    for (const competitor of competitors) {
      const competitorVariationsRecord = precomputedVariations instanceof Map
        ? precomputedVariations.get(competitor)
        : (precomputedVariations?.[competitor] ?? undefined);
      const competitorVariations = competitorVariationsRecord ?? await ensureBrandVariations(competitor, locale);
      const found = textIncludesAnyVariation(textLower, competitorVariations.variations);
      
      if (found) {
        allMentionedCompetitors.add(competitor);
      }
    }

    // Filter competitors to only include the ones we're tracking
    const relevantCompetitors = Array.from(allMentionedCompetitors).filter(c => 
      competitors.includes(c) && c !== brandName
    );
    
    try {
      const brandTerms = resolvedBrandVariations.variations;
      const competitorTermsMap: Record<string, string[]> = {};
      for (const c of competitors) {
        const competitorVariationsRecord = precomputedVariations instanceof Map
          ? precomputedVariations.get(c)
          : (precomputedVariations?.[c] ?? undefined);
        const competitorVariations = competitorVariationsRecord ?? await ensureBrandVariations(c, locale);
        competitorTermsMap[c] = competitorVariations.variations;
      }
      console.log('🔎 [OpenAI Web Search Detection] Terms used:');
      console.log('  • Brand:', brandName, '→', brandTerms);
      console.log('  • Competitors:', competitorTermsMap);
      console.log('  • Found brandMentioned:', enhancedBrandMentioned);
      console.log('  • Found competitors:', Array.from(allMentionedCompetitors));
    } catch (error) {
      console.warn('🔎 [OpenAI Web Search Detection] Log terms failed:', error);
    }
    
    return {
      rankings: (analysisData.rankings || []),
      competitors: relevantCompetitors,
      brandMentioned: enhancedBrandMentioned,
      brandPosition: analysisData.analysis?.brandPosition || undefined,
      sentiment: analysisData.analysis?.overallSentiment || 'neutral',
      confidence: analysisData.analysis?.confidence || 0.5,
    };

  } catch (error) {
    console.error('[OpenAI Web Search] Structured analysis failed, using fallback:', error);
    
    // Fallback to basic text analysis
    const textLower = text.toLowerCase();
    
    // Enhanced brand detection with smart variations (fallback)
    const fallbackBrandVariationRecord = precomputedVariations instanceof Map
      ? precomputedVariations.get(brandName)
      : (precomputedVariations?.[brandName] ?? undefined);
    const fallbackBrandVariations = fallbackBrandVariationRecord ?? await ensureBrandVariations(brandName, locale);
    const mentioned = textIncludesAnyVariation(textLower, fallbackBrandVariations.variations);
      
    // Enhanced competitor detection with smart variations (fallback)
    const detectedCompetitors: string[] = [];
    for (const c of competitors) {
      const competitorRecord = precomputedVariations instanceof Map
        ? precomputedVariations.get(c)
        : (precomputedVariations?.[c] ?? undefined);
      const competitorVariations = competitorRecord ?? await ensureBrandVariations(c, locale);
      if (textIncludesAnyVariation(textLower, competitorVariations.variations)) {
        detectedCompetitors.push(c);
      }
    }
    
    return {
      rankings: [],
      competitors: detectedCompetitors,
      brandMentioned: mentioned,
      brandPosition: undefined,
      sentiment: 'neutral' as const,
      confidence: 0.5,
    };
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