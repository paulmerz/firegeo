import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderModel } from './provider-config';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';

// Schema pour le nettoyage des marques par OpenAI
const BrandCleanupSchema = z.object({
  brands: z.array(z.object({
    original: z.string(),
    cleaned: z.string(),
    variations: z.array(z.string()),
    reasoning: z.string().optional(),
  })),
});

// Schema pour l'extraction des marques depuis les textes LLM
const BrandExtractionSchema = z.object({
  mentionedBrands: z.array(z.object({
    brand: z.string(),
    matchedVariation: z.string(),
    confidence: z.number().min(0).max(1),
    context: z.string().optional(),
  })),
  analysis: z.object({
    totalBrandsFound: z.number(),
    confidence: z.number().min(0).max(1),
  }),
});

export interface CleanedBrand {
  original: string;
  cleaned: string;
  variations: string[];
  reasoning?: string;
}

export interface BrandWithAlternatives {
  canonical: string;
  alternatives: string[];
  original: string;
}

export interface EnhancedBrand {
  canonical: string;
  allVariations: string[];
  original: string;
}

export interface BrandMention {
  brand: string;
  matchedVariation: string;
  confidence: number;
  context?: string;
}

export interface BrandExtractionResult {
  mentionedBrands: BrandMention[];
  totalBrandsFound: number;
  confidence: number;
}

/**
 * Étape 1.5: Traite les marques avec noms alternatifs et crée toutes les variations
 */
export async function processBrandsWithAlternatives(
  brandsWithAlternatives: BrandWithAlternatives[]
): Promise<EnhancedBrand[]> {
  console.log(`[BrandDetection] 🔄 Traitement de ${brandsWithAlternatives.length} marques avec alternatives`);
  
  const enhancedBrands: EnhancedBrand[] = [];
  
  for (const brand of brandsWithAlternatives) {
    // Combine canonical name with alternatives
    const allNames = [brand.canonical, ...brand.alternatives];
    
    // Create variations for each name
    const allVariations = new Set<string>();
    
    for (const name of allNames) {
      if (name && name.trim()) {
        const variations = createBasicVariations(name);
        variations.forEach(v => allVariations.add(v));
      }
    }
    
    // Add the canonical name itself
    allVariations.add(brand.canonical);
    
    enhancedBrands.push({
      canonical: brand.canonical,
      allVariations: Array.from(allVariations),
      original: brand.original
    });
    
    console.log(`[BrandDetection] ✅ ${brand.canonical}: ${allVariations.size} variations (${brand.alternatives.length} alternatives)`);
  }
  
  return enhancedBrands;
}

/**
 * Étape 2: Nettoie les marques avec OpenAI pour enlever le bruit générique
 */
export async function cleanBrandsWithAI(brands: string[]): Promise<CleanedBrand[]> {
  console.log(`[BrandDetection] 🧹 Nettoyage de ${brands.length} marques avec OpenAI`);
  
  const model = getProviderModel('openai', 'gpt-4o-mini');
  if (!model) {
    throw new Error('OpenAI model not available for brand cleaning');
  }

  const prompt = `Analyse ces noms de marques et nettoie-les en enlevant le bruit générique.

Marques à analyser: ${brands.map(b => `"${b}"`).join(', ')}

Pour chaque marque:
1. Identifie le nom de marque principal (sans suffixes génériques comme "Inc", "International", "Sports", "Group", "Ltd", "SA", "GmbH", etc.)
2. Crée des variations pour une détection robuste:
   - Variations d'accents (Citroën → citroen, citroën)
   - Variations de casse (CITROEN, Citroen, citroen)
   - Variations d'espacement (Van Moof → VanMoof, vanmoof)
   - Variations de ponctuation (Riese & Müller → Riese Muller, RieseMuller)

Exemple:
- "Citroën International SA" → nettoyé: "Citroën", variations: ["Citroën", "citroen", "CITROEN", "Citroen"]
- "Trek Bicycle Corporation" → nettoyé: "Trek", variations: ["Trek", "trek", "TREK"]

IMPORTANT: 
- Garde seulement le nom de marque essentiel
- Ne garde pas les termes génériques de secteur ou juridiques
- Assure-toi que les variations couvrent les cas courants de détection`;

  try {
    // Track API call for brand cleaning
    const callId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'analysis',
      success: true,
      metadata: { 
        step: 'brand_cleaning',
        brandsCount: brands.length
      }
    });

    const startTime = Date.now();
    const { object, usage } = await generateObject({
      model,
      schema: BrandCleanupSchema,
      prompt,
      temperature: 0.1,
    });
    const duration = Date.now() - startTime;

    // Extract tokens from usage
    const tokens = extractTokensFromUsage(usage);
    
    // Update API call with actual usage
    apiUsageTracker.updateCall(callId, {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cost: estimateCost('openai', 'gpt-4o-mini', tokens.inputTokens, tokens.outputTokens),
      duration
    });

    console.log(`[BrandDetection] ✅ Nettoyage terminé: ${object.brands.length} marques traitées`);
    object.brands.forEach(brand => {
      console.log(`  - "${brand.original}" → "${brand.cleaned}" (${brand.variations.length} variations)`);
    });

    return object.brands;
  } catch (error) {
    console.error('[BrandDetection] ❌ Erreur lors du nettoyage:', error);
    // Fallback: nettoyage basique sans IA
    return brands.map(brand => ({
      original: brand,
      cleaned: brand,
      variations: createBasicVariations(brand),
    }));
  }
}

/**
 * Étape 3: Crée des variations basiques si l'IA n'est pas disponible
 */
function createBasicVariations(brand: string): string[] {
  const variations = new Set<string>();
  
  // Original
  variations.add(brand);
  
  // Variations de casse
  variations.add(brand.toLowerCase());
  variations.add(brand.toUpperCase());
  variations.add(brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase());
  
  // Sans accents
  const normalized = brand.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized !== brand) {
    variations.add(normalized);
    variations.add(normalized.toLowerCase());
    variations.add(normalized.toUpperCase());
  }
  
  // Sans espaces
  const noSpaces = brand.replace(/\s+/g, '');
  if (noSpaces !== brand) {
    variations.add(noSpaces);
    variations.add(noSpaces.toLowerCase());
    variations.add(noSpaces.toUpperCase());
  }
  
  // Sans ponctuation
  const noPunctuation = brand.replace(/[^\w\s]/g, '');
  if (noPunctuation !== brand) {
    variations.add(noPunctuation);
    variations.add(noPunctuation.toLowerCase());
  }
  
  return Array.from(variations).filter(v => v.length > 1);
}

/**
 * Pipeline complet de détection de marques avec noms alternatifs
 */
export async function detectBrandsWithAlternatives(
  rawBrands: string[],
  text: string,
  provider: string,
  locale?: string
): Promise<BrandExtractionResult> {
  console.log(`[BrandDetection] 🚀 Pipeline complet de détection avec alternatives`);
  
  try {
    // Étape 1: Normalisation avec OpenAI (inclut les noms alternatifs)
    const { canonicalizeBrandsWithOpenAI } = await import('./openai-web-search');
    const { canonicalNames, mapping, alternatives } = await canonicalizeBrandsWithOpenAI(rawBrands, locale);
    
    // Convertir en format BrandWithAlternatives
    const brandsWithAlternatives: BrandWithAlternatives[] = canonicalNames.map(canonical => ({
      canonical,
      alternatives: alternatives[canonical] || [],
      original: Object.keys(mapping).find(orig => mapping[orig] === canonical) || canonical
    }));
    
    // Étape 2: Traitement des alternatives et création des variations
    const enhancedBrands = await processBrandsWithAlternatives(brandsWithAlternatives);
    
    // Étape 3: Extraction des marques du texte
    const result = await extractBrandsFromTextEnhanced(text, enhancedBrands, provider);
    
    console.log(`[BrandDetection] ✅ Pipeline terminé: ${result.totalBrandsFound} marques détectées`);
    return result;
    
  } catch (error) {
    console.error('[BrandDetection] ❌ Erreur dans le pipeline:', error);
    return {
      mentionedBrands: [],
      totalBrandsFound: 0,
      confidence: 0
    };
  }
}

/**
 * Étape 4: Extrait les marques des textes LLM avec OpenAI (version améliorée)
 */
export async function extractBrandsFromTextEnhanced(
  text: string,
  targetBrands: EnhancedBrand[],
  provider: string
): Promise<BrandExtractionResult> {
  console.log(`[BrandDetection] 🔍 Extraction des marques du texte ${provider} (${text.length} chars) - VERSION AMÉLIORÉE`);
  console.log(`[BrandDetection] 📝 Aperçu du texte: "${text.substring(0, 300)}..."`);
  console.log(`[BrandDetection] 🎯 Marques à chercher: ${targetBrands.map(b => b.canonical).join(', ')}`);
  
  const model = getProviderModel('openai', 'gpt-4o-mini');
  if (!model) {
    throw new Error('OpenAI model not available for brand extraction');
  }

  // Prépare la liste des marques avec leurs variations
  const brandsList = targetBrands.map(b => 
    `"${b.canonical}" (variations: ${b.allVariations.slice(0, 5).join(', ')}${b.allVariations.length > 5 ? '...' : ''})`
  ).join('\n');

  const prompt = `Analyse ce texte et identifie PRÉCISÉMENT quelles marques sont mentionnées.

TEXTE À ANALYSER:
"${text.substring(0, 2000)}${text.length > 2000 ? '...' : ''}"

MARQUES À DÉTECTER:
${brandsList}

INSTRUCTIONS:
1. Cherche UNIQUEMENT les marques listées ci-dessus
2. Identifie toutes les variations possibles (avec/sans accents, différentes casses, noms alternatifs, etc.)
3. Ignore les mentions génériques comme "marque", "fabricant", "entreprise", etc.
4. Sois TRÈS précis - ne compte que les mentions explicites de noms de marques
5. Pour chaque marque trouvée, indique la variation exacte trouvée et le contexte

IMPORTANT:
- Une marque est mentionnée si son nom apparaît clairement dans le texte
- Ne compte pas les références indirectes ou les termes génériques
- Sois précis mais pas trop strict - capture les vraies mentions de marques
- Les noms alternatifs (comme "LV" pour Louis Vuitton) comptent comme des mentions valides`;

  try {
    const { object } = await generateObject({
      model,
      schema: BrandExtractionSchema,
      prompt,
      temperature: 0.1,
    });

    console.log(`[BrandDetection] ✅ Extraction terminée: ${object.mentionedBrands.length} mentions trouvées`);
    return {
      mentionedBrands: object.mentionedBrands,
      totalBrandsFound: object.analysis.totalBrandsFound,
      confidence: object.analysis.confidence
    };
  } catch (error) {
    console.error('[BrandDetection] ❌ Erreur lors de l\'extraction:', error);
    return {
      mentionedBrands: [],
      totalBrandsFound: 0,
      confidence: 0
    };
  }
}

/**
 * Étape 4: Extrait les marques des textes LLM avec OpenAI (version originale)
 */
export async function extractBrandsFromText(
  text: string,
  targetBrands: CleanedBrand[],
  provider: string
): Promise<BrandExtractionResult> {
  console.log(`[BrandDetection] 🔍 Extraction des marques du texte ${provider} (${text.length} chars)`);
  console.log(`[BrandDetection] 📝 Aperçu du texte: "${text.substring(0, 300)}..."`);
  console.log(`[BrandDetection] 🎯 Marques à chercher: ${targetBrands.map(b => b.cleaned).join(', ')}`);
  
  const model = getProviderModel('openai', 'gpt-4o-mini');
  if (!model) {
    throw new Error('OpenAI model not available for brand extraction');
  }

  // Prépare la liste des marques à chercher
  const brandsList = targetBrands.map(b => 
    `"${b.cleaned}" (variations: ${b.variations.slice(0, 3).join(', ')}${b.variations.length > 3 ? '...' : ''})`
  ).join('\n');

  const prompt = `Analyse ce texte et identifie PRÉCISÉMENT quelles marques sont mentionnées.

TEXTE À ANALYSER:
"${text.substring(0, 2000)}${text.length > 2000 ? '...' : ''}"

MARQUES À DÉTECTER:
${brandsList}

INSTRUCTIONS:
1. Cherche UNIQUEMENT les marques listées ci-dessus
2. Identifie toutes les variations possibles (avec/sans accents, différentes casses, etc.)
3. Ignore les mentions génériques comme "marque", "fabricant", "entreprise", etc.
4. Sois TRÈS précis - ne compte que les mentions explicites de noms de marques
5. Pour chaque marque trouvée, indique la variation exacte trouvée et le contexte

IMPORTANT:
- Une marque est mentionnée si son nom apparaît clairement dans le texte
- Ne compte pas les références indirectes ou les termes génériques
- Sois précis mais pas trop strict - capture les vraies mentions de marques`;

  try {
    // Track API call for brand extraction
    const callId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'analysis',
      success: true,
      metadata: { 
        step: 'brand_extraction',
        provider: provider,
        textLength: text.length,
        brandsCount: targetBrands.length
      }
    });

    const startTime = Date.now();
    const { object, usage } = await generateObject({
      model,
      schema: BrandExtractionSchema,
      prompt,
      temperature: 0.1,
    });
    const duration = Date.now() - startTime;

    // Extract tokens from usage
    const tokens = extractTokensFromUsage(usage);
    
    // Update API call with actual usage
    apiUsageTracker.updateCall(callId, {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cost: estimateCost('openai', 'gpt-4o-mini', tokens.inputTokens, tokens.outputTokens),
      duration
    });

    console.log(`[BrandDetection] 📊 Extraction terminée: ${object.mentionedBrands.length} marques trouvées`);
    object.mentionedBrands.forEach(mention => {
      console.log(`  - ${mention.brand} (${mention.matchedVariation}) - confiance: ${mention.confidence}`);
    });

    // Si l'IA n'a rien trouvé, utiliser le fallback pour double-vérification
    if (object.mentionedBrands.length === 0) {
      console.log(`[BrandDetection] ⚠️ Aucune marque trouvée par l'IA, essai du fallback regex...`);
      const fallbackResult = fallbackBrandExtraction(text, targetBrands);
      if (fallbackResult.mentionedBrands.length > 0) {
        console.log(`[BrandDetection] ✅ Fallback a trouvé ${fallbackResult.mentionedBrands.length} marques`);
        return fallbackResult;
      }
    }

    return {
      mentionedBrands: object.mentionedBrands,
      totalBrandsFound: object.analysis.totalBrandsFound,
      confidence: object.analysis.confidence,
    };
  } catch (error) {
    console.error('[BrandDetection] ❌ Erreur lors de l\'extraction:', error);
    // Fallback: détection basique par regex
    return fallbackBrandExtraction(text, targetBrands);
  }
}

/**
 * Fallback: détection basique par regex si l'IA échoue
 */
function fallbackBrandExtraction(text: string, targetBrands: CleanedBrand[]): BrandExtractionResult {
  console.log('[BrandDetection] 🔄 Utilisation du fallback regex');
  
  const mentionedBrands: BrandMention[] = [];
  const textLower = text.toLowerCase();
  
  targetBrands.forEach(brand => {
    for (const variation of brand.variations) {
      const regex = new RegExp(`\\b${escapeRegExp(variation)}\\b`, 'gi');
      const matches = text.match(regex);
      
      if (matches && matches.length > 0) {
        mentionedBrands.push({
          brand: brand.cleaned,
          matchedVariation: variation,
          confidence: 0.8, // Confiance plus faible pour le fallback
        });
        break; // Une seule mention par marque
      }
    }
  });
  
  return {
    mentionedBrands,
    totalBrandsFound: mentionedBrands.length,
    confidence: 0.7, // Confiance globale plus faible
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Étape 5: Calcule les pourcentages par provider basés sur plusieurs réponses
 */
export function calculateBrandVisibilityByProvider(
  brandExtractions: Map<string, BrandExtractionResult[]>, // provider -> array of extraction results
  targetBrand: string,
  competitors: string[]
): Map<string, Map<string, { mentioned: boolean; confidence: number; mentionCount: number; totalResponses: number; percentage: number }>> {
  console.log(`[BrandDetection] 📊 Calcul des détections par provider (nouvelle logique)`);
  
  const results = new Map(); // provider -> brand -> detailed detection
  const allBrands = [targetBrand, ...competitors];

  // Normalisation robuste pour comparer les noms de marques avec et sans accents/variantes
  const normalize = (value: string) => {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  };
  const isSameBrand = (a: string, b: string) => {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    // Tolérer les variantes courtes/longues (ex: "moustache" vs "moustache bikes")
    return na.includes(nb) || nb.includes(na);
  };
  
  brandExtractions.forEach((extractions, provider) => {
    const providerResults = new Map();
    const totalResponses = extractions.length;
    
    console.log(`[BrandDetection] 🔍 Analyse ${provider}: ${totalResponses} réponses`);
    
    allBrands.forEach(brand => {
      let mentionCount = 0;
      let totalConfidence = 0;
      
      // Compter dans combien de réponses cette marque apparaît
      extractions.forEach((extraction, responseIndex) => {
        const mention = extraction.mentionedBrands.find(m => isSameBrand(m.brand, brand));
        if (mention) {
          mentionCount++;
          totalConfidence += mention.confidence;
          console.log(`    ✅ ${brand} trouvé dans réponse ${responseIndex + 1}/${totalResponses} (confiance: ${mention.confidence.toFixed(2)})`);
        }
      });
      
      const mentioned = mentionCount > 0;
      const averageConfidence = mentionCount > 0 ? totalConfidence / mentionCount : 0;
      const percentage = totalResponses > 0 ? (mentionCount / totalResponses) * 100 : 0;
      
      providerResults.set(brand, { 
        mentioned, 
        confidence: averageConfidence,
        mentionCount,
        totalResponses,
        percentage: Math.round(percentage * 10) / 10
      });
      
      console.log(`  📊 ${brand} @ ${provider}: ${mentionCount}/${totalResponses} = ${percentage.toFixed(1)}%`);
    });
    
    results.set(provider, providerResults);
  });
  
  return results;
}

/**
 * Exemple d'utilisation du nouveau système de détection avec noms alternatifs
 */
export async function exampleUsage() {
  const rawBrands = [
    "Patek Philippe SA",
    "Louis Vuitton International",
    "Christian Dior Corporation",
    "Mercedes-Benz AG",
    "Harley-Davidson Inc",
    "McDonald's Corporation"
  ];
  
  const text = `
    J'ai vu une belle montre Patek dans la vitrine. 
    Ma femme porte un sac LV et des chaussures Dior.
    J'ai conduit ma Mercedes hier et mon frère a une Harley.
    On a mangé chez McDo ce midi.
  `;
  
  const result = await detectBrandsWithAlternatives(
    rawBrands,
    text,
    "openai",
    "fr"
  );
  
  console.log("Résultat de détection:", result);
  return result;
}
