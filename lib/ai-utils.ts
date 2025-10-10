
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { Company, BrandPrompt, AIResponse, CompanyRanking, CompetitorRanking, ProviderSpecificRanking, ProviderComparisonData, ProgressCallback, CompetitorFoundData } from './types';
import { getProviderModel, normalizeProviderName, getConfiguredProviders, PROVIDER_CONFIGS } from './provider-config';
import { detectBrandMentions, detectMultipleBrands } from './brand-detection-service';
import { getMessages, getTranslation, getLanguageName } from './locale-utils';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';
import { generateBrandQueryPrompts } from './prompt-generation';
import { createFallbackBrandPrompts } from './prompt-fallbacks';
import { logger } from './logger';
import { cleanProviderResponse } from './provider-response-utils';
import { mockAnalyzePromptWithProvider, shouldUseMockMode } from './ai-utils-mock';


const RankingSchema = z.object({
  rankings: z.array(z.object({
    position: z.number(),
    company: z.string(),
    reason: z.string().optional(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  })),
  analysis: z.object({
    brandMentioned: z.boolean(),
    brandPosition: z.number().optional(),
    competitors: z.array(z.string()),
    overallSentiment: z.enum(['positive', 'neutral', 'negative']),
    confidence: z.number().min(0).max(1),
  }),
});

const CompetitorSchema = z.object({
  competitors: z.array(z.object({
    name: z.string(),
    description: z.string(),
    isDirectCompetitor: z.boolean(),
    marketOverlap: z.enum(['high', 'medium', 'low']),
    businessModel: z.string().describe('e.g., DTC brand, SaaS, API service, marketplace'),
    competitorType: z.enum(['direct', 'indirect', 'retailer', 'platform']).describe('direct = same products, indirect = adjacent products, retailer = sells products, platform = aggregates'),
  })),
});

const PROMPT_CATEGORY_SEQUENCE: BrandPrompt['category'][] = ['ranking', 'comparison', 'alternatives', 'recommendations'];

export async function identifyCompetitors(company: Company, progressCallback?: ProgressCallback): Promise<string[]> {
  try {
    // Use AI to identify real competitors - find first available provider
    const configuredProviders = getConfiguredProviders();
    if (configuredProviders.length === 0) {
      throw new Error('No AI providers configured and enabled');
    }
    
    // Use the first available provider
    const provider = configuredProviders[0];
    const model = getProviderModel(provider.id, provider.defaultModel);
    if (!model) {
      throw new Error(`${provider.name} model not available`);
    }
    
    const prompt = `Identify maximum 9 real, established competitors of ${company.name} in the ${company.industry || 'technology'} industry.

Company: ${company.name}
Industry: ${company.industry}
Description: ${company.description}
${company.scrapedData?.keywords ? `Keywords: ${company.scrapedData.keywords.join(', ')}` : ''}
${company.scrapedData?.competitors ? `Known competitors: ${company.scrapedData.competitors.join(', ')}` : ''}

Based on this company's specific business model and target market, make your own research to identify ONLY direct competitors that:
1. Offer the SAME type of products/services (not just retailers that sell them)
2. Target the SAME customer segment
3. Have a SIMILAR business model (e.g., if it's a DTC brand, find other DTC brands)
4. Actually compete for the same customers
5. Make sure the competitors on the same geographic location if it's a local brand

For example:
- If it's a DTC underwear brand, find OTHER DTC underwear brands (not department stores)
- If it's a web scraping API, find OTHER web scraping APIs (not general data tools)
- If it's an AI model provider, find OTHER AI model providers (not AI applications)
- If it's a clothing brand made in France, find OTHER clothing brands made in France in the same segment (not general retailers)
- It it's a law firm, find other law firms in the same geographic location

IMPORTANT: 
- Only include companies you are confident actually exist
- Focus on TRUE competitors with similar offerings
- Exclude retailers, marketplaces, or aggregators unless the company itself is one
- Search for the maximum number of competitors, the refine and select the most relevant ones with a maximum of 9
- Do NOT include general retailers or platforms that just sell/distribute products`;

    console.log('SELECTED MODEL (identifyCompetitors.generateObject):', typeof model === 'string' ? model : model);
    const { object } = await generateObject({
      model,
      schema: CompetitorSchema,
      prompt,
      temperature: 0.3,
    });

    // Extract competitor names and filter for direct competitors
    // Exclude retailers and platforms unless the company itself is one
    const isRetailOrPlatform = company.industry?.toLowerCase().includes('marketplace') || 
                              company.industry?.toLowerCase().includes('platform') ||
                              company.industry?.toLowerCase().includes('retailer');
    
    const competitors = object.competitors
      .filter(c => {
        // Always include direct competitors with high market overlap
        if (c.isDirectCompetitor && c.marketOverlap === 'high') return true;
        
        // Exclude retailers/platforms for product companies
        if (!isRetailOrPlatform && (c.competitorType === 'retailer' || c.competitorType === 'platform')) {
          return false;
        }
        
        // Include other direct competitors and high-overlap indirect competitors
        return c.competitorType === 'direct' || (c.competitorType === 'indirect' && c.marketOverlap === 'high');
      })
      .map(c => c.name)
      .slice(0, 9); // Limit to 9 competitors max

    // Add any competitors found during scraping (but maintain 9 max limit)
    if (company.scrapedData?.competitors) {
      company.scrapedData.competitors.forEach(comp => {
        if (!competitors.includes(comp) && competitors.length < 9) {
          competitors.push(comp);
        }
      });
    }

    // Send progress events for each competitor found
    if (progressCallback) {
      for (let i = 0; i < competitors.length; i++) {
        progressCallback({
          type: 'competitor-found',
          stage: 'identifying-competitors',
          data: {
            competitor: competitors[i],
            index: i + 1,
            total: competitors.length
          } as CompetitorFoundData,
          timestamp: new Date()
        });
      }
    }

    return competitors;
  } catch (error) {
    console.error('Error identifying competitors:', error);
    return company.scrapedData?.competitors || [];
  }
}

export async function generatePromptsForCompany(company: Company, competitors: string[]): Promise<BrandPrompt[]> {
  const brandName = company.name?.trim() || 'Brand';
  const normalizedCompetitors = competitors.map(c => c.trim()).filter(Boolean);

  try {
    const { prompts } = await generateBrandQueryPrompts({
      targetBrand: brandName,
      companyInfo: {
        name: brandName,
        industry: company.industry,
        description: company.description || company.scrapedData?.description || company.scrapedData?.title,
        website: company.url,
      },
      competitors: normalizedCompetitors.slice(0, 4),
      locale: company.businessProfile?.primaryMarkets?.[0],
      maxPrompts: 8,
    });

    const usablePrompts = prompts.slice(0, 8);

    if (usablePrompts.length === 0) {
      throw new Error('AI prompt generation returned no prompts');
    }

    return usablePrompts.map((prompt, index) => ({
      id: (index + 1).toString(),
      prompt,
      category: PROMPT_CATEGORY_SEQUENCE[index % PROMPT_CATEGORY_SEQUENCE.length],
    }));
  } catch (error) {
    logger.error('generatePromptsForCompany fallback triggered:', error);
    return createFallbackBrandPrompts(company, normalizedCompetitors);
  }
}

export async function analyzePromptWithProvider(
  prompt: string,
  provider: string,
  brandName: string,
  competitors: string[],
  locale?: string
): Promise<AIResponse> {
  // Use mock mode in test environment
  if (shouldUseMockMode()) {
    return mockAnalyzePromptWithProvider(prompt, provider, brandName, competitors, locale);
  }

  const trimmedPrompt = (prompt || '').trim();

  // Normalize provider name for consistency
  const normalizedProvider = normalizeProviderName(provider);
  
  // Get model from centralized configuration
  const model = getProviderModel(normalizedProvider);
  
  if (!model) {
    console.warn(`Provider ${provider} not configured, skipping provider`);
    throw new Error(`Provider ${provider} not configured`);
  }
  
  // Get the model ID from provider config instead of trying to extract from model object
  const providerConfig = PROVIDER_CONFIGS[normalizedProvider];
  const modelId = providerConfig?.defaultModel || 'unknown';
  
  console.log(`${provider} model obtained successfully: ${typeof model}`);
  if (normalizedProvider === 'google') {
    console.log('Google model details:', model);
  }

  const languageName = locale ? getLanguageName(locale) : 'English';

  try {
    // Track API call for analysis
    const callId = apiUsageTracker.trackCall({
      provider: normalizedProvider,
      model: modelId,
      operation: 'analysis',
      success: true,
      metadata: { 
        prompt: trimmedPrompt.substring(0, 100) + '...',
        brandName,
        competitorsCount: competitors.length,
        locale
      }
    });

    // First, get the response
    console.log(`[${provider}] Calling with RAW prompt: "${trimmedPrompt.substring(0, 50)}..."`);
    console.log(`[${provider}] Model type:`, typeof model);
    console.log(`[${provider}] Normalized provider:`, normalizedProvider);
    
    const startTime = Date.now();
    const { text, usage } = await generateText({
      model,
      prompt: trimmedPrompt,
      // GPT-5: ne pas envoyer temperature/top_p/logprobs
      maxTokens: 800,
    });
    const duration = Date.now() - startTime;

    // Extract tokens from usage
    const tokens = extractTokensFromUsage(usage);
    
    // Update API call with actual usage
    apiUsageTracker.updateCall(callId, {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cost: estimateCost(normalizedProvider, modelId, tokens.inputTokens, tokens.outputTokens),
      duration
    });
    
    console.log(`[${provider}] Response received. Length: ${text.length}`);
    console.log(`[${provider}] First 200 chars: "${text.substring(0, 200)}"`);
    
    if (!text || text.length === 0) {
      console.error(`[${provider}] ERROR: Empty response for prompt: "${trimmedPrompt}"`);
      throw new Error(`${provider} returned empty response`);
    }

    // Then analyze it with structured output
    const analysisPrompt = `Analyze this AI response about ${brandName} and its competitors:

Response: "${text}"

Your task:
1. Look for ANY mention of ${brandName} anywhere in the response, including:
   - Direct mentions (exact name)
   - Variations (with or without spaces, punctuation)
   - With suffixes (Inc, LLC, Corp, etc.)
   - In possessive form (${brandName}'s)
   - As part of compound words
2. Look for ANY mention of these competitors: ${competitors.join(', ')}
   - Apply the same detection rules as above
3. For each mentioned company, determine if it has a specific ranking position
4. Identify the sentiment towards each mentioned company
5. Rate your confidence in this analysis (0-1)

IMPORTANT: 
- A company is "mentioned" if it appears ANYWHERE in the response text, even without a specific ranking
- Count ALL mentions, not just ranked ones
- Be very thorough - check for variations like "${brandName}", "${brandName.replace(/\s+/g, '')}", "${brandName.toLowerCase()}"
- Look in all contexts: listed, compared, recommended, discussed, referenced, etc.
- Return the analysis in ${languageName} language

Examples of mentions to catch:
- "${brandName} is a great tool" (direct mention)
- "compared to ${brandName}" (comparison context)  
- "${brandName}'s features" (possessive)
- "alternatives like ${brandName}" (listing context)
- "${brandName.replace(/\s+/g, '')} offers" (no spaces variant)`;

    let object;
    try {
      // Use a fast model for structured output if available
      const structuredModel = normalizedProvider === 'anthropic' 
        ? getProviderModel('openai', 'gpt-4o-mini') || model
        : model;
      
      console.log(`[${provider}] Attempting structured analysis with model:`, typeof structuredModel);
      
      const result = await generateObject({
        model: structuredModel as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        schema: RankingSchema,
        prompt: analysisPrompt,
        maxRetries: 2,
      });
      
      console.log(`[${provider}] Structured analysis successful:`, JSON.stringify(result.object, null, 2));
      object = result.object;
    } catch (error) {
      console.error(`[${provider}] ERROR in structured analysis:`, error instanceof Error ? error.message : String(error));
      if (error instanceof Error) {
        console.error(`[${provider}] Error details:`, {
          name: error.name,
          stack: error.stack,
          cause: (error as { cause?: unknown }).cause,
        });
      }
      
      // For Anthropic, try a simpler text-based approach
      if (provider === 'Anthropic') {
        try {
          // Load translations for the current locale
          const messages = locale ? await getMessages(locale) : null;
          
          const buildSimplePrompt = () => {
            if (!messages) {
              // Fallback to English prompt
              return `Analyze this AI response about ${brandName} and competitors ${competitors.join(', ')}:

"${text}"

Return a simple analysis:
1. Is ${brandName} mentioned? (yes/no)
2. What position/ranking does it have? (number or "not ranked")
3. Which competitors are mentioned? (list names)
4. What's the overall sentiment? (positive/neutral/negative)`;
            }
            
            // Use translated prompt
            const t = (key: string, replacements?: Record<string, string>) => getTranslation(messages, key, replacements);
            
            return `${t('aiPrompts.analysisPrompt.analyzeResponse', { 
              brandName, 
              competitors: competitors.join(', ') 
            })}:

"${text}"

${t('aiPrompts.analysisPrompt.returnAnalysis')}
1. ${t('aiPrompts.analysisPrompt.questionMentioned', { brandName })}
2. ${t('aiPrompts.analysisPrompt.questionPosition')}
3. ${t('aiPrompts.analysisPrompt.questionCompetitors')}
4. ${t('aiPrompts.analysisPrompt.questionSentiment')}`;
          };
          
          const simplePrompt = buildSimplePrompt();

          const { text: simpleResponse } = await generateText({
            model: model as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            prompt: simplePrompt,
          });
          
          // Parse the simple response with enhanced detection
          const lines = simpleResponse.toLowerCase().split('\n');
          const aiSaysBrandMentioned = lines.some(line => line.includes('yes'));
          
          // Use enhanced detection as fallback with pre-generated variations
          const detectionText = cleanProviderResponse(text, { providerName: provider });

          const brandDetection = await detectBrandMentions(detectionText, brandName, {
            caseSensitive: false,
            excludeNegativeContext: false,
            minConfidence: 0.3
          });

          const competitorDetections = await detectMultipleBrands(detectionText, competitors, {
            caseSensitive: false,
            excludeNegativeContext: false,
            minConfidence: 0.3
          });

          const competitors_mentioned = competitors.filter(c => 
            competitorDetections.get(c)?.mentioned || false
          );

          if (aiSaysBrandMentioned && !brandDetection.mentioned) {
            console.log(`[${provider}] Ignoring AI-only brand mention for "${brandName}" - no matches found by detector.`);
          }

          return {
            provider,
            prompt,
            response: text,
            brandMentioned: brandDetection.mentioned,
            brandPosition: undefined,
            competitors: competitors_mentioned,
            rankings: [],
            sentiment: 'neutral' as const,
            confidence: 0.7,
            timestamp: new Date(),
          };
        } catch (fallbackError) {
          console.error('Fallback analysis also failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        }
      }
      
      // For OpenAI, try a simpler analysis if structured output fails
      if (normalizedProvider === 'openai' || provider === 'OpenAI') {
        try {
          console.log(`[${provider}] Trying OpenAI fallback analysis`);
          
          const simpleFallbackPrompt = `Analyze this response for brand mentions:

Response: "${text}"

Target brand: ${brandName}
Competitors: ${competitors.join(', ')}

Please answer:
1. Is "${brandName}" mentioned? (yes/no)
2. What position/rank does it have? (number or "none")
3. Which competitors are mentioned? (list)
4. Overall sentiment about ${brandName}? (positive/neutral/negative)

Be concise and direct.`;

          const { text: fallbackResponse } = await generateText({
            model: model as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            prompt: simpleFallbackPrompt,
            maxTokens: 200,
          });
          
          console.log(`[${provider}] Fallback response:`, fallbackResponse);
          
          // Parse the simple response
          const lines = fallbackResponse.toLowerCase().split('\n');
          const brandMentionedLine = lines.find(line => line.includes('yes') || line.includes('no'));
          const aiSaysBrandMentioned = brandMentionedLine?.includes('yes') || false;
          
          // Enhanced detection as backup
          const detectionText = cleanProviderResponse(text, { providerName: provider });

          const brandDetection = await detectBrandMentions(detectionText, brandName, {
            caseSensitive: false,
            excludeNegativeContext: false,
            minConfidence: 0.3
          });

          const competitorDetections = await detectMultipleBrands(detectionText, competitors, {
            caseSensitive: false,
            excludeNegativeContext: false,
            minConfidence: 0.3
          });

          console.log(`[${provider}] Fallback analysis - AI says mentioned: ${aiSaysBrandMentioned}, Detection says: ${brandDetection.mentioned}`);

          if (aiSaysBrandMentioned && !brandDetection.mentioned) {
            console.log(`[${provider}] Ignoring AI-only brand mention for "${brandName}" - detector found no evidence.`);
          }

          return {
            provider,
            prompt: trimmedPrompt,
            response: text,
            brandMentioned: brandDetection.mentioned,
            brandPosition: undefined,
            competitors: competitors.filter(c => competitorDetections.get(c)?.mentioned || false),
            rankings: [],
            sentiment: 'neutral' as const,
            confidence: 0.7,
            timestamp: new Date(),
          };
        } catch (fallbackError) {
          console.error(`[${provider}] Fallback analysis also failed:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        }
      }
      
      // Final fallback with enhanced detection
      const detectionText = cleanProviderResponse(text, { providerName: provider });

      const brandDetection = await detectBrandMentions(detectionText, brandName, {
        caseSensitive: false,
        excludeNegativeContext: false,
        minConfidence: 0.3
      });

      const competitorDetections = await detectMultipleBrands(detectionText, competitors, {
        caseSensitive: false,
        excludeNegativeContext: false,
        minConfidence: 0.3
      });
      
      return {
        provider,
        prompt: trimmedPrompt,
        response: text,
        brandMentioned: brandDetection.mentioned,
        brandPosition: undefined,
        competitors: competitors.filter(c => competitorDetections.get(c)?.mentioned || false),
        rankings: [],
        sentiment: 'neutral' as const,
        confidence: brandDetection.confidence * 0.5, // Lower confidence for fallback
        timestamp: new Date(),
      };
    }

    const rankings = object.rankings.map((r): CompanyRanking => ({
      position: r.position,
      company: r.company,
      reason: r.reason,
      sentiment: r.sentiment,
    }));

    // Enhanced fallback with proper brand detection using centralized service
    const detectionText = cleanProviderResponse(text, { providerName: provider });

    const brandDetectionResult = await detectBrandMentions(detectionText, brandName, {
      caseSensitive: false,
      excludeNegativeContext: false,
      minConfidence: 0.3
    });
    const brandMentioned = brandDetectionResult.mentioned;

    if (object.analysis.brandMentioned && !brandDetectionResult.mentioned) {
      console.log(`[${provider}] Ignoring AI-only brand mention for "${brandName}" - detector found no evidence.`);
    }

    // Detect all competitor mentions with centralized service
    const competitorDetectionResults = await detectMultipleBrands(detectionText, competitors, {
      caseSensitive: false,
      excludeNegativeContext: false,
      minConfidence: 0.3
    });

    const relevantCompetitors = competitors.filter(competitorName => {
      const detection = competitorDetectionResults.get(competitorName);
      return detection?.mentioned && competitorName !== brandName;
    });

    // Surface AI-only competitors that we intentionally ignore
    const aiOnlyCompetitors = new Set(
      object.analysis.competitors.filter(c => competitors.includes(c) && c !== brandName)
    );
    relevantCompetitors.forEach(c => aiOnlyCompetitors.delete(c));

    if (aiOnlyCompetitors.size > 0) {
      console.log(`[${provider}] Ignoring AI-only competitors without detector evidence: [${Array.from(aiOnlyCompetitors).join(', ')}]`);
    }
    
    // Log detection details for debugging
    if (brandDetectionResult.mentioned && !object.analysis.brandMentioned) {
      console.log(`Enhanced detection found brand "${brandName}" in response from ${provider}:`, 
        brandDetectionResult.matches.map(m => ({
          text: m.text,
          confidence: m.confidence
        }))
      );
    }

    // Get the proper display name for the provider
    const providerDisplayName = provider === 'openai' ? 'OpenAI' :
                               provider === 'anthropic' ? 'Anthropic' :
                               provider === 'google' ? 'Google' :
                               provider === 'perplexity' ? 'Perplexity' :
                               provider; // fallback to original
    
    // Debug log for Google responses
    if (provider === 'google' || provider === 'Google') {
      console.log('Google response generated:', {
        originalProvider: provider,
        displayName: providerDisplayName,
        prompt: prompt.substring(0, 50),
        responseLength: text.length,
        brandMentioned
      });
    }

    return {
      provider: providerDisplayName,
      prompt,
      response: text,
      rankings,
      competitors: relevantCompetitors,
      brandMentioned,
      brandPosition: object.analysis.brandPosition,
      sentiment: object.analysis.overallSentiment,
      confidence: object.analysis.confidence,
      timestamp: new Date(),
      detectionDetails: {
        brandMatches: brandDetectionResult.matches.map(m => ({
          text: m.text,
          index: m.index,
          confidence: m.confidence
        })),
        competitorMatches: new Map(
          Array.from(competitorDetectionResults.entries())
            .filter(([, result]) => result.mentioned)
            .map(([name, result]) => [
              name,
              result.matches.map((m) => ({
                text: m.text,
                index: m.index,
                confidence: m.confidence
              }))
            ])
        )
      }
    };
  } catch (error) {
    console.error(`Error with ${provider}:`, error);
    
    // Special handling for Google errors
    if (provider === 'Google' || provider === 'google') {
      if (error instanceof Error) {
        console.error('Google-specific error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: (error as { cause?: unknown })?.cause,
        });
      }
    }
    
    throw error;
  }
}

export async function analyzeCompetitors(
  company: Company,
  responses: AIResponse[],
  knownCompetitors: string[]
): Promise<CompetitorRanking[]> {
  // Create a set of companies to track (company + its known competitors)
  const trackedCompanies = new Set([company.name, ...knownCompetitors]);
  
  // Log des marques recherchées
  console.log(`[AnalyzeCompetitors] 🎯 Marque cible: "${company.name}"`);
  console.log(`[AnalyzeCompetitors] 🏆 Concurrents trackés: [${Array.from(trackedCompanies).join(', ')}]`);
  console.log(`[AnalyzeCompetitors] 📊 Total réponses à analyser: ${responses.length}`);
  
  // Initialize competitor data
  const competitorMap = new Map<string, {
    mentions: number;
    positions: number[];
    sentiments: ('positive' | 'neutral' | 'negative')[];
  }>();

  // Initialize all tracked companies
  trackedCompanies.forEach(companyName => {
    competitorMap.set(companyName, {
      mentions: 0,
      positions: [],
      sentiments: [],
    });
  });

  // Process all responses
  responses.forEach((response, responseIndex) => {
    // Track which companies were mentioned in this response
    const mentionedInResponse = new Set<string>();
    
    // Log des outputs de prompts et réponses
    console.log(`[AnalyzeCompetitors] 📝 Réponse ${responseIndex + 1}/${responses.length} (${response.provider}):`);
    console.log(`  Prompt: "${response.prompt?.substring(0, 100)}..."`);
    console.log(`  Réponse: "${response.response?.substring(0, 200)}..."`);
    console.log(`  Brand mentionné: ${response.brandMentioned}`);
    console.log(`  Concurrents détectés: [${response.competitors?.join(', ') || 'aucun'}]`);
    console.log(`  Rankings: ${response.rankings?.length || 0} entrées`);
    
    // Process rankings if available
    if (response.rankings) {
      response.rankings.forEach(ranking => {
        // Only track companies we care about
        if (trackedCompanies.has(ranking.company)) {
          const data = competitorMap.get(ranking.company)!;
          
          // Only count one mention per response
          if (!mentionedInResponse.has(ranking.company)) {
            data.mentions++;
            mentionedInResponse.add(ranking.company);
            console.log(`    ✅ ${ranking.company} mentionné dans ranking (position ${ranking.position})`);
          }
          
          if (ranking.position !== null) {
            data.positions.push(ranking.position);
          }
          if (ranking.sentiment) {
            data.sentiments.push(ranking.sentiment);
          }
        }
      });
    }

    // Count brand mentions (only if not already counted in rankings)
    if (response.brandMentioned && trackedCompanies.has(company.name) && !mentionedInResponse.has(company.name)) {
      const brandData = competitorMap.get(company.name)!;
      brandData.mentions++;
      console.log(`    ✅ ${company.name} mentionné comme marque`);
      if (response.brandPosition) {
        brandData.positions.push(response.brandPosition);
      }
      brandData.sentiments.push(response.sentiment);
    }
  });

  // Calculate scores for each competitor
  const totalResponses = responses.length;
  const competitors: CompetitorRanking[] = [];

  competitorMap.forEach((data, name) => {
    const avgPosition = data.positions.length > 0
      ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length
      : 99; // High number for companies not ranked

    const sentimentScore = calculateSentimentScore(data.sentiments);
    const visibilityScore = Math.min((data.mentions / totalResponses) * 100, 100);

    // Log des pourcentages calculés
    console.log(`[AnalyzeCompetitors] 📊 ${name}: ${data.mentions} mentions / ${totalResponses} réponses = ${visibilityScore.toFixed(1)}%`);
    
    // Inclure TOUTES les marques sélectionnées au départ (knownCompetitors + company)
    // même si elles ont 0% de score - c'est important pour la cohérence de l'UI
    const isSelectedBrand = name === company.name || knownCompetitors.includes(name);
    
    if (isSelectedBrand) {
      competitors.push({
        name,
        mentions: data.mentions,
        averagePosition: Math.round(avgPosition * 10) / 10,
        sentiment: determineSentiment(data.sentiments),
        sentimentScore,
        shareOfVoice: 0, // Will calculate after all competitors are processed
        visibilityScore: Math.round(visibilityScore * 10) / 10,
        weeklyChange: undefined, // No historical data available yet
        isOwn: name === company.name,
      });
      console.log(`[AnalyzeCompetitors] ✅ Including ${name} in final results (selected brand, ${data.mentions} mentions, ${visibilityScore.toFixed(1)}%)`);
    } else {
      console.log(`[AnalyzeCompetitors] ❌ Excluding ${name} from final results (not in selected brands)`);
    }
  });

  // Calculate share of voice
  const totalMentions = competitors.reduce((sum, c) => sum + c.mentions, 0);
  competitors.forEach(c => {
    c.shareOfVoice = totalMentions > 0 
      ? Math.round((c.mentions / totalMentions) * 1000) / 10 
      : 0;
  });

  // Sort by visibility score
  return competitors.sort((a, b) => b.visibilityScore - a.visibilityScore);
}

function calculateSentimentScore(sentiments: ('positive' | 'neutral' | 'negative')[]): number {
  if (sentiments.length === 0) return 50;
  
  const sentimentValues = { positive: 100, neutral: 50, negative: 0 };
  const sum = sentiments.reduce((acc, s) => acc + sentimentValues[s], 0);
  return Math.round(sum / sentiments.length);
}

function determineSentiment(sentiments: ('positive' | 'neutral' | 'negative')[]): 'positive' | 'neutral' | 'negative' {
  if (sentiments.length === 0) return 'neutral';
  
  const counts = { positive: 0, neutral: 0, negative: 0 };
  sentiments.forEach(s => counts[s]++);
  
  if (counts.positive > counts.negative && counts.positive > counts.neutral) return 'positive';
  if (counts.negative > counts.positive && counts.negative > counts.neutral) return 'negative';
  return 'neutral';
}

export function calculateBrandScores(responses: AIResponse[], brandName: string, competitors: CompetitorRanking[]) {
  const totalResponses = responses.length;
  if (totalResponses === 0) {
    return {
      visibilityScore: 0,
      sentimentScore: 0,
      shareOfVoice: 0,
      overallScore: 0,
      averagePosition: 0,
    };
  }

  // Find the brand's competitor ranking
  const brandRanking = competitors.find(c => c.isOwn);
  
  if (!brandRanking) {
    return {
      visibilityScore: 0,
      sentimentScore: 0,
      shareOfVoice: 0,
      overallScore: 0,
      averagePosition: 0,
    };
  }

  const visibilityScore = brandRanking.visibilityScore;
  const sentimentScore = brandRanking.sentimentScore;
  const shareOfVoice = brandRanking.shareOfVoice;
  const averagePosition = brandRanking.averagePosition;

  // Calculate position score (lower is better, scale to 0-100)
  const positionScore = averagePosition <= 10 
    ? (11 - averagePosition) * 10 
    : Math.max(0, 100 - (averagePosition * 2));

  // Overall Score (weighted average)
  const overallScore = (
    visibilityScore * 0.3 + 
    sentimentScore * 0.2 + 
    shareOfVoice * 0.3 +
    positionScore * 0.2
  );

  return {
    visibilityScore: Math.round(visibilityScore * 10) / 10,
    sentimentScore: Math.round(sentimentScore * 10) / 10,
    shareOfVoice: Math.round(shareOfVoice * 10) / 10,
    overallScore: Math.round(overallScore * 10) / 10,
    averagePosition: Math.round(averagePosition * 10) / 10,
  };
}

export async function analyzeCompetitorsByProvider(
  company: Company,
  responses: AIResponse[],
  knownCompetitors: string[],
  sendEvent?: (event: any) => Promise<void> // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<{
  providerRankings: ProviderSpecificRanking[];
  providerComparison: ProviderComparisonData[];
}> {
  // 1. ÉTAPE 1: Figer les marques à analyser
  const allBrands = [company.name, ...knownCompetitors];
  const trackedCompanies = new Set(allBrands);
  
  console.log(`[ProviderComparison] 🎯 Marque cible: "${company.name}"`);
  console.log(`[ProviderComparison] 🏆 Concurrents trackés: [${Array.from(trackedCompanies).join(', ')}]`);
  console.log(`[ProviderComparison] 📊 Total réponses à analyser: ${responses.length}`);
  
  // 2. ÉTAPE 2: Nettoyer les marques avec OpenAI
  const { cleanBrandsWithAI, extractBrandsFromText, calculateBrandVisibilityByProvider } = await import('./brand-detection-service');
  
  console.log(`[ProviderComparison] 🧹 Nettoyage des marques avec OpenAI...`);
  const cleanedBrands = await cleanBrandsWithAI(allBrands);
  
  // 3. ÉTAPE 4: Extraire les marques de chaque réponse LLM (parallélisé)
  console.log(`[ProviderComparison] 🔍 Extraction des marques des réponses LLM...`);
  const brandExtractions = new Map();
  
  // Grouper les réponses par provider
  const responsesByProvider = new Map<string, AIResponse[]>();
  responses.forEach(response => {
    if (!responsesByProvider.has(response.provider)) {
      responsesByProvider.set(response.provider, []);
    }
    responsesByProvider.get(response.provider)!.push(response);
  });
  
  // Calculer le nombre total de réponses à traiter pour la progression
  const totalResponses = responses.filter(r => r.response && r.response.trim()).length;
  let processedResponses = 0;
  
  // Analyser chaque provider en parallèle
  const providerExtractionPromises = Array.from(responsesByProvider.entries()).map(async ([provider, providerResponses]) => {
    console.log(`[ProviderComparison] 📝 Analyse ${provider}: ${providerResponses.length} réponses`);
    
    // Traiter toutes les réponses de ce provider en parallèle
    const responseExtractionPromises = providerResponses
      .filter(response => response.response && response.response.trim())
      .map(async (response, index) => {
        console.log(`[ProviderComparison] 📄 Analyse réponse ${index + 1}/${providerResponses.length} (${provider})`);
        
        try {
          const extraction = await extractBrandsFromText(response.response, cleanedBrands, `${provider}-${index + 1}`);
          
          // Mise à jour de la progression (70-90% de la progression totale)
          processedResponses++;
          const extractionProgress = (processedResponses / totalResponses) * 20; // 20% pour l'extraction (70% à 90%)
          const progress = Math.round(70 + extractionProgress);
          
          if (sendEvent) {
            await sendEvent({
              type: 'brand-extraction-progress',
              stage: 'extracting-brands',
              data: {
                stage: 'extracting-brands',
                provider,
                responseIndex: index + 1,
                totalResponses: providerResponses.length,
                progress,
                message: `Extracting brands from ${provider} response ${index + 1}/${providerResponses.length}`
              },
              timestamp: new Date()
            });
          }
          
          return extraction;
        } catch (error) {
          console.error(`[ProviderComparison] ❌ Erreur extraction ${provider}-${index + 1}:`, error);
          processedResponses++;
          
          // Mise à jour de la progression même en cas d'erreur
          const extractionProgress = (processedResponses / totalResponses) * 20;
          const progress = Math.round(70 + extractionProgress);
          
          if (sendEvent) {
            await sendEvent({
              type: 'brand-extraction-progress',
              stage: 'extracting-brands',
              data: {
                stage: 'extracting-brands',
                provider,
                responseIndex: index + 1,
                totalResponses: providerResponses.length,
                progress,
                message: `Error extracting brands from ${provider} response ${index + 1}/${providerResponses.length}`
              },
              timestamp: new Date()
            });
          }
          
          return null;
        }
      });
    
    const providerExtractions = await Promise.all(responseExtractionPromises);
    return { provider, extractions: providerExtractions.filter(e => e !== null) };
  });
  
  // Attendre toutes les extractions
  const providerResults = await Promise.all(providerExtractionPromises);
  
  // Stocker les résultats
  providerResults.forEach(({ provider, extractions }) => {
    brandExtractions.set(provider, extractions);
  });
  
  // 4. ÉTAPE 5: Calculer les détections par provider
  console.log(`[ProviderComparison] 📊 Calcul des détections par provider...`);
  const providerDetections = calculateBrandVisibilityByProvider(brandExtractions, company.name, knownCompetitors);
  
  // 5. ÉTAPE 6: Construire les résultats dans le format attendu
  const providers = Array.from(responsesByProvider.keys());
  const providerRankings: ProviderSpecificRanking[] = [];
  const providerComparison: ProviderComparisonData[] = [];
  
  // Créer les rankings par provider basés sur la nouvelle détection
  providers.forEach(provider => {
    const competitors: CompetitorRanking[] = [];
    const providerResponses = responsesByProvider.get(provider)!;
    const totalResponses = providerResponses.length;
    const providerBrandDetections = providerDetections.get(provider);
    
    console.log(`[ProviderComparison] 🔍 Construction des résultats pour ${provider}: ${totalResponses} réponses`);
    
    allBrands.forEach(brandName => {
      const detection = providerBrandDetections?.get(brandName);
      const mentionCount = detection?.mentionCount || 0;
      const totalResponses = detection?.totalResponses || providerResponses.length;
      const visibilityScore = detection?.percentage || 0; // Utiliser le pourcentage réel
      
      // Pour les positions et sentiments, on garde la logique existante des rankings
      const brandRankings = providerResponses
        .flatMap(r => r.rankings || [])
        .filter(r => r.company === brandName);
      
      const positions = brandRankings
        .map(r => r.position)
        .filter(p => p !== null && p !== undefined) as number[];
      
      const sentiments = brandRankings
        .map(r => r.sentiment)
        .filter(s => s !== null && s !== undefined) as ('positive' | 'neutral' | 'negative')[];
      
      const avgPosition = positions.length > 0
        ? positions.reduce((a, b) => a + b, 0) / positions.length
        : 99;
      
      competitors.push({
        name: brandName,
        mentions: mentionCount, // Utiliser le nombre réel de mentions
        averagePosition: Math.round(avgPosition * 10) / 10,
        sentiment: determineSentiment(sentiments),
        sentimentScore: calculateSentimentScore(sentiments),
        shareOfVoice: 0, // Will calculate after
        visibilityScore: Math.round(visibilityScore * 10) / 10,
        isOwn: brandName === company.name,
      });
      
      console.log(`[ProviderComparison] 📊 ${brandName} (${provider}): ${mentionCount}/${totalResponses} = ${visibilityScore}%`);
    });
    
    // Calculate share of voice for this provider
    const totalMentions = competitors.reduce((sum, c) => sum + c.mentions, 0);
    competitors.forEach(c => {
      c.shareOfVoice = totalMentions > 0 
        ? Math.round((c.mentions / totalMentions) * 1000) / 10 
        : 0;
    });
    
    // Sort by visibility score
    competitors.sort((a, b) => b.visibilityScore - a.visibilityScore);
    
    providerRankings.push({
      provider,
      competitors,
    });
  });

  // Créer la matrice de comparaison avec la nouvelle détection
  allBrands.forEach(brandName => {
    const comparisonData: ProviderComparisonData = {
      competitor: brandName,
      providers: {},
      isOwn: brandName === company.name,
    };

    let hasAnyMentions = false;

    providerRankings.forEach(({ provider, competitors }) => {
      const competitor = competitors.find(c => c.name === brandName);
      if (competitor) {
        comparisonData.providers[provider] = {
          visibilityScore: competitor.visibilityScore,
          position: competitor.averagePosition,
          mentions: competitor.mentions,
          sentiment: competitor.sentiment,
        };
        
        if (competitor.mentions > 0) {
          hasAnyMentions = true;
        }
      }
    });

    console.log(`[ProviderComparison] 🔍 Analyse ${brandName}:`);
    console.log(`  - hasAnyMentions: ${hasAnyMentions}`);
    console.log(`  - isOwn: ${brandName === company.name}`);
    console.log(`  - providers avec données: ${Object.keys(comparisonData.providers).length}`);

    // Inclure TOUTES les marques sélectionnées au départ (knownCompetitors + company)
    // même si elles ont 0% de score - c'est important pour la cohérence de l'UI
    const isSelectedBrand = brandName === company.name || knownCompetitors.includes(brandName);
    
    if (isSelectedBrand) {
      providerComparison.push(comparisonData);
      console.log(`[ProviderComparison] ✅ Including ${brandName} in matrix (selected brand, score: ${hasAnyMentions ? 'with mentions' : '0%'})`);
    } else {
      console.log(`[ProviderComparison] ❌ Excluding ${brandName} from matrix (not in selected brands)`);
    }
  });

  // Trier par score de visibilité moyen
  providerComparison.sort((a, b) => {
    const avgA = Object.values(a.providers).reduce((sum, p) => sum + p.visibilityScore, 0) / Object.keys(a.providers).length;
    const avgB = Object.values(b.providers).reduce((sum, p) => sum + p.visibilityScore, 0) / Object.keys(b.providers).length;
    return avgB - avgA;
  });

  return { providerRankings, providerComparison };
}

