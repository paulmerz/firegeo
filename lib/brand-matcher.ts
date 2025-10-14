import { AhoCorasick } from '@monyone/aho-corasick';

export type BrandEntry = {
  brandId: string;
  alias: string;
};

export type Match = {
  brandId: string;
  aliasMatched: string;
  start: number;
  end: number;
  surface: string;
};

export type BrandMatcherOptions = {
  wordBoundaries?: boolean;
  longestMatchWins?: boolean;
  keepOverlapsForDebug?: boolean;
};

const DEFAULT_OPTS: Required<BrandMatcherOptions> = {
  wordBoundaries: true,
  longestMatchWins: true,
  keepOverlapsForDebug: false,
};

export function normalize(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'")
    // Considérer tirets et espaces comme équivalents pour la détection de marques
    // Remplacer tous les types de tirets par des espaces afin que
    // "Saint-Laurent" corresponde aussi à "Saint Laurent" et inversement
    .replace(/[\-–—]/g, ' ')
    // On ne compacte pas les espaces ici pour la précision des index
    // L'appelant peut compacter s'il le souhaite pour d'autres usages
    .toLowerCase();
}

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[\p{L}\p{N}]/u.test(ch);
}

function hasWordBoundaries(text: string, start: number, end: number): boolean {
  const before = text[start - 1];
  const after = text[end];
  const leftBoundary = !isWordChar(before);
  const rightBoundary = !isWordChar(after);
  return leftBoundary && rightBoundary;
}

export class BrandMatcher {
  private opts: Required<BrandMatcherOptions>;
  private brands: BrandEntry[] = [];
  private patterns: string[] = [];
  private idxToBrand: Map<number, BrandEntry> = new Map();
  private automaton: AhoCorasick | null = null;

  // Conserver un mapping indexNormalisé -> indexOriginal pour extraire correctement la surface
  private lastIndexMap: number[] = [];

  constructor(brands: BrandEntry[], options?: BrandMatcherOptions) {
    this.opts = { ...DEFAULT_OPTS, ...(options || {}) };
    this.setBrands(brands);
  }

  public setBrands(brands: BrandEntry[]) {
    this.brands = brands.slice();
    this.patterns = this.brands.map((b) => normalize(b.alias));
    this.idxToBrand = new Map();
    this.patterns.forEach((_, i) => this.idxToBrand.set(i, this.brands[i]));
    this.automaton = new AhoCorasick(this.patterns);
  }

  public addBrands(extra: BrandEntry[]) {
    this.setBrands([...this.brands, ...extra]);
  }

  private normalizeWithIndexMap(text: string): { norm: string; indexMap: number[] } {
    const indexMap: number[] = [];
    let norm = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      // Normalisation caractère par caractère pour préserver la correspondance des index
      const seg = ch
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’‘`´]/g, "'")
        .replace(/[\-–—]/g, ' ')
        .toLowerCase();
      // Pour chaque caractère produit, faire pointer vers l'index original i
      for (let k = 0; k < seg.length; k++) indexMap.push(i);
      norm += seg;
    }
    return { norm, indexMap };
  }

  public match(text: string): Match[] {
    if (!text) return [];
    if (!this.automaton) return [];

    const { norm, indexMap } = this.normalizeWithIndexMap(text);
    this.lastIndexMap = indexMap;

    type Span = { start: number; end: number; idx: number };
    const spans: Span[] = [];

    // Utiliser l'API officielle matchInText() au lieu de search()
    const matches = this.automaton.matchInText(norm);
    for (const match of matches) {
      const start = match.begin;
      const end = match.end;
      const keyword = match.keyword;
      const idx = this.patterns.indexOf(keyword);
      if (idx !== -1) {
        spans.push({ start, end, idx });
      }
    }

    const boundaryFiltered = this.opts.wordBoundaries
      ? spans.filter((s) => hasWordBoundaries(norm, s.start, s.end))
      : spans;

    if (!boundaryFiltered.length) return [];

    boundaryFiltered.sort((a, b) => (a.start - b.start) || (b.end - a.end));

    const kept: Span[] = [];
    if (this.opts.keepOverlapsForDebug || !this.opts.longestMatchWins) {
      kept.push(...boundaryFiltered);
    } else {
      let lastEnd = -1;
      for (const s of boundaryFiltered) {
        if (s.start >= lastEnd) {
          kept.push(s);
          lastEnd = s.end;
        }
      }
    }

    const results: Match[] = kept.map((s) => {
      const brand = this.idxToBrand.get(s.idx)!;
      const startOriginal = indexMap[s.start] ?? 0;
      const endOriginal = (indexMap[s.end - 1] ?? startOriginal) + 1;
      return {
        brandId: brand.brandId,
        aliasMatched: brand.alias,
        start: startOriginal,
        end: endOriginal,
        surface: text.slice(startOriginal, endOriginal),
      };
    });

    return results;
  }
}



// Helper pour fabriquer un BrandMatcher depuis des variations
export type BrandVariationLike = { original: string; variations: string[]; confidence: number };

export function buildBrandMatcherFromVariations(
  brandVariations: Record<string, BrandVariationLike>,
  brandNames: string[],
  options?: BrandMatcherOptions
): { matcher: BrandMatcher; entries: BrandEntry[] } {
  const entries: BrandEntry[] = [];
  const seen = new Set<string>();
  for (const brandId of brandNames) {
    const v = brandVariations[brandId];
    const aliases = v?.variations?.length ? v.variations : [brandId];
    for (const alias of aliases) {
      const key = `${brandId}__${normalize(alias)}`;
      if (!alias || seen.has(key)) continue;
      seen.add(key);
      entries.push({ brandId, alias });
    }
  }
  const matcher = new BrandMatcher(entries, options);
  return { matcher, entries };
}
