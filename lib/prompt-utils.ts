import { Company } from './types';
import { generatePromptsForCompany } from './ai-utils';
import { logger } from './logger';
import { buildFallbackPromptStrings, createDevelopmentMockPrompts } from './prompt-fallbacks';

/**
 * Generate AI-powered adaptive prompts using API route
 */
export async function generateAdaptivePrompts(
  company: Company,
  competitors: { name: string }[] = []
): Promise<string[]> {
  if (!company) {
    return getGenericPrompts();
  }

  const targetBrand = company.name;
  
  // Get up to 9 competitor names
  const competitorNames = competitors.slice(0, 9).map(c => c.name);
  
  try {
    logger.debug('Generating AI prompts via API for:', targetBrand, 'vs', competitorNames);
    logger.debug('Company industry:', company.industry);
    logger.debug('Company description:', company.description);
    
    const response = await fetch('/api/generate-prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetBrand,
        companyInfo: {
          name: company.name,
          industry: company.industry,
          description: company.description,
          website: company.url,
        },
        competitors: competitorNames,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('API error:', response.status, errorData);
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && Array.isArray(data.prompts) && data.prompts.length > 0) {
      logger.info('Received AI-generated prompts:', data.prompts.length, 'prompts from', data.provider);
      return data.prompts;
    }
    
    throw new Error('Invalid API response format');
    
  } catch (error) {
    console.error('Error generating adaptive prompts via API:', error);
    
    // Fallback to mock prompts in development, static prompts in production
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Falling back to mock adaptive prompts for development');
      return createDevelopmentMockPrompts(company, targetBrand, competitorNames);
    }

    return buildFallbackPromptStrings(company, competitorNames);
  }
}

/**
 * Generate simple, context-aware default prompts for UI display
 * Now uses AI-powered generation when possible
 */
export async function generateSimpleDefaultPrompts(
  company: Company,
  competitors: { name: string }[] = []
): Promise<string[]> {
  const competitorNames = competitors.map(c => c.name);

  try {
    const aiPrompts = await generateAdaptivePrompts(company, competitors);
    if (aiPrompts.length >= 4) {
      return aiPrompts;
    }
  } catch (error) {
    console.warn('AI prompt generation failed, using fallback:', error);
  }

  if (!company) {
    return getGenericPrompts();
  }

  return buildFallbackPromptStrings(company, competitorNames);
}

/**
 * Generate AI-powered, contextual prompts for analysis
 * Uses the sophisticated AI logic from ai-utils.ts
 */
export async function generateContextualPrompts(
  company: Company, 
  competitors: string[] = []
): Promise<string[]> {
  try {
    const brandPrompts = await generatePromptsForCompany(company, competitors);
    return brandPrompts.map(bp => bp.prompt);
  } catch (error) {
    console.error('Failed to generate contextual prompts, falling back to simple prompts:', error);
    return generateSimpleDefaultPrompts(company);
  }
}

/**
 * Get the display prompts for the UI
 * Combines defaults, custom prompts, and handles removed prompts
 */
export async function getDisplayPrompts(
  company: Company,
  customPrompts: string[] = [],
  removedDefaultPrompts: number[] = [],
  analyzingPrompts: string[] = [],
  competitors: { name: string }[] = []
): Promise<string[]> {
  // If we have analyzing prompts (during/after analysis), use those
  if (analyzingPrompts.length > 0) {
    return analyzingPrompts;
  }
  
  // Otherwise, generate UI prompts using AI
  const defaultPrompts = await generateSimpleDefaultPrompts(company, competitors);
  const filteredPrompts = defaultPrompts.filter((_, index) => !removedDefaultPrompts.includes(index));
  
  return [...filteredPrompts, ...customPrompts];
}

/**
 * Prepare prompts for analysis - this is where we decide between simple and AI-generated
 */
export async function preparePromptsForAnalysis(
  company: Company,
  customPrompts: string[] = [],
  removedDefaultPrompts: number[] = [],
  competitors: string[] = [],
  useAIGenerated: boolean = true
): Promise<string[]> {
  // Convert competitor strings to objects for consistency
  const competitorObjects = competitors.map(name => ({ name }));
  
  if (customPrompts.length > 0) {
    // If user has custom prompts, combine with non-removed adaptive defaults
    const defaultPrompts = await generateSimpleDefaultPrompts(company, competitorObjects);
    const filteredDefaults = defaultPrompts.filter((_, index) => !removedDefaultPrompts.includes(index));
    return [...filteredDefaults, ...customPrompts];
  }
  
  if (useAIGenerated && competitors.length > 0) {
    // Use new adaptive AI-generated prompts for superior analysis
    const adaptivePrompts = await generateAdaptivePrompts(company, competitorObjects);
    if (adaptivePrompts.length > 0) {
      return adaptivePrompts;
    }
    
    // Fallback to contextual prompts if adaptive fails
    return await generateContextualPrompts(company, competitors);
  }
  
  // Fallback to adaptive simple prompts
  const defaultPrompts = await generateSimpleDefaultPrompts(company, competitorObjects);
  return defaultPrompts.filter((_, index) => !removedDefaultPrompts.includes(index));
}


function getGenericPrompts(): string[] {
  const currentYear = new Date().getFullYear();
  return [
    `Which solutions are recommended in ${currentYear}?`,
    `Top options teams rely on in ${currentYear}?`,
    `Most trusted providers for this kind of purchase?`,
    `What should I evaluate before choosing a solution?`
  ];
}
/**
 * Check if a prompt is a custom prompt (not in the default list)
 */
export async function isCustomPrompt(prompt: string, company: Company): Promise<boolean> {
  const defaultPrompts = await generateSimpleDefaultPrompts(company);
  return !defaultPrompts.includes(prompt);
}

/**
 * Get the original index of a default prompt for removal tracking
 */
export async function getDefaultPromptIndex(prompt: string, company: Company): Promise<number> {
  const defaultPrompts = await generateSimpleDefaultPrompts(company);
  return defaultPrompts.findIndex((p: string) => p === prompt);
}

