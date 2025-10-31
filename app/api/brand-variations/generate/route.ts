import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { upsertBrandAliases } from '@/lib/db/aliases-service';
import { ensureBrandVariationsForBrand } from '@/lib/brand-variations-service';

export async function POST(request: NextRequest) {
  try {
    logger.info('[Brand Variations API] Generating brand variations');

    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      logger.error('[Brand Variations API] No authenticated user');
      throw new AuthenticationError('Please log in to use this feature');
    }

    const body = await request.json();
    const { brands } = body;

    if (!brands || !Array.isArray(brands) || brands.length === 0) {
      throw new ValidationError('Brands array is required');
    }

    // Valider la structure des brands
    for (const brand of brands) {
      if (!brand.name || !brand.id) {
        throw new ValidationError('Each brand must have name and id');
      }
    }

    logger.info('[Brand Variations API] Processing brands', {
      count: brands.length,
      brands: brands.map(b => ({ name: b.name, id: b.id }))
    });

    // Générer les variations pour chaque marque
    const results = [];
    for (const brand of brands) {
      try {
        logger.info(`[Brand Variations API] Generating variations for "${brand.name}"`);
        
        const variations = await ensureBrandVariationsForBrand(brand.name, 'en');
        
        // Sauvegarder en BDD
        await upsertBrandAliases(brand.id, variations.variations);
        
        results.push({
          brandId: brand.id,
          brandName: brand.name,
          variationsCount: variations.variations.length,
          success: true
        });
        
        logger.info(`[Brand Variations API] Generated ${variations.variations.length} variations for "${brand.name}"`);
      } catch (error) {
        logger.error(`[Brand Variations API] Failed to generate variations for "${brand.name}":`, error);
        results.push({
          brandId: brand.id,
          brandName: brand.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('[Brand Variations API] Generation completed', {
      total: brands.length,
      success: successCount,
      failed: brands.length - successCount
    });

    return NextResponse.json({ 
      success: true, 
      results,
      summary: {
        total: brands.length,
        success: successCount,
        failed: brands.length - successCount
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
