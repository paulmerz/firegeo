import { NextRequest, NextResponse } from 'next/server';
import { BrandMatcher, type BrandEntry } from '@/lib/brand-matcher';
import type { BrandVariation } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { text, brandVariations } = await request.json();
    
    console.log('[BrandDetectionAPI] Request received:', { 
      textLength: text?.length, 
      brandVariationsKeys: Object.keys(brandVariations || {}),
      brandVariations 
    });
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (!brandVariations || typeof brandVariations !== 'object') {
      return NextResponse.json(
        { error: 'brandVariations is required and must be an object' },
        { status: 400 }
      );
    }
    
    // Construire les entries pour BrandMatcher
    const entries: BrandEntry[] = [];
    Object.entries(brandVariations).forEach(([brandName, variation]) => {
      const v = variation as unknown as BrandVariation;
      if (v && typeof v === 'object' && Array.isArray(v.variations)) {
        v.variations.forEach((alias: string) => {
          if (typeof alias === 'string' && alias.trim()) {
            entries.push({ brandId: brandName, alias: alias.trim() });
          }
        });
      }
    });
    
    if (entries.length === 0) {
      return NextResponse.json({ matches: [] });
    }
    
    const matcher = new BrandMatcher(entries, { 
      wordBoundaries: true, 
      longestMatchWins: true 
    });
    
    const matches = matcher.match(text);

    // Construire un mapping brandId -> displayName (original) si disponible dans brandVariations
    const brandIdToName: Record<string, string> = {};
    Object.entries(brandVariations || {}).forEach(([brandId, v]: [string, any]) => {
      if (!brandId) return;
      const original = typeof v === 'object' && v && typeof v.original === 'string' ? v.original : undefined;
      brandIdToName[brandId] = original || brandId;
    });
    
    console.log('[BrandDetectionAPI] Matches found:', matches);
    
    return NextResponse.json({ matches, brandIdToName });
  } catch (error) {
    console.error('Brand detection API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
