import { AIResponse, AIResponseAnalysis, CompanyRanking } from './types';
import type { BrandVariation } from './types';
import { BrandMatcher, type BrandEntry } from './brand-matcher';

function buildBrandEntries(
  brandName: string,
  competitors: string[],
  brandVariations: Record<string, BrandVariation>
): { entries: BrandEntry[]; order: string[] } {
  const allBrands = [brandName, ...competitors];
  const entries: BrandEntry[] = [];
  for (const b of allBrands) {
    const v = brandVariations[b];
    const aliases = v?.variations?.length ? v.variations : [b];
    for (const alias of aliases) {
      if (!alias || typeof alias !== 'string') continue;
      entries.push({ brandId: b, alias });
    }
  }
  return { entries, order: allBrands };
}

// Simple local heuristic to derive rankings from text order when explicit numbers exist
function deriveRankingsFromText(text: string, orderedBrands: string[]): CompanyRanking[] {
  try {
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const rankings: CompanyRanking[] = [];
    let position = 1;
    for (const line of lines) {
      // Match lines starting with number or bullet
      if (/^(\d+\.|[-•])\s+/i.test(line)) {
        const lower = line.toLowerCase();
        const found = orderedBrands.find(b => lower.includes(b.toLowerCase()));
        if (found) {
          rankings.push({ position, company: found });
          position++;
        }
      }
    }
    return rankings;
  } catch {
    return [];
  }
}

export async function analyzeAIResponse(
  response: AIResponse,
  brandName: string,
  competitors: string[],
  brandVariations: Record<string, BrandVariation>,
  // _locale?: string
): Promise<AIResponseAnalysis> {
  const text = response.response || '';
  const { entries, order } = buildBrandEntries(brandName, competitors, brandVariations);
  const matcher = new BrandMatcher(entries, { wordBoundaries: true, longestMatchWins: true });
  const matches = matcher.match(text);

  const mentionedByBrand = new Map<string, number>();
  for (const m of matches) {
    mentionedByBrand.set(m.brandId, (mentionedByBrand.get(m.brandId) || 0) + 1);
  }

  const competitorsMentioned = competitors.filter(c => (mentionedByBrand.get(c) || 0) > 0);
  const brandMentioned = (mentionedByBrand.get(brandName) || 0) > 0;

  // Derive simple rankings if present
  const rankings = deriveRankingsFromText(text, order);
  const brandRanking = rankings.find(r => r.company === brandName);

  // Local sentiment placeholder
  const sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';

  // Confidence based on hits density
  const totalHits = Array.from(mentionedByBrand.values()).reduce((a, b) => a + b, 0);
  const confidence = Math.max(0.2, Math.min(1, Math.log(1 + totalHits) / 3));

  return {
    provider: response.provider,
    response: text,
    rankings,
    brandMentioned,
    competitors: competitorsMentioned,
    brandPosition: brandRanking?.position ?? (brandMentioned ? undefined : undefined),
    sentiment,
    confidence,
  };
}


