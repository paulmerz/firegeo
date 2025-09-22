import { NextRequest, NextResponse } from 'next/server';
import { analyzeCompetitorsByProvider } from '@/lib/ai-utils';
import { Company, AIResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { company, responses, knownCompetitors } = await request.json();
    
    if (!company || !responses || !knownCompetitors) {
      return NextResponse.json(
        { error: 'Données manquantes: company, responses, ou knownCompetitors' },
        { status: 400 }
      );
    }

    console.log('[RefreshMatrix] 🔄 Recalcul de la matrice de comparaison...');
    console.log(`[RefreshMatrix] Company: ${company.name}`);
    console.log(`[RefreshMatrix] Responses: ${responses.length}`);
    console.log(`[RefreshMatrix] Known competitors: ${knownCompetitors.length}`);

    // Recalculer uniquement la matrice de comparaison
    const { providerRankings, providerComparison } = await analyzeCompetitorsByProvider(
      company as Company,
      responses as AIResponse[],
      knownCompetitors as string[]
    );

    console.log('[RefreshMatrix] ✅ Matrice recalculée avec succès');
    
    return NextResponse.json({
      success: true,
      providerRankings,
      providerComparison,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[RefreshMatrix] ❌ Erreur:', error);
    
    return NextResponse.json(
      { 
        error: 'Erreur lors du recalcul de la matrice',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
