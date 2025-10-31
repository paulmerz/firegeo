import { generateText } from 'ai';
import { getProviderModel } from './provider-config';
import { getLanguageName } from './locale-utils';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from './api-usage-tracker';
import { logger } from './logger';

interface PromptGenerationCompanyInfo {
  name: string;
  industry?: string;
  description?: string;
  website?: string;
}

export interface PromptGenerationOptions {
  targetBrand: string;
  companyInfo: PromptGenerationCompanyInfo;
  competitors?: string[];
  locale?: string;
  maxPrompts?: number;
}

export interface PromptGenerationResult {
  prompts: string[];
  provider: string;
  rawResponse: string;
}

interface ProviderAttempt {
  id: 'openai' | 'anthropic' | 'google';
  model: string;
}

const PROVIDER_ATTEMPTS: ProviderAttempt[] = [
  { id: 'openai', model: 'gpt-4o' },
  { id: 'anthropic', model: 'claude-3-5-haiku-20241022' },
  { id: 'google', model: 'gemini-1.5-flash' }
];

function buildCompanyContext({ name, industry, description, website }: PromptGenerationCompanyInfo): string {
  const lines: string[] = [`Target Company: ${name}`];
  if (industry) lines.push(`Industry: ${industry}`);
  if (description) lines.push(`Description: ${description}`);
  if (website) lines.push(`Website: ${website}`);
  return `${lines.join('\n')}`;
}

function buildPrompt(targetBrand: string, companyInfo: PromptGenerationCompanyInfo, competitors: string[], languageName: string): string {
  const competitorList = competitors.filter(Boolean).join(', ');
  const companyContext = `${buildCompanyContext(companyInfo)}\n\nCompetitor Brands: ${competitorList || 'None provided'}`;

  return `You are an expert in brand GEO (Generative Engine Optimization), specialized in how Large Language Models surface and recommend products or services.\n\nBased on the company information provided below, analyze the business context and determine what industry/sector this company operates in. Then generate the 8 most searched-for, high-intent natural language queries that potential customers in that industry are most likely to type.\n\nCompany Context:\n${companyContext}\n\nCurrent year: ${new Date().getFullYear()}\n\n## TASK\n1/ Research the company's specific segment and USP (determine this from the Company Context provided, be very specific)\ni.e ; Speedbike market in Europ VS electric bike, boutique hotels in Paris VS worldwide hotel chain, independant watch manufacturer VS watch retailer, etc.\n\n2/ Write queries\nThe goal is to reveal how consumers might frame requests where LLMs are most likely to provide product/service recommendations, so ${targetBrand} can better understand its visibility and positioning relative to competitors.\n\nReturn ONLY the result as a valid JSON array in the following format:\n["string1", "string2", "string3", "string4", "string5", "string6", "string7", "string8"]\n\nMake sure the queries are:\n- Natural and conversational\n- They will naturally lead to an answer where brands are mentioned (avoid questions where brand names will not be mentioned in the answer)\n- High-intent (looking for recommendations)\n- Relevant to the company's specific segment and USP (determine this from the Company Context provided, be very specific)\n- Varied in approach (some general requests, some product/service requests, some specific needs)\n- Not referencing any company name or brand directly to avoid false positives\n- Written in ${languageName}\n\nExamples of good queries:\n- "I am a beginner in running, which shoes should I buy?"\n- "I am building a marketplace, what payment platform should I use?"\n- "What are the best tools I should use as a digital nomad?"\n- "What's the most reliable web scraping tool in 2025?"\n\nIMPORTANT ! \n1/ Make sure the queries lead to an answer where brands are mentioned\n2/ Return the content in ${languageName} language.`;
}

function parsePromptsFromResponse(responseText: string): string[] {
  const match = responseText.trim().match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error('Failed to locate JSON array in AI response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not a JSON array');
  }

  return parsed
    .filter(item => typeof item === 'string')
    .map(item => (item as string).trim())
    .filter(Boolean);
}

export async function generateBrandQueryPrompts({
  targetBrand,
  companyInfo,
  competitors = [],
  locale,
  maxPrompts = 8
}: PromptGenerationOptions): Promise<PromptGenerationResult> {
  const normalizedBrand = targetBrand?.trim();
  if (!normalizedBrand) {
    throw new Error('Target brand is required for prompt generation');
  }

  const languageName = getLanguageName(locale || 'en');
  const prompt = buildPrompt(normalizedBrand, companyInfo, competitors, languageName);
  const competitorCount = competitors.length;

  for (const attempt of PROVIDER_ATTEMPTS) {
    const model = getProviderModel(attempt.id, attempt.model);

    if (!model) {
      logger.warn(`[PromptGeneration] Provider ${attempt.id} not available, skipping`);
      continue;
    }

    const callId = apiUsageTracker.trackCall({
      provider: attempt.id,
      model: attempt.model,
      operation: 'prompt_generation',
      success: true,
      metadata: {
        targetBrand: normalizedBrand,
        competitorsCount: competitorCount,
        language: languageName,
        providerRank: `${attempt.id}-${attempt.model}`
      }
    });

    try {
      const startTime = Date.now();
      const response = await generateText({
        model,
        prompt,
        temperature: 0.7
      });
      const duration = Date.now() - startTime;

      const tokens = extractTokensFromUsage(response.usage);
      apiUsageTracker.updateCall(callId, {
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        cost: estimateCost(attempt.id, attempt.model, tokens.inputTokens, tokens.outputTokens),
        duration
      });

      const prompts = parsePromptsFromResponse(response.text).slice(0, maxPrompts);

      if (prompts.length === 0) {
        throw new Error('AI provider returned an empty prompt list');
      }

      logger.info(`[PromptGeneration] Generated ${prompts.length} prompts with ${attempt.id}`);
      return {
        prompts,
        provider: attempt.id,
        rawResponse: response.text
      };
    } catch (error) {
      logger.error(`[PromptGeneration] Provider ${attempt.id} failed:`, error);
      apiUsageTracker.updateCall(callId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  throw new Error('Failed to generate prompts - no AI provider succeeded');
}
