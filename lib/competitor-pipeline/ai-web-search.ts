import { z } from 'zod';
import { generateText, generateObject } from 'ai';
import { getConfiguredProviders, getProviderModel } from '@/lib/provider-config';
import { generateText as generateTextOpenAI } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { Company } from '@/lib/types';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from '@/lib/api-usage-tracker';

export interface AISearchCompetitor {
  name: string;
  domain: string;
  url: string;
  snippet: string;
  confidence: number;
  source: 'ai-web-search';
  competitionScore?: number;
}

// Schema for AI web search results - simplified for better compatibility
const AICompetitorSearchSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().describe('Company name'),
    domain: z.string().describe('Website domain'),
    description: z.string().optional().describe('Brief description'),
    competitionScore: z.number().min(1).max(10).describe('Competition score from 1 to 10')
  }))
});

// Schema for IntelliSearch mode - only high-competition competitors
const AICompetitorSearchSchemaIntelliSearch = z.object({
  competitors: z.array(z.object({
    name: z.string().describe('Company name'),
    domain: z.string().describe('Website domain'),
    description: z.string().optional().describe('Brief description'),
    competitionScore: z.number().min(8).max(10).describe('Competition score from 8 to 10 (only high-competition competitors)')
  }))
});

/**
 * Use Perplexity with web search capabilities to find competitors directly
 * OpenAI is used only for prompt generation based on Perplexity research
 */
export async function findCompetitorsWithAIWebSearch(
  company: Company,
  maxResults: number = 9,
  useWebSearch: boolean = true,
  companyName?: string,
  useSonarReasoning: boolean = false
): Promise<AISearchCompetitor[]> {
  const startTime = Date.now();
  
  try {
    console.log('🤖 [AIWebSearch] Starting Perplexity competitor search...');
    console.log(`🎯 [AIWebSearch] Target: ${maxResults} competitors for ${company.businessProfile?.businessType || company.industry || 'unknown business'}`);
    console.log(`🔧 [AIWebSearch] Using ${useSonarReasoning ? 'sonar-reasoning' : 'sonar-pro'} model`);
    
    // Get Perplexity provider
    const providers = getConfiguredProviders();
    const perplexityProvider = providers.find(p => p.id === 'perplexity' && p.isConfigured());
    
    if (!perplexityProvider) {
      throw new Error('Perplexity provider not available or not configured');
    }
    
    console.log(`🔍 [AIWebSearch] Using Perplexity provider: ${perplexityProvider.name}`);
    
    // Select model based on preference
    const modelId = useSonarReasoning ? 'sonar-reasoning' : 'sonar-pro';
    const model = getProviderModel(perplexityProvider.id, modelId, { useWebSearch });
    
    if (!model) {
      throw new Error(`Failed to get Perplexity model: ${modelId}`);
    }
    
    // Generate optimized search prompt using OpenAI
    const openaiCallId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: 'gpt-4o',
      operation: 'competitor_search',
      success: true,
      metadata: { step: 'prompt_generation' }
    });
    
    const searchPrompt = await generateOptimizedSearchPromptWithOpenAI(company, maxResults, companyName);
    console.log(`📝 [AIWebSearch] Generated optimized search prompt via OpenAI`);
    
    // Update OpenAI call with estimated tokens (prompt generation is typically small)
    apiUsageTracker.updateCall(openaiCallId, {
      inputTokens: 500, // Estimated
      outputTokens: 200, // Estimated
      cost: estimateCost('openai', 'gpt-4o', 500, 200)
    });
    
    // Use Perplexity for competitor research
    console.log('🧭 [AIWebSearch] Using Perplexity for competitor research...');
    console.log('🔍 [AIWebSearch] PERPLEXITY REQUEST DETAILS:');
    console.log('='.repeat(80));
    console.log(`Model: ${modelId} (${useSonarReasoning ? 'sonar-reasoning' : 'sonar-pro'})`);
    console.log(`Temperature: 0.2`);
    console.log(`Web Search: ${useWebSearch}`);
    console.log(`Max Results: ${maxResults}`);
    console.log(`IntelliSearch: DISABLED (temporarily)`);
    console.log('='.repeat(80));
    console.log('📤 [AIWebSearch] PROMPT SENT TO PERPLEXITY:');
    console.log('='.repeat(80));
    console.log(searchPrompt);
    console.log('='.repeat(80));
    
    // Track Perplexity call
    const perplexityCallId = apiUsageTracker.trackCall({
      provider: 'perplexity',
      model: modelId,
      operation: 'competitor_search',
      success: true,
      metadata: { 
        step: 'competitor_research',
        useWebSearch,
        maxResults
      }
    });
    
    const perplexityStartTime = Date.now();
    const { text, usage } = await generateText({
      model,
      prompt: searchPrompt,
      temperature: 0.2
    });
    const perplexityDuration = Date.now() - perplexityStartTime;
    
    // Extract tokens from usage
    const tokens = extractTokensFromUsage(usage);
    
    // Calculate cost for debugging
    const calculatedCost = estimateCost('perplexity', modelId, tokens.inputTokens, tokens.outputTokens);
    console.log(`💰 [AIWebSearch] Perplexity cost calculation: ${tokens.inputTokens} input + ${tokens.outputTokens} output = $${calculatedCost.toFixed(4)}`);
    
    // Update Perplexity call with actual usage
    apiUsageTracker.updateCall(perplexityCallId, {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cost: calculatedCost,
      duration: perplexityDuration
    });
      
      // Log raw response for debugging
      console.log('📝 [AIWebSearch] Raw Perplexity response:');
      console.log('='.repeat(80));
      console.log(text);
      console.log('='.repeat(80));
      
    // Convert Perplexity response to structured format using OpenAI
    console.log('📝 [AIWebSearch] Converting Perplexity response to structured format using OpenAI');
    // IntelliSearch temporarily disabled - force to false
    const competitors = await convertPerplexityResponseToStructuredCompetitors(text, maxResults, false);
    
    // Log results
    console.log('\n📋 [AIWebSearch] COMPETITORS FOUND:');
    console.log('='.repeat(80));
    competitors.forEach((comp, index) => {
      console.log(`${index + 1}. ${comp.name} (${comp.domain})`);
      console.log(`   📝 ${comp.snippet}`);
      console.log(`   🎯 Confidence: ${(comp.confidence * 100).toFixed(1)}%`);
      console.log('');
    });
    console.log('='.repeat(80));
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ [AIWebSearch] Found ${competitors.length} competitors via Perplexity in ${processingTime}ms`);
    
    return competitors;
    
  } catch (error) {
    console.error('❌ [AIWebSearch] Error in Perplexity competitor search:', error);
    
    // Fallback to knowledge-based search without web access
    if (useWebSearch) {
      console.log('🔄 [AIWebSearch] Retrying without web search...');
      return findCompetitorsWithAIWebSearch(company, maxResults, false, companyName, useSonarReasoning);
    }
    
    return [];
  }
}

/**
 * Generate optimized search prompt using OpenAI for Perplexity research
 */
async function generateOptimizedSearchPromptWithOpenAI(
  company: Company,
  maxResults: number,
  companyName?: string
): Promise<string> {
  // Check if OpenAI is available
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ [AIWebSearch] OpenAI not available, using fallback prompt generation');
    return generateAdaptiveSearchPrompt(company, maxResults, companyName);
  }

  try {
    // Track OpenAI call for prompt generation
    const openaiPromptCallId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: 'gpt-4o',
      operation: 'competitor_search',
      success: true,
      metadata: { step: 'prompt_generation_detailed' }
    });

    const companyInfo = {
      name: companyName || company.name || 'Unknown',
      url: company.url || 'Unknown',
      description: company.description || company.scrapedData?.description || 'Unknown',
      industry: company.industry || 'Unknown',
      businessType: company.businessProfile?.businessType || 'Unknown',
      marketSegment: company.businessProfile?.marketSegment || 'Unknown',
      primaryMarkets: company.businessProfile?.primaryMarkets?.join(', ') || 'Unknown',
      targetCustomers: company.businessProfile?.targetCustomers || 'Unknown',
      businessModel: company.businessProfile?.businessModel || 'Unknown',
      technologies: company.businessProfile?.technologies?.join(', ') || 'Unknown',
      primaryProducts: company.scrapedData?.mainProducts?.join(', ') || 'Unknown',
      keywords: company.scrapedData?.keywords?.join(', ') || 'Unknown'
    };

    console.log('🏢 [AIWebSearch] COMPANY INFO FOR PROMPT GENERATION:');
    console.log('='.repeat(80));
    console.log(`Name: ${companyInfo.name}`);
    console.log(`URL: ${companyInfo.url}`);
    console.log(`Description: ${companyInfo.description}`);
    console.log(`Industry: ${companyInfo.industry}`);
    console.log(`Business Type: ${companyInfo.businessType}`);
    console.log(`Market Segment: ${companyInfo.marketSegment}`);
    console.log(`Primary Markets: ${companyInfo.primaryMarkets}`);
    console.log(`Target Customers: ${companyInfo.targetCustomers}`);
    console.log(`Business Model: ${companyInfo.businessModel}`);
    console.log(`Technologies: ${companyInfo.technologies}`);
    console.log(`Primary Products: ${companyInfo.primaryProducts}`);
    console.log(`Keywords: ${companyInfo.keywords}`);
    console.log('='.repeat(80));

    const promptGenerationPrompt = `You are an expert market research analyst. Generate an optimized search prompt for finding ${maxResults} competitor companies.

COMPANY TO ANALYZE:
- Name: ${companyInfo.name}
- Website: ${companyInfo.url}
- Description: ${companyInfo.description}
- Industry: ${companyInfo.industry}
- Business Type: ${companyInfo.businessType}
- Market Segment: ${companyInfo.marketSegment}
- Primary Markets: ${companyInfo.primaryMarkets}
- Target Customers: ${companyInfo.targetCustomers}
- Business Model: ${companyInfo.businessModel}
- Technologies: ${companyInfo.technologies}
- Products/Services: ${companyInfo.primaryProducts}
- Keywords: ${companyInfo.keywords}

TASK: Create a search prompt that will be used with Perplexity AI to find direct competitors. The prompt should:

1. Analyze the company profile to determine geographic scope (local, national, international)
2. Identify the most effective search terms and keywords
3. Specify the target market and competitive landscape
4. Request specific competitor information in a structured format
5. Focus on finding REAL companies with actual websites
6. Prioritize direct competitors over indirect ones
7. Ask Perplexity to rank each competitor between 1 and 10 using the format "Competition Score: X" where X is the score

OUTPUT: 
Require to get always the same structure of the prompt : 
  - Geographic scope : local, national, international
  - Keywords to search for : 8-12 specific terms
  - Target market : segment and geographic scope
  - Competitor informations(name, domain, description, competitionScore)
- Provide EXACT company names (not generic terms)

Provide only the optimized search prompt, nothing else. The prompt should be clear, specific, and designed to get the best results from Perplexity's web search capabilities.`;

    console.log('🤖 [AIWebSearch] OPENAI PROMPT GENERATION REQUEST:');
    console.log('='.repeat(80));
    console.log('Model: gpt-4o-mini');
    console.log('Temperature: 0.3');
    console.log('='.repeat(80));
    console.log('📤 [AIWebSearch] PROMPT SENT TO OPENAI:');
    console.log('='.repeat(80));
    console.log(promptGenerationPrompt);
    console.log('='.repeat(80));

    const openaiStartTime = Date.now();
    const { text, usage } = await generateTextOpenAI({
      model: openai('gpt-4o-mini'),
      prompt: promptGenerationPrompt,
      temperature: 0.3
    });
    const openaiDuration = Date.now() - openaiStartTime;

    // Extract tokens from usage
    const tokens = extractTokensFromUsage(usage);
    
    // Update OpenAI call with actual usage
    apiUsageTracker.updateCall(openaiPromptCallId, {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cost: estimateCost('openai', 'gpt-4o-mini', tokens.inputTokens, tokens.outputTokens),
      duration: openaiDuration
    });

    console.log('📥 [AIWebSearch] OPENAI RESPONSE:');
    console.log('='.repeat(80));
    console.log(text);
    console.log('='.repeat(80));
    console.log('📝 [AIWebSearch] Generated optimized prompt via OpenAI');
    return text.trim();

  } catch (error) {
    console.warn('⚠️ [AIWebSearch] OpenAI prompt generation failed, using fallback:', error);
    return generateAdaptiveSearchPrompt(company, maxResults, companyName);
  }
}

/**
 * Convert Perplexity response to structured competitors using OpenAI
 * This restores the main branch approach using generateObject with AICompetitorSearchSchema
 */
async function convertPerplexityResponseToStructuredCompetitors(
  perplexityResponse: string,
  maxResults: number,
  useIntelliSearch: boolean = false
): Promise<AISearchCompetitor[]> {
  try {
    // Check if OpenAI is available for structured conversion
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ [AIWebSearch] OpenAI not available for structured conversion, falling back to text parsing');
      return await convertResearchToCompetitors({ response: perplexityResponse }, maxResults);
    }

    const scoreFilteringInstruction = useIntelliSearch 
      ? `1. Extract ONLY competitor companies with Competition Score >= 8 from the response
2. For each high-competition competitor, provide:
   - Exact company name (clean, no asterisks or formatting)
   - Website domain (clean domain only, no http:// or www.)
   - Brief description of what they do
   - Competition score (must be >= 8 to be included)
3. Focus on direct competitors that offer similar products/services
4. Ensure company names are clean and professional
5. Extract domains from URLs mentioned in the response
6. Only include competitors with Competition Score >= 8
7. Maximum ${maxResults} competitors

EXAMPLES of correct extraction (ONLY include if Competition Score >= 8):
- "**Stromer** | https://www.stromerbike.com/ | Competition Score: 8" → INCLUDE: name: "Stromer", domain: "stromerbike.com", competitionScore: 8
- "BMC Switzerland | https://www.bmc-switzerland.com/ | Competition Score: 7" → EXCLUDE (score < 8)
- "Flyer | https://www.flyer-bikes.com/ | Competition Score: 9" → INCLUDE: name: "Flyer", domain: "flyer-bikes.com", competitionScore: 9

IMPORTANT: Only extract competitors with Competition Score >= 8. If a competitor doesn't have a score or has a score < 8, do NOT include them in the results.`
      : `1. Extract ALL competitor companies mentioned in the response
2. For each competitor, provide:
   - Exact company name (clean, no asterisks or formatting)
   - Website domain (clean domain only, no http:// or www.)
   - Brief description of what they do
   - Competition score (if mentioned as "Competition Score: X", extract X; otherwise use 5 as default)
3. Focus on direct competitors that offer similar products/services
4. Ensure company names are clean and professional
5. Extract domains from URLs mentioned in the response
6. Maximum ${maxResults} competitors

EXAMPLES of correct extraction:
- "**Stromer** | https://www.stromerbike.com/ | Competition Score: 8" → name: "Stromer", domain: "stromerbike.com", competitionScore: 8
- "BMC Switzerland | https://www.bmc-switzerland.com/ | Competition Score: 7" → name: "BMC Switzerland", domain: "bmc-switzerland.com", competitionScore: 7
- "Flyer | https://www.flyer-bikes.com/" → name: "Flyer", domain: "flyer-bikes.com", competitionScore: 5 (default)

Extract ALL competitors mentioned, not just the first few.`;

    const conversionPrompt = `Extract competitor information from this Perplexity research response and format it as a structured list.

RESEARCH RESPONSE:
${perplexityResponse}

INSTRUCTIONS:
${scoreFilteringInstruction}`;

    const schema = useIntelliSearch ? AICompetitorSearchSchemaIntelliSearch : AICompetitorSearchSchema;
    
    // Track OpenAI call for structured conversion
    const openaiConversionCallId = apiUsageTracker.trackCall({
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'competitor_search',
      success: true,
      metadata: { step: 'structured_conversion' }
    });
    
    console.log('🔄 [AIWebSearch] OPENAI STRUCTURED CONVERSION REQUEST:');
    console.log('='.repeat(80));
    console.log('Model: gpt-4o-mini');
    console.log(`Schema: ${useIntelliSearch ? 'AICompetitorSearchSchemaIntelliSearch (score >= 8)' : 'AICompetitorSearchSchema (all scores)'}`);
    console.log(`IntelliSearch Mode: ${useIntelliSearch ? 'ON (filtering enabled)' : 'OFF (no filtering)'}`);
    console.log('Temperature: 0.2');
    console.log('='.repeat(80));
    console.log('📤 [AIWebSearch] CONVERSION PROMPT SENT TO OPENAI:');
    console.log('='.repeat(80));
    console.log(conversionPrompt);
    console.log('='.repeat(80));

    const openaiConversionStartTime = Date.now();
    const { object, usage } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: schema,
      prompt: conversionPrompt,
      temperature: 0.2
    });
    const openaiConversionDuration = Date.now() - openaiConversionStartTime;

    // Extract tokens from usage
    const conversionTokens = extractTokensFromUsage(usage);
    
    // Update OpenAI call with actual usage
    apiUsageTracker.updateCall(openaiConversionCallId, {
      inputTokens: conversionTokens.inputTokens,
      outputTokens: conversionTokens.outputTokens,
      cost: estimateCost('openai', 'gpt-4o-mini', conversionTokens.inputTokens, conversionTokens.outputTokens),
      duration: openaiConversionDuration
    });

    console.log('📥 [AIWebSearch] OPENAI STRUCTURED RESPONSE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(object, null, 2));
    console.log('='.repeat(80));
    console.log(`🔍 [AIWebSearch] OpenAI structured conversion found ${object.competitors.length} competitors`);

    // Convert to AISearchCompetitor format
    const competitors: AISearchCompetitor[] = object.competitors.map(comp => ({
      name: comp.name,
      domain: comp.domain,
      url: comp.domain.startsWith('http') ? comp.domain : `https://${comp.domain}`,
      snippet: comp.description || 'Found via research',
      confidence: 0.8,
      source: 'ai-web-search',
      competitionScore: comp.competitionScore || (useIntelliSearch ? undefined : 5)
    }));

    return competitors.slice(0, maxResults);

  } catch (error) {
    console.error('❌ [AIWebSearch] Error in structured conversion:', error);
    console.log('🔄 [AIWebSearch] Falling back to text parsing...');
    return await convertResearchToCompetitors({ response: perplexityResponse }, maxResults, useIntelliSearch);
  }
}

/**
 * Convert research response to competitor format
 */
async function convertResearchToCompetitors(
  researchResult: any,
  maxResults: number,
  useIntelliSearch: boolean = false
): Promise<AISearchCompetitor[]> {
  const competitors: AISearchCompetitor[] = [];
  
  if (!researchResult || !researchResult.response) {
    console.warn('⚠️ [AIWebSearch] No response from research');
    return competitors;
  }
  
  const responseText = researchResult.response;
  console.log('🔍 [AIWebSearch] Parsing response text:', responseText.substring(0, 500) + '...');
  
  const foundCompetitors = new Set<string>();
  
  // Enhanced patterns for different response formats
  const competitorPatterns = [
    // Pattern for table format: "| **Company Name** | https://domain.com |"
    /\|\s*\*\*([^*]+)\*\*\s*\|\s*(https?:\/\/[^\s|]+)/g,
    // Pattern: "1. **Company Name** - domain.com"
    /\d+\.\s*\*\*([^*]+)\*\*\s*-\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    // Pattern: "1. Company Name (domain.com)" 
    /\d+\.\s*([^(]+?)\s*\(([^)]+)\)/g,
    // Pattern: "Company Name - website.com"
    /([A-Za-z][^-\n]+?)\s*-\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    // Pattern: "Company Name: website.com"
    /([A-Za-z][^:\n]+?):\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    // Pattern for simple list: "**Company Name** - https://domain.com"
    /\*\*([^*]+)\*\*\s*-\s*(https?:\/\/[^\s]+)/g,
  ];
  
  // First pass: extract competitor names and domains from patterns
  for (const pattern of competitorPatterns) {
    let match;
    while ((match = pattern.exec(responseText)) !== null && competitors.length < maxResults) {
      const name = match[1]?.trim();
      let domain = match[2]?.trim();
      
      // Clean up the name (remove extra asterisks, etc.)
      const cleanName = name.replace(/\*\*/g, '').trim();
      
      // Clean up the domain/URL
      if (domain) {
        // If it's a full URL, extract the domain
        if (domain.startsWith('http')) {
          try {
            const url = new URL(domain);
            domain = url.hostname.replace(/^www\./, '');
          } catch (e) {
            // If URL parsing fails, try to extract domain manually
            domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          }
        } else {
          // Clean up domain
          domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
        }
      }
      
      if (cleanName && domain && !foundCompetitors.has(cleanName.toLowerCase())) {
        foundCompetitors.add(cleanName.toLowerCase());
        
        if (useIntelliSearch) {
          // Note: Fallback method doesn't have competition scores, so we skip these competitors
          // since we only want competitors with scores >= 8
          console.log(`⚠️ [AIWebSearch] Skipping competitor ${cleanName} - no competition score available in fallback method`);
        } else {
          // Include competitor with default score when IntelliSearch is off
          competitors.push({
            name: cleanName,
            domain: domain,
            url: domain.startsWith('http') ? domain : `https://${domain}`,
            snippet: `Competitor found via research`,
            confidence: 0.8,
            source: 'ai-web-search',
            competitionScore: 5
          });
          
          console.log(`✅ [AIWebSearch] Found competitor: ${cleanName} (${domain})`);
        }
      }
    }
  }
  
  // If no structured competitors found, try to extract from web search sources
  if (competitors.length === 0 && researchResult.webSearchSources) {
    console.log('🔍 [AIWebSearch] Extracting competitors from web search sources');
    
    for (const source of researchResult.webSearchSources.slice(0, maxResults)) {
      if (source.url && source.title) {
        try {
          const url = new URL(source.url);
          const domain = url.hostname.replace(/^www\./, '');
          
          // Extract potential company name from title
          const name = source.title.split(' - ')[0].split(' | ')[0].trim();
          
          if (name && !foundCompetitors.has(name.toLowerCase())) {
            foundCompetitors.add(name.toLowerCase());
            
            if (useIntelliSearch) {
              // Note: Fallback method doesn't have competition scores, so we skip these competitors
              // since we only want competitors with scores >= 8
              console.log(`⚠️ [AIWebSearch] Skipping competitor ${name} - no competition score available in fallback method`);
            } else {
              // Include competitor with default score when IntelliSearch is off
              competitors.push({
                name: name,
                domain: domain,
                url: source.url,
                snippet: source.title || 'Found via web search',
                confidence: 0.7,
                source: 'ai-web-search',
                competitionScore: 5
              });
            }
          }
        } catch (error) {
          console.warn(`⚠️ [AIWebSearch] Invalid URL in source: ${source.url}`);
        }
      }
    }
  }
  
  console.log(`🔍 [AIWebSearch] Converted ${competitors.length} competitors from Perplexity response`);
  return competitors.slice(0, maxResults);
}



/**
 * Generate an adaptive search prompt that lets AI determine geographic scope and strategy
 */
function generateAdaptiveSearchPrompt(company: Company, maxResults: number, companyName?: string): string {
  // Extract all available company information
  const companyInfo = {
    name: companyName || company.name || 'Unknown',
    url: company.url || 'Unknown',
    description: company.description || company.scrapedData?.description || 'Unknown',
    industry: company.industry || 'Unknown',
    businessType: company.businessProfile?.businessType || 'Unknown',
    marketSegment: company.businessProfile?.marketSegment || 'Unknown',
    primaryMarkets: company.businessProfile?.primaryMarkets?.join(', ') || 'Unknown',
    targetCustomers: company.businessProfile?.targetCustomers || 'Unknown',
    businessModel: company.businessProfile?.businessModel || 'Unknown',
    technologies: company.businessProfile?.technologies?.join(', ') || 'Unknown',
    primaryProducts: company.scrapedData?.mainProducts?.join(', ') || 'Unknown',
    keywords: company.scrapedData?.keywords?.join(', ') || 'Unknown'
  };
  
  return `You are an expert market research analyst with access to current web data. Your task is to find ${maxResults} REAL competitor companies by analyzing the provided company profile and adapting your search strategy accordingly.

COMPANY PROFILE TO ANALYZE:
- Company Name: ${companyInfo.name}
- Website URL: ${companyInfo.url}
- Description: ${companyInfo.description}
- Industry: ${companyInfo.industry}
- Business Type: ${companyInfo.businessType}
- Market Segment: ${companyInfo.marketSegment}
- Primary Markets: ${companyInfo.primaryMarkets}
- Target Customers: ${companyInfo.targetCustomers}
- Business Model: ${companyInfo.businessModel}
- Technologies: ${companyInfo.technologies}
- Products/Services: ${companyInfo.primaryProducts}
- Keywords: ${companyInfo.keywords}

ADAPTIVE ANALYSIS INSTRUCTIONS:
1. **Geographic Scope Analysis**: Based on the company profile, determine if this business operates:
   - LOCALLY (single city/region): Small local businesses, law firms, local service providers, cantonal banks
   - NATIONALLY (single country): National brands, country-specific services, regulated industries
   - INTERNATIONALLY: Global brands, tech companies, multinational corporations

2. **Market Context Adaptation**: Analyze the business characteristics to understand:
   - Language markets (French, German, English, Portuguese, Spanish, etc.)
   - Regulatory environments (banking, legal, healthcare, construction)
   - Cultural specificity (local vs global appeal)
   - Business model (B2B, B2C, marketplace, SaaS, services, manufacturing)

3. **Search Strategy Formulation**: Based on your analysis, adapt your web search to:
   - Use appropriate language keywords for the detected market
   - Focus on the right geographic scope (local directories vs international databases)
   - Target industry-specific sources and databases
   - Consider regulatory and cultural factors
   - Search for companies of similar size and market position

SEARCH REQUIREMENTS:
- Search the web for current, accurate information
- Find REAL companies with actual websites and current operations
- Verify companies operate in the same relevant market scope you identified
- Prioritize direct competitors over indirect ones
- Include both established players and emerging competitors
- Ensure domain names are accurate and current
- Focus on companies that actually compete for the same customers

OUTPUT REQUIREMENTS:
- The structure of the prompt must always be the same : 
  - Geographic scope : local, national, international
  - Keywords to search for : 8-12 specific terms
  - Target market : segment and geographic scope
  - Competitor informations(name, domain, description, competitionScore)
- Provide EXACT company names (not generic terms)
- Include accurate website domains (verify they exist)
- Brief explanation of competitive relationship
- Rate competitiveness score based on directness of competition (0-1)
- Ensure geographic and market alignment with your analysis

EXAMPLES OF ADAPTIVE THINKING:
- Swiss cantonal bank → Other Swiss cantonal banks, not international banks
- French law firm in Lyon → Other law firms in Lyon/France, not global legal services
- Portuguese construction company → Portuguese construction companies, not global construction
- German tech startup → German and European tech companies in the same domain
- International SaaS platform → Global SaaS platforms in the same category
- Local restaurant chain → Other restaurant chains in the same region/country
- Swiss watchmaker → Other Swiss and luxury watch manufacturers
- French wine producer → Other French wine producers in similar regions

Focus on finding companies that a customer would actually consider as alternatives when making a purchasing decision in this specific market context.

Remember: Let the company profile guide your search strategy. Don't assume the geographic scope - analyze and adapt based on the actual business characteristics provided. Pay special attention to the URL domain, business type, and market indicators to determine the appropriate scope.`;
}
