import type { AIResponse } from './types';

export type RawMatch = {
  brandId: string;
  aliasMatched: string;
  start: number;
  end: number;
  surface: string;
};

export type BrandStats = {
  mentioned: boolean;
  mentionCountResponses: number; // nombre de réponses contenant au moins une mention
  totalMentions: number; // total des occurrences trouvées (toutes réponses confondues)
  totalResponses: number;
  percentage: number; // visibility score: mentionCountResponses / totalResponses * 100
  confidence: number; // simple: 1 si mentionné, sinon 0 (peut évoluer)
};

/**
 * Calcule les statistiques de visibilité à partir des matches bruts par réponse
 */
export function calculateBrandStatistics(
  matchesPerResponse: RawMatch[][],
  trackedBrandIds: string[],
  brandIdToDisplayName: Record<string, string>
): Map<string, BrandStats> {
  const totalResponses = matchesPerResponse.length;
  const statsByDisplayName = new Map<string, BrandStats>();

  const ensure = (displayName: string) => {
    if (!statsByDisplayName.has(displayName)) {
      statsByDisplayName.set(displayName, {
        mentioned: false,
        mentionCountResponses: 0,
        totalMentions: 0,
        totalResponses,
        percentage: 0,
        confidence: 0,
      });
    }
    return statsByDisplayName.get(displayName)!;
  };

  // Initialiser toutes les marques suivies pour garantir présence dans les résultats
  for (const brandId of trackedBrandIds) {
    const display = brandIdToDisplayName[brandId] ?? brandId;
    ensure(display);
  }

  for (const matches of matchesPerResponse) {
    const brandsSeenInThisResponse = new Set<string>();
    for (const m of matches) {
      if (!trackedBrandIds.includes(m.brandId)) continue;
      const display = brandIdToDisplayName[m.brandId] ?? m.brandId;
      const s = ensure(display);
      s.totalMentions += 1;
      brandsSeenInThisResponse.add(display);
    }
    // incrémenter la visibilité par réponse
    for (const display of brandsSeenInThisResponse) {
      const s = ensure(display);
      s.mentionCountResponses += 1;
      s.mentioned = true;
      s.confidence = Math.max(s.confidence, 1);
    }
  }

  // Finaliser pourcentage
  for (const [display, s] of statsByDisplayName.entries()) {
    s.percentage = s.totalResponses > 0 ? Math.round((s.mentionCountResponses / s.totalResponses) * 1000) / 10 : 0;
  }

  return statsByDisplayName;
}

/**
 * Construit un mapping brandId -> displayName à partir d'un objet brandVariations
 * attendu au format { [brandId]: { original: string, variations: string[] } }
 */
export function buildBrandIdToDisplayName(
  brandVariations: Record<string, { original?: string; variations?: string[] }>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [brandId, v] of Object.entries(brandVariations || {})) {
    if (!brandId) continue;
    map[brandId] = v?.original || brandId;
  }
  return map;
}


