import { z } from 'zod';
import { generateObject } from 'ai';
import { getConfiguredProviders, getProviderModel } from '@/lib/provider-config';
import type { CompanyProfile } from '@/lib/competitor-pipeline/company-profiler';

export interface AISearchCompetitor {
  name: string;
  domain: string;
  url: string;
  snippet: string;
  confidence: number;
  source: 'ai-web-search';
}

// Schema for AI web search results
const AICompetitorSearchSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().describe('Exact company/brand name'),
    domain: z.string().describe('Website domain (e.g., ubs.ch, apple.com)'),
    description: z.string().describe('Brief description of why this is a relevant competitor'),
    marketPresence: z.enum(['local', 'national', 'international']).describe('Geographic market presence'),
    competitivenessScore: z.number().min(0).max(1).describe('How directly competitive (0-1)')
  })),
  searchStrategy: z.string().describe('Strategy used to find these competitors'),
  marketContext: z.string().describe('Geographic and market context analysis'),
  confidence: z.number().min(0).max(1).describe('Overall confidence in results')
});

/**
 * Use AI with web search capabilities to find competitors directly
 * This bypasses the Google API + Firecrawl + AI pipeline
 */
export async function findCompetitorsWithAIWebSearch(
  profile: CompanyProfile,
  maxResults: number = 10,
  useWebSearch: boolean = true,
  companyName?: string
): Promise<AISearchCompetitor[]> {
  try {
    console.log('🤖 [AIWebSearch] Starting direct AI competitor search...');
    console.log(`🎯 [AIWebSearch] Target: ${maxResults} competitors for ${profile.businessType}`);
    
    // Get available AI providers that support web search
    const providers = getConfiguredProviders();
    const webSearchProvider = findWebSearchCapableProvider(providers);
    
    if (!webSearchProvider) {
      throw new Error('No AI provider with web search capabilities available');
    }
    
    console.log(`🔍 [AIWebSearch] Using provider: ${webSearchProvider.name} ${useWebSearch ? 'with web search' : 'without web search'}`);
    
    const model = getProviderModel(
      webSearchProvider.id, 
      undefined, // Use default model for the provider
      { 
        useWebSearch: useWebSearch && webSearchProvider.capabilities?.webSearch 
      }
    );
    
    if (!model) {
      throw new Error(`Failed to get model for provider ${webSearchProvider.id}`);
    }
    
    // Generate geographically-aware search prompt with company name
    const searchPrompt = generateSearchPrompt(profile, maxResults, companyName);
    console.log(`📝 [AIWebSearch] Generated search prompt for ${getGeographicScope(profile, companyName)} market`);
    
    const result = await generateObject({
      model,
      schema: AICompetitorSearchSchema,
      prompt: searchPrompt,
      temperature: 0.2
    });
    
    console.log(`🧠 [AIWebSearch] Search strategy: ${result.object.searchStrategy}`);
    console.log(`🌍 [AIWebSearch] Market context: ${result.object.marketContext}`);
    console.log(`📊 [AIWebSearch] Overall confidence: ${(result.object.confidence * 100).toFixed(1)}%`);
    
    // Convert to our standard format
    const competitors: AISearchCompetitor[] = result.object.competitors.map(comp => ({
      name: comp.name,
      domain: comp.domain,
      url: comp.domain.startsWith('http') ? comp.domain : `https://${comp.domain}`,
      snippet: comp.description,
      confidence: comp.competitivenessScore,
      source: 'ai-web-search'
    }));
    
    // Log results
    console.log('\n📋 [AIWebSearch] COMPETITORS FOUND:');
    console.log('=' .repeat(80));
    competitors.forEach((comp, index) => {
      console.log(`${index + 1}. ${comp.name} (${comp.domain})`);
      console.log(`   📝 ${comp.snippet}`);
      console.log(`   🎯 Confidence: ${(comp.confidence * 100).toFixed(1)}%`);
      console.log('');
    });
    console.log('=' .repeat(80));
    
    console.log(`✅ [AIWebSearch] Found ${competitors.length} competitors in ${Date.now() - Date.now()}ms`);
    
    return competitors;
    
  } catch (error) {
    console.error('❌ [AIWebSearch] Error in AI web search:', error);
    
    // Fallback to knowledge-based search without web access
    if (useWebSearch) {
      console.log('🔄 [AIWebSearch] Retrying without web search...');
      return findCompetitorsWithAIWebSearch(profile, maxResults, false, companyName);
    }
    
    return [];
  }
}

/**
 * Find an AI provider that supports web search
 */
function findWebSearchCapableProvider(providers: any[]) {
  // Priority order: Google (best web search), OpenAI, Anthropic
  const priorities = ['google', 'openai', 'anthropic'];
  
  for (const providerId of priorities) {
    const provider = providers.find(p => p.id === providerId);
    if (provider && provider.isConfigured()) {
      console.log(`🔍 [AIWebSearch] Found provider: ${provider.name} (web search: ${provider.capabilities?.webSearch ? 'Yes' : 'No'})`);
      return provider;
    }
  }
  
  // Fallback to any available provider
  return providers.find(p => p.isConfigured()) || null;
}

/**
 * Generate a geographically-aware search prompt
 */
function generateSearchPrompt(profile: CompanyProfile, maxResults: number, companyName?: string): string {
  const primaryMarket = profile.primaryMarkets?.[0] || '';
  const scope = getGeographicScope(profile, companyName);
  const isLocal = scope === 'local';
  
  // Enhanced geographic detection
  const companyGeo = analyzeCompanyGeography(profile, companyName);
  const detectedCountry = companyGeo.country;
  const detectedCity = companyGeo.city;
  
  const isSwiss = detectedCountry === 'Switzerland' || primaryMarket.includes('Switzerland') || primaryMarket.includes('Suisse');
  const isFrench = detectedCountry === 'France' || primaryMarket.includes('France');
  const isGerman = detectedCountry === 'Germany' || primaryMarket.includes('Germany');
  const isUK = detectedCountry === 'UK' || primaryMarket.includes('UK');
  
  let promptLanguage = 'English';
  let marketFocus = 'international';
  let exampleQuery = '';
  let countryCode = '';
  
  if (isFrench) {
    promptLanguage = 'French';
    marketFocus = isLocal && detectedCity ? `French local (${detectedCity})` : 'French national';
    countryCode = 'France';
    exampleQuery = detectedCity ? 
      `cabinets d'avocats à ${detectedCity}` : 
      'meilleures entreprises juridiques en France';
  } else if (isSwiss) {
    promptLanguage = 'French and German';
    marketFocus = isLocal ? 'Swiss regional/cantonal' : 'Swiss national';
    countryCode = 'Switzerland';
    exampleQuery = isLocal ? 
      'banques cantonales en Suisse' : 
      'meilleures banques suisses pour entreprises';
  } else if (isGerman) {
    promptLanguage = 'German';
    marketFocus = 'German national';
    countryCode = 'Germany';
    exampleQuery = 'beste deutsche Unternehmen';
  } else if (isUK) {
    promptLanguage = 'English';
    marketFocus = 'UK national';
    countryCode = 'UK';
    exampleQuery = 'top UK companies';
  } else {
    exampleQuery = `top ${profile.industry} companies globally`;
    countryCode = 'International';
  }
  
  return `You are a market research expert. Search the web and find ${maxResults} REAL competitor companies for this business profile:

COMPANY PROFILE:
- Business Type: ${profile.businessType}
- Industry: ${profile.industry}
- Market Segment: ${profile.marketSegment}
- Primary Markets: ${profile.primaryMarkets?.join(', ') || 'Unknown'}
- Target Customers: ${profile.targetCustomers}
- Products/Services: ${profile.primaryProducts?.join(', ') || 'Unknown'}

GEOGRAPHIC FOCUS: ${scope.toUpperCase()} (${marketFocus})
DETECTED COUNTRY: ${countryCode}
${detectedCity ? `DETECTED CITY: ${detectedCity}` : ''}
SEARCH LANGUAGE: ${promptLanguage}
EXAMPLE SEARCH: "${exampleQuery}"

SEARCH INSTRUCTIONS:
${isFrench ? `
🇫🇷 FRENCH FOCUS${detectedCity ? ` (${detectedCity})` : ''}:
- Find competitors operating in FRANCE${detectedCity ? `, especially in ${detectedCity}` : ''}
- For law firms: Focus on French cabinets d'avocats, barreaux, études juridiques
- Include major French legal firms and regional practices
- Example: For SCM Avocats → Clifford Chance Paris, Freshfields Paris, Gide Loyrette Nouel
- EXCLUDE: Swiss, German, or other non-French competitors
` : isSwiss ? `
🇨🇭 SWISS FOCUS${detectedCity ? ` (${detectedCity})` : ''}:
- Find competitors operating in SWITZERLAND${detectedCity ? `, especially in ${detectedCity}` : ''}
- For banks: Focus on cantonal banks, Swiss national banks
- Include major Swiss companies and subsidiaries with Swiss presence
- Example: UBS, PostFinance, Raiffeisen, Credit Suisse (if relevant)
- EXCLUDE: International banks without Swiss operations
` : isGerman ? `
🇩🇪 GERMAN FOCUS:
- Find competitors operating in GERMANY
- Include major German companies and international companies with German presence
- EXCLUDE: Non-German competitors
` : isUK ? `
🇬🇧 UK FOCUS:
- Find competitors operating in the UNITED KINGDOM
- Include major UK companies and international companies with UK presence
- EXCLUDE: Non-UK competitors
` : `
🌍 INTERNATIONAL FOCUS:
- Find global competitors operating internationally
- Include market leaders and major international brands
- Example: For Apple → Samsung, Google, Microsoft, Xiaomi
`}

SEARCH REQUIREMENTS:
1. Search the web for current, accurate information
2. Find REAL companies with actual websites
3. Verify companies operate in the same geographic market
4. Prioritize direct competitors over indirect ones
5. Include both established players and emerging competitors
6. Ensure domain names are accurate and current

OUTPUT REQUIREMENTS:
- Provide EXACT company names (not generic terms)
- Include accurate website domains
- Brief explanation of competitive relationship
- Rate competitiveness score (direct vs indirect competition)
- Ensure geographic market alignment

Focus on finding companies that a customer would actually consider as alternatives when choosing between options in this market.`;
}

/**
 * Determine geographic scope of company with intelligent analysis
 */
function getGeographicScope(profile: CompanyProfile, companyName?: string): 'local' | 'national' | 'international' {
  const primaryMarket = profile.primaryMarkets?.[0] || '';
  const businessType = (profile.businessType || '').toLowerCase();
  const industry = (profile.industry || '').toLowerCase();
  
  // Analyze company name for geographic indicators
  const companyIdentifiers = analyzeCompanyGeography(profile, companyName);
  
  console.log(`🔍 [GeographicAnalysis] Company: ${profile.businessType}`);
  console.log(`🔍 [GeographicAnalysis] Primary market: "${primaryMarket}"`);
  console.log(`🔍 [GeographicAnalysis] Detected country: ${companyIdentifiers.country}`);
  console.log(`🔍 [GeographicAnalysis] Detected city: ${companyIdentifiers.city}`);
  
  // Priority 1: Explicit country detection from company analysis
  if (companyIdentifiers.country) {
    if (companyIdentifiers.city) {
      console.log(`🎯 [GeographicScope] LOCAL detected: ${companyIdentifiers.city}, ${companyIdentifiers.country}`);
      return 'local';
    } else {
      console.log(`🎯 [GeographicScope] NATIONAL detected: ${companyIdentifiers.country}`);
      return 'national';
    }
  }
  
  // Priority 2: Primary market analysis
  // Local indicators
  if (primaryMarket.includes('Geneva') || primaryMarket.includes('Genève') ||
      primaryMarket.includes('Zurich') || primaryMarket.includes('Basel') ||
      primaryMarket.includes('Paris') || primaryMarket.includes('Lyon') ||
      primaryMarket.includes('canton') || primaryMarket.includes('ville') ||
      primaryMarket.length < 20) {
    console.log(`🎯 [GeographicScope] LOCAL detected from market: ${primaryMarket}`);
    return 'local';
  }
  
  // National indicators
  if (primaryMarket.includes('Switzerland') || primaryMarket.includes('Suisse') ||
      primaryMarket.includes('France') || primaryMarket.includes('Germany') ||
      primaryMarket.includes('UK') || primaryMarket.includes('Spain') ||
      primaryMarket.includes('Italy')) {
    console.log(`🎯 [GeographicScope] NATIONAL detected from market: ${primaryMarket}`);
    return 'national';
  }
  
  // Priority 3: Business type analysis for local services
  if (businessType.includes('avocat') || businessType.includes('lawyer') ||
      businessType.includes('notaire') || businessType.includes('cabinet') ||
      businessType.includes('étude') || businessType.includes('law firm')) {
    console.log(`🎯 [GeographicScope] LOCAL assumed for legal services`);
    return 'local';
  }
  
  // International by default
  console.log(`🎯 [GeographicScope] INTERNATIONAL (default)`);
  return 'international';
}

/**
 * Analyze company name and business type for geographic indicators
 */
function analyzeCompanyGeography(profile: CompanyProfile, companyName?: string): { country?: string; city?: string; language?: string } {
  const businessType = (profile.businessType || '').toLowerCase();
  const industry = (profile.industry || '').toLowerCase();
  
  // Use provided company name or fallback to products
  const actualCompanyName = companyName || (profile.primaryProducts?.[0] || '');
  const allText = `${businessType} ${industry} ${actualCompanyName}`.toLowerCase();
  
  console.log(`🔍 [CompanyAnalysis] Full text analyzed: "${allText}"`);
  console.log(`🔍 [CompanyAnalysis] Business type: "${businessType}"`);
  console.log(`🔍 [CompanyAnalysis] Industry: "${industry}"`);
  console.log(`🔍 [CompanyAnalysis] Company name: "${actualCompanyName}"`);
  
  // French indicators
  if (allText.includes('avocat') || allText.includes('scm') || 
      allText.includes('société civile') || allText.includes('paris') ||
      allText.includes('lyon') || allText.includes('marseille') ||
      allText.includes('toulouse') || allText.includes('cabinet d\'avocat')) {
    
    // Check for specific French cities
    let city = undefined;
    if (allText.includes('paris')) city = 'Paris';
    else if (allText.includes('lyon')) city = 'Lyon';
    else if (allText.includes('marseille')) city = 'Marseille';
    else if (allText.includes('toulouse')) city = 'Toulouse';
    
    return { country: 'France', city, language: 'French' };
  }
  
  // Swiss indicators
  if (allText.includes('banque cantonale') || allText.includes('geneva') ||
      allText.includes('genève') || allText.includes('zurich') ||
      allText.includes('basel') || allText.includes('suisse') ||
      allText.includes('switzerland') || allText.includes('canton')) {
    
    let city = undefined;
    if (allText.includes('geneva') || allText.includes('genève')) city = 'Geneva';
    else if (allText.includes('zurich')) city = 'Zurich';
    else if (allText.includes('basel')) city = 'Basel';
    
    return { country: 'Switzerland', city, language: 'French/German' };
  }
  
  // German indicators
  if (allText.includes('gmbh') || allText.includes('ag') ||
      allText.includes('berlin') || allText.includes('munich') ||
      allText.includes('hamburg') || allText.includes('deutschland')) {
    return { country: 'Germany', language: 'German' };
  }
  
  // UK indicators
  if (allText.includes('ltd') || allText.includes('london') ||
      allText.includes('manchester') || allText.includes('birmingham')) {
    return { country: 'UK', language: 'English' };
  }
  
  return {};
}

// Removed comparison with traditional pipeline as the old system was deprecated
