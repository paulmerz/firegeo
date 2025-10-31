/**
 * Brand Variations Service
 * AI-powered generation of brand variations and aliases
 */

import OpenAI from 'openai';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';
import { logger } from './logger';

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export interface BrandVariation {
  original: string;
  variations: string[];
  confidence: number;
}

/**
 * Generate intelligent brand variations using AI
 * This is the single source of truth for brand variations
 */
export async function generateIntelligentBrandVariations(brandName: string): Promise<BrandVariation> {
  const openai = getOpenAIClient();
  
  const prompt = `Generate comprehensive brand variations and aliases for the brand "${brandName}".

Include:
- Common abbreviations and acronyms
- Alternative spellings and transliterations
- Nicknames and colloquial terms
- Industry-specific terms
- Common misspellings
- Regional variations

Return ONLY a JSON array of strings, no explanations or formatting. Example:
["Nike", "Nike Inc", "Nike Inc.", "Just Do It", "Swoosh"]

Brand: ${brandName}`;

  try {
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a brand analysis expert. Generate comprehensive brand variations and aliases. Return only valid JSON arrays of strings.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const endTime = Date.now();
    const response = completion.choices[0]?.message?.content?.trim();
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Track API usage
    const usage = completion.usage;
    if (usage) {
      const tokens = extractTokensFromUsage(usage);
      const cost = estimateCost('openai', 'gpt-4o-mini', tokens.inputTokens, tokens.outputTokens);
      apiUsageTracker.trackCall({
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'brand_canonicalization',
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        cost,
        success: true
      });
    }

    logger.debug(`[BrandVariations] Generated variations for "${brandName}" in ${endTime - startTime}ms`);

    // Parse the JSON response
    let variations: string[];
    try {
      variations = JSON.parse(response);
    } catch (parseError) {
      logger.warn(`[BrandVariations] Failed to parse AI response for "${brandName}":`, response);
      // Fallback to basic variations
      variations = [brandName];
    }

    // Ensure we have the original brand name
    if (!variations.includes(brandName)) {
      variations.unshift(brandName);
    }

    // Remove duplicates and empty strings
    const uniqueVariations = [...new Set(variations.filter(v => v && typeof v === 'string' && v.trim()))];

    return {
      original: brandName,
      variations: uniqueVariations,
      confidence: 0.9
    };

  } catch (error) {
    logger.error(`[BrandVariations] Failed to generate variations for "${brandName}":`, error);
    
    // Fallback to basic variations
    return {
      original: brandName,
      variations: [brandName],
      confidence: 0.5
    };
  }
}

// Cache for brand variations
const brandVariationCache = new Map<string, BrandVariation>();
const pendingBrandVariationPromises = new Map<string, Promise<BrandVariation>>();

function buildCacheKey(brandName: string): string {
  return brandName.toLowerCase().trim();
}

function cacheBrandVariations(brandName: string, variations: BrandVariation): void {
  const cacheKey = buildCacheKey(brandName);
  brandVariationCache.set(cacheKey, variations);
}

export async function ensureBrandVariationsForBrand(brandName: string, locale: string = 'en'): Promise<BrandVariation> {
  const cacheKey = buildCacheKey(brandName);

  if (brandVariationCache.has(cacheKey)) {
    return brandVariationCache.get(cacheKey)!;
  }

  if (pendingBrandVariationPromises.has(cacheKey)) {
    return pendingBrandVariationPromises.get(cacheKey)!;
  }

  logger.debug(`Brand variations not cached yet for "${brandName}" (${locale}) - generating`);

  const generationPromise = (async () => {
    try {
      const generated = await generateIntelligentBrandVariations(brandName);
      cacheBrandVariations(brandName, generated);
      return generated;
    } finally {
      pendingBrandVariationPromises.delete(cacheKey);
    }
  })();

  pendingBrandVariationPromises.set(cacheKey, generationPromise);

  return generationPromise;
}

/**
 * Clear the brand variation cache
 */
export function clearBrandVariationCache(): void {
  brandVariationCache.clear();
}

/**
 * Calculate brand visibility by provider
 */
export function calculateBrandVisibilityByProvider(
  brandExtractions: Map<string, Array<{
    mentionedBrands: Array<{
      brand: string;
      matchedVariation: string;
      confidence: number;
      context?: string;
    }>;
    totalBrandsFound: number;
    confidence: number;
  }>>,
  targetBrand: string,
  competitors: string[]
): Map<string, Map<string, {
  mentioned: boolean;
  confidence: number;
  mentionCount: number;
  totalResponses: number;
  percentage: number
}>> {
  console.log(`[BrandDetection] 📊 Calcul des détections par provider`);        

  const results = new Map();
  const allBrands = [targetBrand, ...competitors];

  // Normalization function for brand comparison
  const normalize = (value: string) => {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  };

  const isSameBrand = (a: string, b: string) => {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    return na.includes(nb) || nb.includes(na);
  };

  brandExtractions.forEach((extractions, provider) => {
    const providerResults = new Map();
    const totalResponses = extractions.length;

    allBrands.forEach(brand => {
      let mentionCount = 0;
      let totalConfidence = 0;

      extractions.forEach(extraction => {
        const mention = extraction.mentionedBrands.find(m => isSameBrand(m.brand, brand));                                                                      
        if (mention) {
          mentionCount++;
          totalConfidence += mention.confidence;
        }
      });

      const mentioned = mentionCount > 0;
      const averageConfidence = mentionCount > 0 ? totalConfidence / mentionCount : 0;                                                                          
      const percentage = totalResponses > 0 ? (mentionCount / totalResponses) * 100 : 0;                                                                        

      providerResults.set(brand, {
        mentioned,
        confidence: averageConfidence,
        mentionCount,
        totalResponses,
        percentage: Math.round(percentage * 10) / 10
      });
    });

    results.set(provider, providerResults);
  });

  return results;
}

/**
 * Clean brands with AI
 */
export async function cleanBrandsWithAI(brands: string[]): Promise<Array<{
  original: string;
  cleaned: string;
  variations: string[];
  confidence: number;
}>> {
  const openai = getOpenAIClient();
  
  const prompt = `Clean and standardize these brand names. For each brand, return:
1. The cleaned/standardized name
2. Common variations and aliases

Return a JSON array of objects with: original, cleaned, variations, confidence

Brands: ${brands.join(', ')}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a brand analysis expert. Clean and standardize brand names. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const response = completion.choices[0]?.message?.content?.trim();
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Track API usage
    const usage = completion.usage;
    if (usage) {
      const tokens = extractTokensFromUsage(usage);
      const cost = estimateCost('openai', 'gpt-4o-mini', tokens.inputTokens, tokens.outputTokens);
      apiUsageTracker.trackCall({
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'brand_cleaning',
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        cost,
        success: true
      });
    }

    const cleaned = JSON.parse(response);
    return Array.isArray(cleaned) ? cleaned : [];

  } catch (error) {
    logger.error('[BrandVariations] Failed to clean brands with AI:', error);
    
    // Fallback to basic cleaning
    return brands.map(brand => ({
      original: brand,
      cleaned: brand.trim(),
      variations: [brand.trim()],
      confidence: 0.5
    }));
  }
}
