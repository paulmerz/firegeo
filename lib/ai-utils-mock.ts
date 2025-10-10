import { AIResponse } from './types';

// Mock data for AI responses with rich brand variations
const MOCK_AI_RESPONSES: AIResponse[] = [
  {
    provider: 'OpenAI',
    prompt: '',
    response: "Rolex est une marque emblématique de l'horlogerie de luxe suisse. Fondée en 1905, ROLEX a révolutionné l'industrie avec ses montres robustes et précises. Les montres rolex sont particulièrement reconnues pour leurs modèles Submariner et Daytona. Rolex SA maintient sa position de leader grâce à son savoir-faire artisanal exceptionnel. Audemars Piguet (AP) et Patek Philippe sont aussi des références dans l'horlogerie de luxe.",
    rankings: [],
    competitors: ['Audemars Piguet', 'Patek Philippe', 'Omega'],
    brandMentioned: true,
    brandPosition: 1,
    sentiment: 'positive',
    confidence: 0.95,
    timestamp: new Date(),
    detectionDetails: {
      brandMatches: [
        {
          text: 'Rolex',
          index: 0,
          confidence: 0.95
        },
        {
          text: 'ROLEX',
          index: 50,
          confidence: 0.95
        },
        {
          text: 'rolex',
          index: 100,
          confidence: 0.9
        },
        {
          text: 'Rolex SA',
          index: 150,
          confidence: 0.9
        }
      ],
      competitorMatches: new Map([
        ['Audemars Piguet', [
          { text: 'Audemars Piguet', index: 200, confidence: 0.8 },
          { text: 'AP', index: 220, confidence: 0.7 }
        ]],
        ['Patek Philippe', [
          { text: 'Patek Philippe', index: 250, confidence: 0.8 }
        ]]
      ])
    }
  },
  {
    provider: 'Anthropic',
    prompt: '',
    response: "ROLEX continue d'innover dans l'horlogerie de luxe avec des technologies de pointe. La marque suisse maintient sa position de leader grâce à ses montres de précision. Les collectionneurs du monde entier recherchent les modèles Rolex pour leur qualité. rolex est synonyme de prestige et d'excellence. Vacheron Constantin et Patek Philippe (Patek) sont aussi des marques de référence.",
    rankings: [],
    competitors: ['Vacheron Constantin', 'Patek Philippe'],
    brandMentioned: true,
    brandPosition: 1,
    sentiment: 'positive',
    confidence: 0.92,
    timestamp: new Date(),
    detectionDetails: {
      brandMatches: [
        {
          text: 'ROLEX',
          index: 0,
          confidence: 0.92
        },
        {
          text: 'Rolex',
          index: 100,
          confidence: 0.92
        },
        {
          text: 'rolex',
          index: 150,
          confidence: 0.9
        }
      ],
      competitorMatches: new Map([
        ['Vacheron Constantin', [
          { text: 'Vacheron Constantin', index: 200, confidence: 0.8 }
        ]],
        ['Patek Philippe', [
          { text: 'Patek Philippe', index: 250, confidence: 0.8 },
          { text: 'Patek', index: 270, confidence: 0.7 }
        ]]
      ])
    }
  },
  {
    provider: 'Google',
    prompt: '',
    response: "Les montres de luxe représentent un investissement durable. Rolex propose des modèles intemporels comme la Submariner. ROLEX allie tradition et innovation pour créer des montres d'exception. Les collectionneurs apprécient la qualité des montres rolex. Audemars Piguet (AP) et Omega sont aussi des marques prestigieuses dans l'horlogerie.",
    rankings: [],
    competitors: ['Audemars Piguet', 'Omega'],
    brandMentioned: true,
    brandPosition: 1,
    sentiment: 'positive',
    confidence: 0.90,
    timestamp: new Date(),
    detectionDetails: {
      brandMatches: [
        {
          text: 'Rolex',
          index: 50,
          confidence: 0.90
        },
        {
          text: 'ROLEX',
          index: 100,
          confidence: 0.90
        },
        {
          text: 'rolex',
          index: 150,
          confidence: 0.85
        }
      ],
      competitorMatches: new Map([
        ['Audemars Piguet', [
          { text: 'Audemars Piguet', index: 200, confidence: 0.8 },
          { text: 'AP', index: 220, confidence: 0.7 }
        ]],
        ['Omega', [
          { text: 'Omega', index: 250, confidence: 0.8 }
        ]]
      ])
    }
  },
  {
    provider: 'Perplexity',
    prompt: '',
    response: "Rolex domine le marché des montres de luxe grâce à sa stratégie de distribution exclusive. ROLEX a su créer une demande constante pour ses modèles. Les montres rolex sont des objets de collection recherchés. Rolex SA continue d'innover dans l'horlogerie de précision. Patek Philippe et Vacheron Constantin (VC) sont aussi des marques d'exception.",
    rankings: [],
    competitors: ['Patek Philippe', 'Vacheron Constantin'],
    brandMentioned: true,
    brandPosition: 1,
    sentiment: 'positive',
    confidence: 0.93,
    timestamp: new Date(),
    detectionDetails: {
      brandMatches: [
        {
          text: 'Rolex',
          index: 0,
          confidence: 0.93
        },
        {
          text: 'ROLEX',
          index: 50,
          confidence: 0.93
        },
        {
          text: 'rolex',
          index: 100,
          confidence: 0.88
        },
        {
          text: 'Rolex SA',
          index: 150,
          confidence: 0.9
        }
      ],
      competitorMatches: new Map([
        ['Patek Philippe', [
          { text: 'Patek Philippe', index: 200, confidence: 0.8 }
        ]],
        ['Vacheron Constantin', [
          { text: 'Vacheron Constantin', index: 250, confidence: 0.8 },
          { text: 'VC', index: 270, confidence: 0.7 }
        ]]
      ])
    }
  }
];

let responseIndex = 0;

/**
 * Calcule le nombre total de highlights attendus dans les mocks
 * @returns Objet avec le nombre total et le détail par marque
 */
export function getExpectedHighlightCounts(): {
  total: number;
  byBrand: Record<string, number>;
  byProvider: Record<string, number>;
} {
  const counts = {
    total: 0,
    byBrand: {} as Record<string, number>,
    byProvider: {} as Record<string, number>
  };

  MOCK_AI_RESPONSES.forEach(response => {
    // Compter les mentions de la marque cible
    const brandMatches = response.detectionDetails?.brandMatches?.length || 0;
    counts.total += brandMatches;
    counts.byProvider[response.provider] = brandMatches;
    
    // Compter les mentions des concurrents
    if (response.detectionDetails?.competitorMatches) {
      const competitorMatchesMap = response.detectionDetails.competitorMatches;
      if (competitorMatchesMap instanceof Map) {
        competitorMatchesMap.forEach((matches, competitor) => {
          const count = matches.length;
          counts.total += count;
          counts.byBrand[competitor] = (counts.byBrand[competitor] || 0) + count;
        });
      }
    }
  });

  return counts;
}

/**
 * Mock version of analyzePromptWithProvider
 */
export async function mockAnalyzePromptWithProvider(
  prompt: string,
  provider: string,
  brandName: string,
  competitors: string[],
  locale?: string
): Promise<AIResponse> {
  console.log(`[MOCK] analyzePromptWithProvider called for provider: ${provider}, prompt: ${prompt.substring(0, 50)}...`);
  console.log(`[MOCK] shouldUseMockMode():`, shouldUseMockMode());
  
  // Find a response for this provider or use the next available one
  let mockResponse = MOCK_AI_RESPONSES.find(r => r.provider === provider);
  
  if (!mockResponse) {
    // If no specific response for this provider, use the next one in rotation
    mockResponse = MOCK_AI_RESPONSES[responseIndex % MOCK_AI_RESPONSES.length];
    responseIndex++;
  }

  // Log du nombre de highlights dans cette réponse mock
  const brandMatchCount = mockResponse.detectionDetails?.brandMatches?.length || 0;
  let competitorMatchCount = 0;
  
  if (mockResponse.detectionDetails?.competitorMatches) {
    const competitorMatches = mockResponse.detectionDetails.competitorMatches;
    if (competitorMatches instanceof Map) {
      for (const matches of competitorMatches.values()) {
        competitorMatchCount += Array.isArray(matches) ? matches.length : 0;
      }
    }
  }
  
  console.log(`[MOCK] Response contains ${brandMatchCount} brand highlights + ${competitorMatchCount} competitor highlights`);
  
  if (brandMatchCount > 0) {
    console.log(`[MOCK] Brand variations detected:`, mockResponse.detectionDetails?.brandMatches?.map(m => m.text).join(', '));
  }
  
  if (competitorMatchCount > 0) {
    const competitorDetails: string[] = [];
    if (mockResponse.detectionDetails?.competitorMatches) {
      const competitorMatches = mockResponse.detectionDetails.competitorMatches;
      if (competitorMatches instanceof Map) {
        for (const [name, matches] of competitorMatches.entries()) {
          const count = Array.isArray(matches) ? matches.length : 0;
          competitorDetails.push(`${name}: ${count} matches`);
        }
      }
    }
    console.log(`[MOCK] Competitor highlights: ${competitorDetails.join(', ')}`);
  }

  // Update the response with the actual prompt and brand name
  return {
    ...mockResponse,
    prompt,
    // Ensure brandMentioned is true if the brand name is in the response
    brandMentioned: mockResponse.response.toLowerCase().includes(brandName.toLowerCase()),
    // Filter competitors to only include the ones we're tracking
    competitors: mockResponse.competitors.filter(c => competitors.includes(c))
  };
}

/**
 * Mock version of analyzePromptWithProviderEnhanced
 */
export async function mockAnalyzePromptWithProviderEnhanced(
  prompt: string,
  provider: string,
  brandName: string,
  competitors: string[],
  useWebSearch: boolean = true,
  locale?: string,
  brandVariations?: Record<string, any>
): Promise<AIResponse> {
  // Use the same logic as the regular mock
  return mockAnalyzePromptWithProvider(prompt, provider, brandName, competitors, locale);
}

/**
 * Check if we should use mock mode
 */
export function shouldUseMockMode(): boolean {
  const result = process.env.NODE_ENV === 'test' || process.env.USE_MOCK_MODE === 'true' || process.env.MOCK_AI_FUNCTIONS === 'true';
  console.log(`[MOCK] shouldUseMockMode() = ${result} (NODE_ENV=${process.env.NODE_ENV}, MOCK_AI_FUNCTIONS=${process.env.MOCK_AI_FUNCTIONS})`);
  console.log(`[MOCK] All env vars:`, {
    NODE_ENV: process.env.NODE_ENV,
    USE_MOCK_MODE: process.env.USE_MOCK_MODE,
    MOCK_AI_FUNCTIONS: process.env.MOCK_AI_FUNCTIONS
  });
  return result;
}
