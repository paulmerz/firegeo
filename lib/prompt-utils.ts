import { Company, BrandPrompt } from './types';
import { generatePromptsForCompany } from './ai-utils';
import { generateText } from 'ai';
import { getProviderModel } from './provider-config';
import { logger } from './logger';

/**
 * Service type detection based on company data
 */
export function detectServiceType(company: Company): string {
  if (!company) return 'tool';
  
  const industry = company.industry?.toLowerCase() || '';
  const name = company.name?.toLowerCase() || '';
  const description = company.description?.toLowerCase() || '';
  const scrapedContent = [
    company.scrapedData?.title || '',
    company.scrapedData?.description || '',
    ...(company.scrapedData?.keywords || [])
  ].join(' ').toLowerCase();

  const allContent = `${industry} ${name} ${description} ${scrapedContent}`;

  // More sophisticated detection logic
  if (allContent.includes('ai') || allContent.includes('artificial intelligence') || allContent.includes('machine learning')) {
    return 'AI tool';
  }
  if (allContent.includes('web scraping') || allContent.includes('scraping') || allContent.includes('crawler')) {
    return 'web scraping tool';
  }
  if (allContent.includes('deployment') || allContent.includes('hosting') || allContent.includes('cloud')) {
    return 'deployment platform';
  }
  if (allContent.includes('saas') || allContent.includes('software')) {
    return 'software tool';
  }
  if (allContent.includes('api')) {
    return 'API service';
  }
  if (allContent.includes('outdoor') || allContent.includes('cooler') || allContent.includes('drinkware')) {
    return 'outdoor gear brand';
  }
  if (allContent.includes('fashion') || allContent.includes('clothing') || allContent.includes('apparel') || allContent.includes('vêtements') || allContent.includes('chaussures')) {
    return 'fashion brand';
  }
  if (allContent.includes('health') || allContent.includes('santé') || allContent.includes('medical') || allContent.includes('médical') || allContent.includes('healthcare') || allContent.includes('soins') || allContent.includes('pharma') || allContent.includes('pharmaceutical')) {
    return 'healthcare';
  }
  
  // Fallback based on industry
  if (industry.includes('technology') || industry.includes('software')) return 'tool';
  if (industry.includes('fashion') || industry.includes('apparel')) return 'fashion brand';
  if (industry.includes('outdoor')) return 'gear brand';
  if (industry.includes('health') || industry.includes('santé') || industry.includes('medical') || industry.includes('médical') || industry.includes('healthcare')) return 'healthcare';
  
  return 'tool'; // Default fallback
}

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
  
  // Get up to 4 competitor names
  const competitorNames = competitors.slice(0, 4).map(c => c.name);
  
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
      const serviceType = detectServiceType(company); // Only used for fallback
      return getMockAdaptivePrompts(serviceType, targetBrand, competitorNames);
    }
    
    const serviceType = detectServiceType(company); // Only used for fallback
    return getFallbackPrompts(serviceType);
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
  // Try AI-powered generation first
  try {
    const aiPrompts = await generateAdaptivePrompts(company, competitors);
    if (aiPrompts.length >= 4) {
      return aiPrompts; // Return all AI-generated prompts for UI
    }
  } catch (error) {
    console.warn('AI prompt generation failed, using fallback:', error);
  }
  
  // Fallback to static prompts
  if (!company) {
    return getGenericPrompts();
  }
  
  const serviceType = detectServiceType(company);
  return getFallbackPrompts(serviceType);
}

/**
 * Static fallback prompts when AI generation is not available
 */
function getFallbackPrompts(serviceType: string): string[] {
  const currentYear = new Date().getFullYear();
  
  if (serviceType === 'fashion brand') {
    return [
      `Best athletic wear brands in ${currentYear}?`,
      `Top sportswear brands for athletes?`,
      `Most popular sneaker brands today?`,
      `Recommended sports apparel for fitness?`
    ];
  } else if (serviceType === 'outdoor gear brand') {
    return [
      `Best outdoor gear brands in ${currentYear}?`,
      `Top outdoor equipment for camping?`,
      `Most popular outdoor brands today?`,
      `Recommended gear for outdoor adventures?`
    ];
  } else if (serviceType.includes('AI')) {
    return [
      `Best AI tools in ${currentYear}?`,
      `Top AI platforms for startups?`,
      `Most popular AI services today?`,
      `Recommended AI tools for developers?`
    ];
  } else {
    // Dynamic prompts based on service type
    return [
      `Best ${serviceType}s in ${currentYear}?`,
      `Top ${serviceType}s for startups?`,
      `Most popular ${serviceType}s today?`,
      `Recommended ${serviceType}s for professionals?`
    ];
  }
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

/**
 * Mock adaptive prompts for development/testing when no AI provider is available
 */
function getMockAdaptivePrompts(serviceType: string, targetBrand: string, competitors: string[]): string[] {
  const currentYear = new Date().getFullYear();
  
  if (serviceType === 'fashion brand') {
    return [
      `What are the best athletic shoes between ${targetBrand} and ${competitors[0]}?`,
      `Which sneaker brand offers better value: ${targetBrand} or ${competitors[1]}?`,
      `Top sportswear brands for running in ${currentYear}?`,
      `Is ${targetBrand} better than ${competitors[0]} for fitness apparel?`,
      `What are the most comfortable sneakers from ${targetBrand}?`,
      `${targetBrand} vs ${competitors[0]} vs ${competitors[1]}: which is best for athletes?`,
      `Best eco-friendly sportswear brands including ${targetBrand}?`,
      `Why choose ${targetBrand} over other athletic wear brands?`
    ];
  }
  
  // Generic adaptive-style prompts for other industries
  return [
    `What makes ${targetBrand} different from ${competitors[0]}?`,
    `Is ${targetBrand} worth it compared to ${competitors[1]}?`,
    `Best ${serviceType}s: ${targetBrand} vs competitors in ${currentYear}?`,
    `Why do people choose ${targetBrand} over ${competitors[0]}?`,
    `${targetBrand} alternatives: comparing ${competitors[0]} and ${competitors[1]}`,
    `Which is better for startups: ${targetBrand} or ${competitors[0]}?`,
    `Most recommended ${serviceType}s including ${targetBrand}?`,
    `${targetBrand} vs the competition: honest comparison`
  ];
}

/**
 * Generic prompts when no company context is available
 */
function getGenericPrompts(): string[] {
  const currentYear = new Date().getFullYear();
  return [
    `Best tools in ${currentYear}?`,
    `Top tools for startups?`,
    `Most popular tools today?`,
    `Recommended tools for developers?`
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
