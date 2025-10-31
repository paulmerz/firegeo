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
export async function generateIntelligentBrandVariations(brandName: string, locale: string = 'en'): Promise<BrandVariation> {
  const openai = getOpenAIClient();
  
  const coreBrand = brandName.trim();
  const prompt = `You are a brand detection expert. Analyze this brand name and generate ONLY the variations that would be appropriate for brand detection in text.

Brand: "${coreBrand}"

Rules:
1. Include the full brand name and common case variations
2. Include ONLY distinctive parts that are NOT generic words (avoid: "cars", "technologies", "solutions", "systems", "group", "international", "global", "worldwide", "inc", "llc", "corp", "ltd", "limited", "company", "co")
3. Include common abbreviations/acronyms ONLY if they are distinctive to this brand
4. Do NOT include variations that would cause false positives (i.e Radical is a brand, but also an adjective and radical can easily be confused with the brand in a race car context)
5. For single-word brands that are common adjectives/nouns, ONLY include the exact brand name with proper capitalization (i.e Orange must not be included as "orange" as it would cause a false positive)
6. Avoid variations that could match common words in other contexts
7. Be smart as you are a brand detection expert and you know what is a brand and what is not, how people call it or not

Examples you can use for training :
- "Caterham Cars" → ["Caterham Cars", "Caterham", "caterham cars", "caterham"]
- "Louis Vuitton" → ["Louis Vuitton", "louis vuitton", "LV", "Vuitton"]
- "Alpine" → ["Alpine", "alpine"] (NOT "BMW Alpine" - that's a different brand)
- "Christian Dior" → ["Christian Dior", "christian dior", "Dior", "dior"]¨
- "Dior" → ["Dior", "dior", "Christian Dior", "christian dior"] ("Dior" is the short form, "Christian Dior" is the full brand name)
- "Yves Saint Laurent" → ["Saint Laurent", "YSL", "St Laurent", "Yves Saint Laurent", "yves saint laurent", "ysl"]
- "Patek Philippe" → ["Patek Philippe", "patek philippe", "Patek"] (NOT "philippe" - too common as last name and nobody calls the brand "philippe")
- "Audemars Piguet" → ["Audemars Piguet", "audemars piguet", "Audemars", "AP"] (NOT "Piguet" as nobody calls the brand "Piguet")
- "Grand Seiko" → ["Grand Seiko", "grand seiko", "GS"] (NOT "Seiko" as it is another brand, much lower price range, not "Grand" as it is a generic term and nobody calls the brand "Grand")
- "Nvidia Technologies" → ["Nvidia", "nvidia"] (NOT "technologies" - too generic)
- "Apple Inc" → ["Apple"] (NOT "apple" - too common as fruit)
- "Radical" → ["Radical"] (NOT "radical" - too common as adjective)
- "Orange" → ["Orange"] (NOT "orange" - too common as fruit)
- "Black" → ["Black"] (NOT "black" - too common as color)
- "Nike" → ["Nike", "nike"] (OK - distinctive enough, not too common)
- "Tesla" → ["Tesla", "tesla"] (OK - distinctive enough, not too common)
- "Google" → ["Google", "google"] (OK - distinctive enough, not too common the verb "google" comes from the brand name)
- "Amazon" → ["Amazon", "amazon"] (OK - distinctive enough, not too common)
- "Lotus" → ["Lotus", "lotus"] (OK - distinctive enough)
- "BMW" → ["BMW", "bmw"] (OK - distinctive acronym)
- "Mercedes" → ["Mercedes", "mercedes"] (OK - distinctive name)
- "Morgan Stanley" → ["Morgan Stanley", "Morgan Stanley & Co."] ("Morgan" is a generic name, "MS" is the acronym but never used alone)

CRITICAL: For brands that are VERY common words (like "Radical", "Apple", "Orange", "Black", "Google"...), be VERY conservative and ONLY include the exact brand name with proper capitalization. For distinctive brands (like "Nike", "Tesla", "Amazon", "Mercedes"...), include both capitalized and lowercase versions.

Return ONLY a JSON object with this exact structure:
{
  "original": "exact brand name",
  "variations": ["variation1", "variation2", ...],
  "confidence": 0.0
}`;

  try {
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a brand detection expert. Follow the rules strictly and return a compact JSON object exactly as specified.'
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

    // Parse JSON object { original, variations, confidence }
    let parsed: any;
    try {
      parsed = JSON.parse(response);
    } catch (parseError) {
      logger.warn(`[BrandVariations] Failed to parse AI response for "${brandName}":`, response);
      parsed = null;
    }

    const original = typeof parsed?.original === 'string' && parsed.original.trim() ? parsed.original.trim() : brandName;
    const variationsRaw: unknown = parsed?.variations;
    const confidence = typeof parsed?.confidence === 'number' ? parsed.confidence : 0.9;

    const variations = Array.isArray(variationsRaw) ? variationsRaw.filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0) : [brandName];
    if (!variations.includes(original)) variations.unshift(original);
    const uniqueVariations = [...new Set(variations)];

    return {
      original,
      variations: uniqueVariations,
      confidence,
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
      let mentionCount = 0; // Nombre total de mentions (toutes occurrences)
      let responseCount = 0; // Nombre de réponses contenant au moins une mention
      let totalConfidence = 0;

      extractions.forEach(extraction => {
        // Compter TOUTES les mentions de cette marque dans cette extraction
        // (y compris les variations comme "AP" pour "Audemars Piguet")
        const mentions = extraction.mentionedBrands.filter(m => isSameBrand(m.brand, brand));
        if (mentions.length > 0) {
          responseCount++; // Cette réponse contient au moins une mention
          mentionCount += mentions.length; // Ajouter toutes les mentions de cette réponse
          mentions.forEach(mention => {
            totalConfidence += mention.confidence;
          });
        }
      });

      const mentioned = mentionCount > 0;
      const averageConfidence = mentionCount > 0 ? totalConfidence / mentionCount : 0;
      // Le pourcentage est basé sur le nombre de réponses qui contiennent la marque
      const percentage = totalResponses > 0 ? (responseCount / totalResponses) * 100 : 0;                                                                        

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
