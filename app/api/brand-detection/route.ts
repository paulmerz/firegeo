import { NextRequest, NextResponse } from 'next/server';

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

    // Convertir les brandNames en brandVariations pour la nouvelle API
    const brandVariations: Record<string, { variations: string[] }> = {};
    const brandList = Array.isArray(brandNames) ? brandNames : [brandNames];
    
    brandList.forEach(brandName => {
      brandVariations[brandName] = {
        variations: [brandName] // Utiliser le nom de la marque comme variation de base
      };
    });

    // Utiliser la nouvelle API BrandMatcher
    try {
      const response = await fetch(`${request.url.split('/api')[0]}/api/brand-detection/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, brandVariations })
      });

      if (!response.ok) {
        throw new Error(`BrandMatcher API failed: ${response.status}`);
      }

      const { matches } = await response.json();

      // Convertir les matches en format attendu par l'ancienne API
      if (typeof brandNames === 'string') {
        // Format pour une seule marque
        const brandMatches = matches.filter((match: any) => match.brandId === brandNames);
        const result = {
          mentioned: brandMatches.length > 0,
          matches: brandMatches.map((match: any) => ({
            text: match.surface,
            index: match.start,
            brandName: match.brandId,
            variation: match.surface,
            confidence: 1.0
          })),
          confidence: brandMatches.length > 0 ? 1.0 : 0
        };
        
        console.log(`[Brand Detection API] Single brand detection completed: ${brandNames} - ${result.mentioned ? 'mentioned' : 'not mentioned'}`);
        return NextResponse.json(result);
      } else {
        // Format pour plusieurs marques
        const results = new Map();
        brandList.forEach(brandName => {
          const brandMatches = matches.filter((match: any) => match.brandId === brandName);
          results.set(brandName, {
            mentioned: brandMatches.length > 0,
            matches: brandMatches.map((match: any) => ({
              text: match.surface,
              index: match.start,
              brandName: match.brandId,
              variation: match.surface,
              confidence: 1.0
            })),
            confidence: brandMatches.length > 0 ? 1.0 : 0
          });
        });
        
        // Convert Map to Object for JSON serialization
        const resultsObject = Object.fromEntries(results);
        console.log(`[Brand Detection API] Multiple brand detection completed: ${results.size} brands processed`);
        return NextResponse.json(resultsObject);
      }
    } catch (error) {
      console.error(`[Brand Detection API] BrandMatcher API failed:`, error);
      return NextResponse.json(
        { 
          error: 'Brand detection failed', 
          details: error instanceof Error ? error.message : 'Unknown error',
          brandNames: brandNames,
          code: 'BRAND_DETECTION_FAILED'
        },
        { status: 500 }
      );
    }
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
