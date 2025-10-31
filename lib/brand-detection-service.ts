/**
 * Brand Detection Service
 * Functions for extracting brands from text and calculating visibility
 */

import { logger } from './logger';

export interface BrandExtraction {
  brand: string;
  mentions: number;
  context: string;
  confidence: number;
}

export interface BrandVisibility {
  brand: string;
  visibilityScore: number;
  mentions: number;
  averagePosition: number;
  shareOfVoice: number;
  sentimentScore: number;
}

/**
 * Extract brands from text using cleaned brands as reference
 */
export async function extractBrandsFromText(
  text: string, 
  cleanedBrands: Array<{ original: string; cleaned: string; variations: string[]; confidence: number }>,
  sourceId: string
): Promise<BrandExtraction[]> {
  try {
    const extractions: BrandExtraction[] = [];
    const textLower = text.toLowerCase();
    
    // For each cleaned brand, search for it and its variations in the text
    for (const brandData of cleanedBrands) {
      const searchTerms = [brandData.cleaned, ...brandData.variations];
      let totalMentions = 0;
      const contexts: string[] = [];
      
      for (const term of searchTerms) {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = text.match(regex);
        
        if (matches) {
          totalMentions += matches.length;
          
          // Extract context around mentions
          const contextMatches = text.match(new RegExp(`.{0,50}${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{0,50}`, 'gi'));
          if (contextMatches) {
            contexts.push(...contextMatches.slice(0, 3)); // Limit to 3 contexts
          }
        }
      }
      
      if (totalMentions > 0) {
        extractions.push({
          brand: brandData.cleaned,
          mentions: totalMentions,
          context: contexts.join(' ... '),
          confidence: brandData.confidence
        });
      }
    }
    
    logger.debug(`[BrandDetection] Extracted ${extractions.length} brands from ${sourceId}`);
    return extractions;
    
  } catch (error) {
    logger.error(`[BrandDetection] Failed to extract brands from text (${sourceId}):`, error);
    return [];
  }
}

/**
 * Calculate brand visibility by provider
 */
export function calculateBrandVisibilityByProvider(
  brandExtractions: Map<string, BrandExtraction[]>,
  targetBrand: string,
  knownCompetitors: string[]
): Map<string, BrandVisibility[]> {
  const results = new Map<string, BrandVisibility[]>();
  
  try {
    // Get all unique brands across all providers
    const allBrands = new Set<string>();
    brandExtractions.forEach(extractions => {
      extractions.forEach(extraction => {
        allBrands.add(extraction.brand);
      });
    });
    
    // Calculate visibility for each provider
    brandExtractions.forEach((extractions, provider) => {
      const providerResults: BrandVisibility[] = [];
      
      // Calculate total mentions for share of voice
      const totalMentions = extractions.reduce((sum, ext) => sum + ext.mentions, 0);
      
      // Sort by mentions to get positions
      const sortedExtractions = [...extractions].sort((a, b) => b.mentions - a.mentions);
      
      allBrands.forEach(brand => {
        const brandExtraction = extractions.find(ext => ext.brand === brand);
        const mentions = brandExtraction?.mentions || 0;
        const position = sortedExtractions.findIndex(ext => ext.brand === brand) + 1;
        const shareOfVoice = totalMentions > 0 ? (mentions / totalMentions) * 100 : 0;
        
        // Simple visibility score calculation
        const visibilityScore = mentions > 0 ? Math.max(0, 100 - (position - 1) * 10) : 0;
        
        // Simple sentiment score (neutral for now)
        const sentimentScore = 50;
        
        providerResults.push({
          brand,
          visibilityScore: Math.round(visibilityScore),
          mentions,
          averagePosition: position,
          shareOfVoice: Math.round(shareOfVoice * 100) / 100,
          sentimentScore
        });
      });
      
      results.set(provider, providerResults);
    });
    
    logger.debug(`[BrandDetection] Calculated visibility for ${results.size} providers`);
    return results;
    
  } catch (error) {
    logger.error('[BrandDetection] Failed to calculate brand visibility:', error);
    return new Map();
  }
}






