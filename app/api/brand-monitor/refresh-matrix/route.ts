import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { analyzeCompetitorsByProvider } from '@/lib/ai-utils';
import { Company, AIResponse, BrandVariation } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { company, responses, knownCompetitors, brandVariations } = await request.json();
    
    if (!company || !responses || !knownCompetitors) {
      return NextResponse.json(
        { error: 'Données manquantes: company, responses, ou knownCompetitors' },
        { status: 400 }
      );
    }

    logger.info('[RefreshMatrix] 🔄 Recalcul de la matrice de comparaison...');
    logger.debug(`[RefreshMatrix] Company: ${company.name}`);
    logger.debug(`[RefreshMatrix] Responses: ${responses.length}`);
    logger.debug(`[RefreshMatrix] Known competitors: ${knownCompetitors.length}`);

    // Recalculer uniquement la matrice de comparaison
    const { providerRankings, providerComparison } = await analyzeCompetitorsByProvider(
      company as Company,
      responses as AIResponse[],
      knownCompetitors as string[],
      (brandVariations as Record<string, BrandVariation> | undefined)
    );

    logger.info('[RefreshMatrix] ✅ Matrice recalculée avec succès');
    
    return NextResponse.json({
      success: true,
      providerRankings,
      providerComparison,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[RefreshMatrix] ❌ Erreur:', error);
    
    return NextResponse.json(
      { 
        error: 'Erreur lors du recalcul de la matrice',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
