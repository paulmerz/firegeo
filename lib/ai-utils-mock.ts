import { AIResponse } from './types';

// Mock data for raw LLM responses (étape 2 uniquement)
// 16 mocks différents : 4 catégories de prompts x 4 providers
const MOCK_RAW_RESPONSES: Array<{ provider: string; category: string; response: string }> = [
  // RANKING prompts
  {
    provider: 'OpenAI',
    category: 'ranking',
    response: "Côté diversité: Caterham Cars inspire les amateurs (Caterham Cars, caterham), sans rapport avec Caterhlam School ni le fragment mal orthographié Cater]. Grand Seiko (Grand Seiko, GS) séduit, à ne pas confondre avec Seiko ou le mot isolé Grand. Yves Saint Laurent (Yves Saint Laurent, YSL, Saint-Laurent) se distingue dans le luxe, à ne pas confondre avec Laurent pris isolément."
  },
  {
    provider: 'Anthropic',
    category: 'ranking',
    response: "Classement des marques horlogères de prestige : ROLEX domine le marché avec une stratégie de distribution exclusive et des modèles intemporels. Patek Philippe (Patek) se distingue par ses complications exceptionnelles. Audemars Piguet (AP) révolutionne avec la Royal Oak. Vacheron Constantin (VC) allie tradition et innovation. A. Lange & Söhne excelle en précision allemande. Jaeger-LeCoultre maîtrise les complications. Blancpain préserve l'artisanat traditionnel. Breguet innove constamment. Omega explore l'espace. Cartier allie horlogerie et joaillerie."
  },
  {
    provider: 'Google',
    category: 'ranking',
    response: "Top 10 des marques de montres de luxe : 1. Rolex - Symbole de réussite et robustesse. 2. Patek Philippe - Investissement de collection pour Monsieur Piguet 3. Audemars Piguet - Design avant-gardiste. 4. Vacheron Constantin - Patrimoine horloger. 5. A. Lange & Söhne - Précision allemande. 6. Jaeger-LeCoultre - Maîtrise technique. 7. Blancpain - Tradition artisanale. 8. Breguet - Innovation perpétuelle. 9. Omega - Aventure et exploration. 10. Cartier - Élégance française."
  },
  {
    provider: 'Perplexity',
    category: 'ranking',
    response: "Focus sur trois maisons: Caterham Cars séduit (Caterham Cars, caterham) – à ne pas confondre avec Caterhlam School ni le fragment Cater]. Grand Seiko performe (Grand Seiko, GS) – ne pas confondre avec Seiko ni le mot Grand isolé. Yves Saint Laurent (Yves Saint Laurent, YSL, Saint-Laurent) brille dans la mode de luxe – distinct de Laurent seul."
  },

  // COMPARISON prompts
  {
    provider: 'OpenAI',
    category: 'comparison',
    response: "Audemars Piguet (Audemars Piguet, AP, Audemars) se démarque en design – à ne pas confondre avec le mot Piguet isolé. Stripe (Stripe, Stripe Payments) excelle dans les paiements – sans lien avec stripe pattern ni pinstripe. Zara (Zara, zara) est ultra-rapide sur la mode – distinct de Zoro."
  },
  {
    provider: 'Anthropic',
    category: 'comparison',
    response: "Analyse comparative des leaders horlogers : ROLEX se distingue par sa robustesse et sa reconnaissance universelle, mais reste conservateur techniquement. Patek Philippe (Patek) excelle en complications et valeur patrimoniale, mais reste très exclusif. Audemars Piguet (AP) révolutionne avec des designs iconiques, mais limite volontairement sa production. Vacheron Constantin (VC) allie parfaitement tradition et innovation, mais reste moins connue du grand public. A. Lange & Söhne excelle en précision technique, mais a une distribution restreinte. Points forts : Rolex = durabilité, Patek = complications, AP = design, VC = équilibre, Lange = précision."
  },
  {
    provider: 'Google',
    category: 'comparison',
    response: "Comparaison des marques horlogères de luxe : Rolex domine par sa robustesse et sa valeur de revente, mais reste traditionnel. Patek Philippe excelle en complications et investissement, mais très cher. Audemars Piguet (AP) séduit par son design révolutionnaire, mais production limitée. Vacheron Constantin allie tradition et modernité, mais moins accessible. A. Lange & Söhne excelle en précision, mais distribution restreinte. Avantages : Rolex = durabilité, Patek = complications, AP = innovation, VC = équilibre, Lange = précision allemande."
  },
  {
    provider: 'Perplexity',
    category: 'comparison',
    response: "Côté innovation design: Audemars Piguet (Audemars Piguet, AP, Audemars) – ne pas confondre avec Piguet seul. Paiements: Stripe (Stripe, Stripe Payments) – sans lien avec stripe pattern ou pinstripe. Fast-fashion: Zara (Zara, zara) – aucun rapport avec Zoro."
  },

  // ALTERNATIVES prompts
  {
    provider: 'OpenAI',
    category: 'alternatives',
    response: "The North Face (The North Face, North Face) pour l'outdoor – à ne pas confondre avec NF ni north-facing wall. Heineken N.V (Heineken, Heineken NV) pour l'ancrage marque – distinct de NV ou Heine isolés. Morgan Stanley (Morgan Stanley, Morgan Stanley & Co.) pour la solidité financière – à différencier de Morgan ou MS seuls."
  },
  {
    provider: 'Anthropic',
    category: 'alternatives',
    response: "Meilleures alternatives à ROLEX : Omega constitue une excellente option avec ses Speedmaster et Seamaster, combinant précision et héritage spatial. Tudor, filiale de Rolex, propose des montres robustes plus accessibles. Breitling excelle en chronographes professionnels. IWC allie tradition suisse et innovation. Panerai apporte un design italien distinctif. Grand Seiko rivalise en précision avec les Suisses. Zenith excelle en chronographes haute fréquence. Chaque alternative a sa spécificité : Omega = aventure, Tudor = accessibilité, Breitling = professionnels, IWC = innovation, Panerai = design, Grand Seiko = précision, Zenith = technique."
  },
  {
    provider: 'Google',
    category: 'alternatives',
    response: "Alternatives à Rolex : Omega propose des montres d'exception comme la Speedmaster et Seamaster, alliant précision et histoire. Tudor, filiale de Rolex, offre des montres robustes plus abordables. Breitling excelle en chronographes professionnels. IWC allie tradition et innovation. Panerai séduit par son design italien. Grand Seiko rivalise en précision. Zenith excelle en chronographes. Chaque marque apporte sa valeur : Omega = aventure, Tudor = accessibilité, Breitling = professionnels, IWC = innovation, Panerai = design, Grand Seiko = précision, Zenith = technique."
  },
  {
    provider: 'Perplexity',
    category: 'alternatives',
    response: "Orienté plein air avec The North Face (The North Face, North Face) – à ne pas confondre avec NF ou north-facing wall; portée mondiale avec Heineken N.V (Heineken, Heineken NV) – distinct de NV ou Heine; et crédibilité marché avec Morgan Stanley (Morgan Stanley, Morgan Stanley & Co.) – sans rapport avec Morgan ni MS pris seuls."
  },

  // RECOMMENDATIONS prompts
  {
    provider: 'OpenAI',
    category: 'recommendations',
    response: "Recommandation principale: pour une valeur sûre et reconnaissable internationalement, Rolex reste notre choix."
  },
  {
    provider: 'Anthropic',
    category: 'recommendations',
    response: "Recommandations horlogères personnalisées : Entreprises → Rolex Submariner ou GMT-Master pour robustesse et reconnaissance. Collectionneurs → Patek Philippe Calatrava ou Nautilus pour investissement exceptionnel. Innovation → Audemars Piguet Royal Oak ou Code 11.59 pour design et technique. Tradition → Vacheron Constantin Patrimony ou Overseas pour artisanat préservé. Précision → A. Lange & Söhne Lange 1 ou Zeitwerk pour excellence technique. Aventure → Omega Speedmaster ou Seamaster pour exploration. Élégance → Cartier Santos ou Tank pour horlogerie-joaillerie. Chaque recommandation s'adapte à un profil et usage spécifiques."
  },
  {
    provider: 'Google',
    category: 'recommendations',
    response: "Recommandations de montres de luxe : Entreprises → Rolex Submariner/GMT-Master pour robustesse. Collectionneurs → Patek Philippe Calatrava/Nautilus pour investissement. Innovation → Audemars Piguet Royal Oak/Code 11.59 pour design. Tradition → Vacheron Constantin Patrimony/Overseas pour artisanat. Précision → A. Lange & Söhne Lange 1/Zeitwerk pour technique. Aventure → Omega Speedmaster/Seamaster pour exploration. Élégance → Cartier Santos/Tank pour joaillerie. Chaque recommandation correspond à un profil spécifique."
  },
  {
    provider: 'Perplexity',
    category: 'recommendations',
    response: "Conseil final: si vous recherchez une icône durable et liquide à la revente, choisissez Rolex."
  }
];

let responseIndex = 0;

// Note: getExpectedHighlightCounts() removed - highlights are now generated dynamically by AI

/**
 * Get expected highlight count for E2E test validation
 * This is a manually counted value based on the mock responses above
 */
export function getExpectedHighlightCount(): number {
  return 62;
}

/**
 * Expected competitor (grey) highlights across all responses
 */
export function getExpectedCompetitorHighlightCount(): number {
  // 40 gris (bg-gray-200) selon la répartition du plan
  return 60;
}

/**
 * Expected target (orange) highlights across all responses
 */
export function getExpectedTargetHighlightCount(): number {
  // 4 orange (bg-orange-100) – 1 par prompt × 2 providers pour 2 prompts ?
  // Ici total planifié: 4 au total
  return 2;
}

/**
 * Detect prompt category based on content keywords
 */
function detectPromptCategory(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  // Check explicit test keywords first (highest priority, deterministic in E2E)
  if (promptLower.includes('keyword_comparison')) return 'comparison';
  if (promptLower.includes('keyword_alternatives')) return 'alternatives';
  if (promptLower.includes('keyword_recommendations')) return 'recommendations';
  if (promptLower.includes('keyword_ranking')) return 'ranking';    

  // Default to ranking if no clear category detected
  return 'ranking';
}

/**
 * Mock version of analyzePromptWithProvider
 */
export async function mockAnalyzePromptWithProvider(
  prompt: string,
  provider: string,
  // _brandName: string,
  // _competitors: string[],
  // _locale?: string
): Promise<AIResponse> {
  console.log(`[MOCK] analyzePromptWithProvider called for provider: ${provider}, prompt: ${prompt.substring(0, 50)}...`);
  // Mock mode is now controlled via request headers in the API route
  
  // Detect the prompt category
  const category = detectPromptCategory(prompt);
  console.log(`[MOCK] Detected category: ${category} for prompt: ${prompt.substring(0, 30)}...`);
  
  // Find a response for this provider and category combination
  let mockResponse = MOCK_RAW_RESPONSES.find(r => r.provider === provider && r.category === category);
  
  if (!mockResponse) {
    // If no specific response for this provider+category, find any response for this provider
    mockResponse = MOCK_RAW_RESPONSES.find(r => r.provider === provider);
    
    if (!mockResponse) {
      // If no response for this provider at all, use the next one in rotation
      mockResponse = MOCK_RAW_RESPONSES[responseIndex % MOCK_RAW_RESPONSES.length];
      responseIndex++;
    }
  }

  // Note: No detectionDetails provided - will be generated by real AI detection
  console.log(`[MOCK] Response provided for ${provider} (category: ${category}) - detectionDetails will be generated by real AI`);

  // Update the response with the actual prompt and provide minimal fields
  // Note: we do NOT mock analysis fields; they will be produced by real analysis later
  return {
    provider: mockResponse.provider,
    prompt,
    response: mockResponse.response,
    timestamp: new Date()
  };
}

/**
 * Mock version of analyzePromptWithProviderEnhanced
 */
export async function mockAnalyzePromptWithProviderEnhanced(
  prompt: string,
  provider: string,
  // _brandName: string,
  // _competitors: string[],
  // _useWebSearch: boolean = true,
  // _locale?: string,
  // brandVariations?: Record<string, BrandVariation>
): Promise<AIResponse> {
  // Use the same logic as the regular mock
  return mockAnalyzePromptWithProvider(prompt, provider);
}

/**
 * Get mocked raw LLM response for a specific provider
 */
export function getMockedRawResponse(provider: string, prompt: string): string {
  console.log(`[MOCK] getMockedRawResponse called for provider: ${provider}, prompt: ${prompt.substring(0, 50)}...`);
  
  // Detect the prompt category
  const category = detectPromptCategory(prompt);
  console.log(`[MOCK] Detected category: ${category} for prompt: ${prompt.substring(0, 30)}...`);
  
  // Find a response for this provider and category combination
  let mockResponse = MOCK_RAW_RESPONSES.find(r => r.provider === provider && r.category === category);
  
  if (!mockResponse) {
    // If no specific response for this provider+category, find any response for this provider
    mockResponse = MOCK_RAW_RESPONSES.find(r => r.provider === provider);
    
    if (!mockResponse) {
      // If no response for this provider at all, use the next one in rotation
      mockResponse = MOCK_RAW_RESPONSES[responseIndex % MOCK_RAW_RESPONSES.length];
      responseIndex++;
    }
  }

  console.log(`[MOCK] Returning raw response for ${provider} (category: ${category}): "${mockResponse.response.substring(0, 100)}..."`);
  return mockResponse.response;
}
