/**
 * Centralized Brand Detection Service
 * Single source of truth for brand detection and highlighting
 * Uses AI to generate intelligent brand variations
 */

import OpenAI from 'openai';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';

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

export interface BrandDetectionMatch {
  text: string;
  index: number;
  brandName: string;
  variation: string;
  confidence: number;
}

export interface BrandDetectionResult {
  mentioned: boolean;
  matches: BrandDetectionMatch[];
  confidence: number;
}

export interface BrandDetectionOptions {
  caseSensitive?: boolean;
  excludeNegativeContext?: boolean;
  minConfidence?: number;
}

/**
 * Generate intelligent brand variations using AI
 * This is the single source of truth for brand variations
 */
export async function generateIntelligentBrandVariations(
  brandName: string,
  locale: string = 'en'
): Promise<BrandVariation> {
  const coreBrand = brandName.trim();
  
  // For very simple single words, use basic variations
  if (coreBrand.length <= 3 && !coreBrand.includes(' ')) {
    return {
      original: coreBrand,
      variations: [coreBrand, coreBrand.toLowerCase()],
      confidence: 1.0
    };
  }

  const prompt = `You are a brand detection expert. Analyze this brand name and generate ONLY the variations that would be appropriate for brand detection in text.

Brand: "${coreBrand}"

Rules:
1. Include the full brand name and common case variations
2. Include ONLY distinctive parts that are NOT generic words (avoid: "cars", "technologies", "solutions", "systems", "group", "international", "global", "worldwide", "inc", "llc", "corp", "ltd", "limited", "company", "co")
3. Include common abbreviations/acronyms ONLY if they are distinctive to this brand
4. Do NOT include variations that would cause false positives
5. Be VERY conservative - fewer, more accurate variations are better than many inaccurate ones
6. For single-word brands that are common adjectives/nouns, ONLY include the exact brand name with proper capitalization
7. Avoid variations that could match common words in other contexts

Examples:
- "Caterham Cars" → ["Caterham Cars", "Caterham", "caterham cars", "caterham"]
- "Louis Vuitton" → ["Louis Vuitton", "louis vuitton", "LV"]
- "Alpine" → ["Alpine", "alpine"] (NOT "BMW Alpine" - that's a different brand)
- "Christian Dior" → ["Christian Dior", "christian dior", "Dior", "dior"]
- "Nvidia Technologies" → ["Nvidia", "nvidia"] (NOT "technologies" - too generic)
- "Apple Inc" → ["Apple"] (NOT "apple" - too common as fruit)
- "Radical" → ["Radical"] (NOT "radical" - too common as adjective)
- "Orange" → ["Orange"] (NOT "orange" - too common as fruit)
- "Black" → ["Black"] (NOT "black" - too common as color)
- "Nike" → ["Nike", "nike"] (OK - distinctive enough, not too common)
- "Tesla" → ["Tesla", "tesla"] (OK - distinctive enough, not too common)
- "Google" → ["Google"] (NOT "google" - too common as verb)
- "Amazon" → ["Amazon", "amazon"] (OK - distinctive enough, not too common)
- "Lotus" → ["Lotus", "lotus"] (OK - distinctive enough)
- "BMW" → ["BMW", "bmw"] (OK - distinctive acronym)
- "Mercedes" → ["Mercedes", "mercedes"] (OK - distinctive name)

CRITICAL: For brands that are VERY common words (like "Radical", "Apple", "Orange", "Black", "Google"...), be VERY conservative and ONLY include the exact brand name with proper capitalization. For distinctive brands (like "Nike", "Tesla", "Amazon", "Mercedes"...), include both capitalized and lowercase versions.

Return ONLY a JSON object with this exact structure:
{
  "original": "exact brand name",
  "variations": ["variation1", "variation2", ...],
  "confidence": 0.95
}`;

  let callId: string | undefined;
  
  try {
    const openai = getOpenAIClient();
    
    // Track API call for brand variations
    callId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'analysis',
      success: true,
      metadata: { 
        step: 'brand_variations',
        brandName: coreBrand,
        locale
      }
    });

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a brand detection expert. Generate precise brand variations for text detection, avoiding false positives. Return only valid JSON.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 300
    });
    const duration = Date.now() - startTime;

    let content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    // Clean up the response
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    }

    const result = JSON.parse(content);
    
    // Validate the response
    if (!result.original || !Array.isArray(result.variations) || typeof result.confidence !== 'number') {
      throw new Error('Invalid response format');
    }

    // Ensure the original brand name is included
    if (!result.variations.includes(result.original)) {
      result.variations.unshift(result.original);
    }

    // Remove duplicates and filter out empty strings
    result.variations = [...new Set(result.variations)].filter(v => v && typeof v === 'string' && v.trim().length > 0);

    // Extract tokens from usage and update API call
    const tokens = extractTokensFromUsage(response.usage);
    apiUsageTracker.updateCall(callId, {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cost: estimateCost('openai', 'gpt-4o-mini', tokens.inputTokens, tokens.outputTokens),
      duration
    });

    console.log(`🤖 [AI Brand Variations] ${coreBrand} → [${result.variations.join(', ')}]`);
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      brandName: coreBrand,
      locale,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      errorMessage,
      timestamp: new Date().toISOString()
    };
    
    console.error('[Brand Detection Service] AI brand variations failed:', errorDetails);
    
    // Update API call with error status
    if (callId) {
      apiUsageTracker.updateCall(callId, {
        success: false,
        error: errorMessage,
        metadata: {
          ...errorDetails,
          step: 'brand_variations_error'
        }
      });
    }
    
    // Re-throw the error instead of using fallback
    throw new Error(`Failed to generate brand variations for "${coreBrand}": ${errorMessage}`);
  }
}

/**
 * Detect brand mentions in text using intelligent variations
 * This is the single source of truth for brand detection
 */
export async function detectBrandMentions(
  text: string,
  brandName: string,
  options: BrandDetectionOptions = {}
): Promise<BrandDetectionResult> {
  const {
    caseSensitive = false,
    excludeNegativeContext = false,
    minConfidence = 0.3
  } = options;

  // Validation des paramètres d'entrée
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Le texte fourni est invalide ou vide');
  }

  if (!brandName || typeof brandName !== 'string' || brandName.trim().length === 0) {
    throw new Error('Le nom de marque fourni est invalide ou vide');
  }

  try {
    // Get intelligent variations
    const brandVariation = await generateIntelligentBrandVariations(brandName);
    
    if (brandVariation.confidence < minConfidence) {
      return {
        mentioned: false,
        matches: [],
        confidence: 0
      };
    }

    const matches: BrandDetectionMatch[] = [];

    // For brands that are common words, be more strict about case sensitivity
    const commonWords = ['apple', 'orange', 'black', 'radical', 'nike', 'tesla', 'google', 'amazon'];
    const isCommonWord = brandName.length <= 8 && /^[a-zA-Z]+$/.test(brandName) && 
                        commonWords.includes(brandName.toLowerCase());
    const shouldBeCaseSensitive = isCommonWord || caseSensitive;

    // Create regex patterns for each variation
    const patterns = brandVariation.variations.map(variation => {
      const escaped = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use word boundaries but be more careful about context
      return {
        variation,
        regex: new RegExp(`\\b${escaped}\\b`, shouldBeCaseSensitive ? 'g' : 'gi')
      };
    });

    // Always search in the original text to get correct positions
    patterns.forEach(({ variation, regex }) => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchText = match[0];
        const matchIndex = match.index;

        // Check for negative context if requested
        if (excludeNegativeContext) {
          const contextStart = Math.max(0, matchIndex - 50);
          const contextEnd = Math.min(text.length, matchIndex + matchText.length + 50);
          const context = text.substring(contextStart, contextEnd);
          
          const negativePatterns = [
            /\bnot\s+(?:recommended|good|worth|reliable)/i,
            /\bavoid\b/i,
            /\bworse\s+than\b/i,
            /\binferior\s+to\b/i,
            /\bdon't\s+(?:use|recommend|like)\b/i
          ];
          
          const hasNegativeContext = negativePatterns.some(np => np.test(context));
          if (hasNegativeContext) continue;
        }

        // Additional check to avoid matching in URLs or other inappropriate contexts
        const contextStart = Math.max(0, matchIndex - 20);
        const contextEnd = Math.min(text.length, matchIndex + matchText.length + 20);
        const context = text.substring(contextStart, contextEnd);
        
        // More precise checks for inappropriate contexts
        const isInUrl = /https?:\/\/[^\s]*/i.test(context) || /www\.[^\s]*/i.test(context);
        const isInEmail = /[^\s]+@[^\s]+/i.test(context);
        
        // Check if the match is directly part of a domain (like "caterham.com")
        const isDirectlyInDomain = /\.[a-z]{2,4}\b/i.test(context) && 
          context.indexOf(matchText) > 0 && 
          context[context.indexOf(matchText) - 1] === '.';
        
        // Check for actual file paths (not markdown formatting)
        const isInFilePath = /[\/\\][a-zA-Z0-9_\-\.]+/i.test(context) && !/\*\*/.test(context);
        
        if (isInUrl || isInEmail || isDirectlyInDomain || isInFilePath) {
          continue;
        }

        // Calculate confidence
        let confidence = brandVariation.confidence;
        
        // Boost confidence for exact matches
        if (matchText.toLowerCase() === brandName.toLowerCase()) {
          confidence = Math.min(confidence + 0.2, 1.0);
        }
        
        // Reduce confidence for partial matches
        if (variation.toLowerCase() !== brandName.toLowerCase()) {
          confidence = Math.max(confidence - 0.1, 0.1);
        }

        matches.push({
          text: matchText,
          index: matchIndex,
          brandName,
          variation,
          confidence
        });
      }
    });

    // Remove duplicate matches at the same position (keep highest confidence)
    const uniqueMatches = matches.reduce((acc, match) => {
      const existing = acc.find(m => m.index === match.index);
      if (!existing || match.confidence > existing.confidence) {
        return [...acc.filter(m => m.index !== match.index), match];
      }
      return acc;
    }, [] as BrandDetectionMatch[]);

    // Sort by confidence
    uniqueMatches.sort((a, b) => b.confidence - a.confidence);

    const overallConfidence = uniqueMatches.length > 0
      ? Math.max(...uniqueMatches.map(m => m.confidence))
      : 0;

    return {
      mentioned: uniqueMatches.length > 0,
      matches: uniqueMatches,
      confidence: overallConfidence
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      brandName,
      textLength: text.length,
      options,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      errorMessage,
      timestamp: new Date().toISOString()
    };
    
    console.error('[Brand Detection Service] Brand detection failed:', errorDetails);
    
    // Re-throw the error instead of returning empty result
    throw new Error(`Brand detection failed for "${brandName}": ${errorMessage}`);
  }
}

/**
 * Detect multiple brands in text
 */
export async function detectMultipleBrands(
  text: string,
  brandNames: string[],
  options: BrandDetectionOptions = {}
): Promise<Map<string, BrandDetectionResult>> {
  // Validation des paramètres d'entrée
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Le texte fourni est invalide ou vide');
  }

  if (!Array.isArray(brandNames) || brandNames.length === 0) {
    throw new Error('La liste des marques fournie est invalide ou vide');
  }

  const invalidBrands = brandNames.filter(name => typeof name !== 'string' || !name.trim());
  if (invalidBrands.length > 0) {
    throw new Error(`Certains noms de marques sont invalides: ${invalidBrands.length} marques invalides trouvées`);
  }

  const results = new Map<string, BrandDetectionResult>();
  
  // Process brands in parallel for better performance
  const detectionPromises = brandNames.map(async (brandName) => {
    try {
      const result = await detectBrandMentions(text, brandName, options);
      return { brandName, result, error: null };
    } catch (error) {
      return { brandName, result: null, error };
    }
  });

  const detectionResults = await Promise.all(detectionPromises);
  
  // Check if any detection failed
  const errors = detectionResults.filter(r => r.error);
  if (errors.length > 0) {
    const errorDetails = {
      totalBrands: brandNames.length,
      failedBrands: errors.length,
      errors: errors.map(e => ({
        brandName: e.brandName,
        errorType: e.error instanceof Error ? e.error.constructor.name : 'UnknownError',
        errorMessage: e.error instanceof Error ? e.error.message : 'Unknown error'
      })),
      timestamp: new Date().toISOString()
    };
    
    console.error('[Brand Detection Service] Multiple brand detection failed:', errorDetails);
    
    const errorMessages = errors.map(e => `${e.brandName}: ${e.error instanceof Error ? e.error.message : 'Unknown error'}`);
    throw new Error(`Brand detection failed for: ${errorMessages.join(', ')}`);
  }
  
  detectionResults.forEach(({ brandName, result }) => {
    if (result) {
      results.set(brandName, result);
    }
  });

  return results;
}

/**
 * Cache for brand variations to avoid repeated AI calls
 */
const brandVariationCache = new Map<string, BrandVariation>();

/**
 * Get cached brand variations or generate new ones
 */
export async function getCachedBrandVariations(
  brandName: string,
  locale: string = 'en'
): Promise<BrandVariation> {
  const cacheKey = `${brandName.toLowerCase()}_${locale}`;
  
  if (brandVariationCache.has(cacheKey)) {
    return brandVariationCache.get(cacheKey)!;
  }

  const variations = await generateIntelligentBrandVariations(brandName, locale);
  brandVariationCache.set(cacheKey, variations);
  
  return variations;
}

/**
 * Clear the brand variation cache
 */
export function clearBrandVariationCache(): void {
  brandVariationCache.clear();
}

/**
 * Clean brands with AI (migrated from brand-detection-enhanced)
 * This function provides the same interface as the old enhanced version
 */
export async function cleanBrandsWithAI(brands: string[]): Promise<Array<{
  original: string;
  cleaned: string;
  variations: string[];
  reasoning?: string;
}>> {
  console.log(`[BrandDetection] 🧹 Nettoyage de ${brands.length} marques avec OpenAI`);
  
  const results = [];
  
  for (const brand of brands) {
    try {
      const variation = await generateIntelligentBrandVariations(brand);
      results.push({
        original: brand,
        cleaned: variation.original,
        variations: variation.variations,
        reasoning: `AI-generated variations with confidence ${variation.confidence}`
      });
    } catch (error) {
      console.warn(`Failed to clean brand "${brand}":`, error);
      // Fallback to basic cleaning
      results.push({
        original: brand,
        cleaned: brand,
        variations: [brand, brand.toLowerCase()],
        reasoning: 'Fallback due to AI error'
      });
    }
  }
  
  return results;
}

/**
 * Extract brands from text (migrated from brand-detection-enhanced)
 * This function provides the same interface as the old enhanced version
 */
export async function extractBrandsFromText(
  text: string,
  targetBrands: Array<{
    original: string;
    cleaned: string;
    variations: string[];
    reasoning?: string;
  }>,
  provider: string
): Promise<{
  mentionedBrands: Array<{
    brand: string;
    matchedVariation: string;
    confidence: number;
    context?: string;
  }>;
  totalBrandsFound: number;
  confidence: number;
}> {
  console.log(`[BrandDetection] 🔍 Extraction des marques du texte ${provider} (${text.length} chars)`);
  
  const mentionedBrands: Array<{
    brand: string;
    matchedVariation: string;
    confidence: number;
    context?: string;
  }> = [];
  const brandNames = targetBrands.map(b => b.cleaned);
  
  try {
    const detectionResults = await detectMultipleBrands(text, brandNames, {
      caseSensitive: false,
      excludeNegativeContext: false,
      minConfidence: 0.3
    });
    
    detectionResults.forEach((result, brandName) => {
      if (result.mentioned) {
        result.matches.forEach(match => {
          mentionedBrands.push({
            brand: brandName,
            matchedVariation: match.variation,
            confidence: match.confidence,
            context: text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + match.text.length + 20))
          });
        });
      }
    });
    
    const totalBrandsFound = mentionedBrands.length;
    const confidence = totalBrandsFound > 0 
      ? mentionedBrands.reduce((sum, m) => sum + m.confidence, 0) / totalBrandsFound
      : 0;
    
    return {
      mentionedBrands,
      totalBrandsFound,
      confidence
    };
  } catch (error) {
    console.error('Brand extraction failed:', error);
    return {
      mentionedBrands: [],
      totalBrandsFound: 0,
      confidence: 0
    };
  }
}

/**
 * Calculate brand visibility by provider (migrated from brand-detection-enhanced)
 * This function provides the same interface as the old enhanced version
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
