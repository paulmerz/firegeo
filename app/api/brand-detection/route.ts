import { NextRequest, NextResponse } from 'next/server';
import { detectBrandMentions, detectMultipleBrands, type BrandDetectionOptions } from '@/lib/brand-detection-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, brandNames, options = {} } = body;

    // Validation des paramètres d'entrée
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { 
          error: 'Invalid text parameter', 
          details: 'Text must be a non-empty string',
          code: 'INVALID_TEXT'
        },
        { status: 400 }
      );
    }

    if (!brandNames || (typeof brandNames !== 'string' && !Array.isArray(brandNames))) {
      return NextResponse.json(
        { 
          error: 'Invalid brandNames parameter', 
          details: 'brandNames must be a string or array of strings',
          code: 'INVALID_BRAND_NAMES'
        },
        { status: 400 }
      );
    }

    // Validation des noms de marques
    if (Array.isArray(brandNames)) {
      const invalidBrands = brandNames.filter(name => typeof name !== 'string' || !name.trim());
      if (invalidBrands.length > 0) {
        return NextResponse.json(
          { 
            error: 'Invalid brand names in array', 
            details: `Found ${invalidBrands.length} invalid brand names`,
            code: 'INVALID_BRAND_ARRAY'
          },
          { status: 400 }
        );
      }
    }

    // Validation des options
    if (options && typeof options !== 'object') {
      return NextResponse.json(
        { 
          error: 'Invalid options parameter', 
          details: 'Options must be an object',
          code: 'INVALID_OPTIONS'
        },
        { status: 400 }
      );
    }

    console.log(`[Brand Detection API] Processing request: text length=${text.length}, brandNames=${Array.isArray(brandNames) ? brandNames.length : 1}`);

    // If single brand name, use detectBrandMentions
    if (typeof brandNames === 'string') {
      try {
        const result = await detectBrandMentions(text, brandNames, options as BrandDetectionOptions);
        console.log(`[Brand Detection API] Single brand detection completed: ${brandNames} - ${result.mentioned ? 'mentioned' : 'not mentioned'}`);
        return NextResponse.json(result);
      } catch (error) {
        console.error(`[Brand Detection API] Single brand detection failed for "${brandNames}":`, error);
        return NextResponse.json(
          { 
            error: 'Single brand detection failed', 
            details: error instanceof Error ? error.message : 'Unknown error',
            brandName: brandNames,
            code: 'SINGLE_BRAND_DETECTION_FAILED'
          },
          { status: 500 }
        );
      }
    }

    // If multiple brand names, use detectMultipleBrands
    if (Array.isArray(brandNames)) {
      try {
        const results = await detectMultipleBrands(text, brandNames, options as BrandDetectionOptions);
        // Convert Map to Object for JSON serialization
        const resultsObject = Object.fromEntries(results);
        console.log(`[Brand Detection API] Multiple brand detection completed: ${results.size} brands processed`);
        return NextResponse.json(resultsObject);
      } catch (error) {
        console.error(`[Brand Detection API] Multiple brand detection failed:`, error);
        return NextResponse.json(
          { 
            error: 'Multiple brand detection failed', 
            details: error instanceof Error ? error.message : 'Unknown error',
            brandNames: brandNames,
            code: 'MULTIPLE_BRAND_DETECTION_FAILED'
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Invalid brandNames format', 
        details: 'brandNames must be a string or array',
        code: 'INVALID_BRAND_NAMES_FORMAT'
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Brand Detection API] Unexpected error:', error);
    
    // Gestion des erreurs de parsing JSON
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body', 
          details: 'Request body must be valid JSON',
          code: 'INVALID_JSON'
        },
        { status: 400 }
      );
    }

    // Gestion des erreurs générales
    return NextResponse.json(
      { 
        error: 'Brand detection service unavailable', 
        details: error instanceof Error ? error.message : 'Unknown server error',
        code: 'SERVICE_UNAVAILABLE'
      },
      { status: 500 }
    );
  }
}
