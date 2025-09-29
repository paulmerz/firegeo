import { BrandPrompt, Company } from './types';

function deriveFocusDescriptor(company: Company): string {
  const candidates: (string | undefined)[] = [
    company.businessProfile?.marketSegment,
    company.businessProfile?.businessType,
    company.scrapedData?.mainProducts?.[0],
    company.scrapedData?.keywords?.[0],
    company.industry,
    company.description,
  ];

  const cleaned = candidates
    .map(value => value?.toLowerCase().trim())
    .filter((value): value is string => Boolean(value));

  if (cleaned.length === 0) {
    return 'solutions';
  }

  const descriptor = cleaned[0]
    .split(/[\.;,!]/)[0]
    .replace(/^[^a-z0-9]+/i, '')
    .trim();

  const words = descriptor.split(/\s+/).slice(0, 6).join(' ').trim();
  return words || 'solutions';
}

export function buildFallbackPromptStrings(company: Company, competitors: string[] = []): string[] {
  const focus = deriveFocusDescriptor(company);
  const brandName = company.name || 'the brand';
  const year = new Date().getFullYear();
  const primaryCompetitor = competitors[0] || 'other leading brands';
  const secondaryCompetitor = competitors[1] || primaryCompetitor;

  const comparisonLabel = competitors.length >= 2
    ? `${competitors[0]} vs ${secondaryCompetitor}`
    : `${brandName} vs ${primaryCompetitor}`;

  return [
    `Which ${focus} are considered the best in ${year}?`,
    `${comparisonLabel}: which option is stronger for ${focus}?`,
    `What are strong alternatives to ${brandName} for ${focus}?`,
    `Is ${brandName} a good choice when evaluating ${focus}?`,
  ].map(prompt => prompt.replace(/\s+/g, ' ').trim());
}

function mapPromptCategory(index: number): BrandPrompt['category'] {
  const categories: BrandPrompt['category'][] = ['ranking', 'comparison', 'alternatives', 'recommendations'];
  return categories[index % categories.length];
}

export function createFallbackBrandPrompts(company: Company, competitors: string[] = []): BrandPrompt[] {
  const prompts = buildFallbackPromptStrings(company, competitors);

  return prompts.map((prompt, index) => ({
    id: `fallback-${index + 1}`,
    prompt,
    category: mapPromptCategory(index),
  }));
}

export function createDevelopmentMockPrompts(company: Company, targetBrand: string, competitors: string[]): string[] {
  const focus = deriveFocusDescriptor(company);
  const year = new Date().getFullYear();
  const primaryCompetitor = competitors[0] || 'leading alternatives';
  const secondaryCompetitor = competitors[1] || 'other options';

  const templates = [
    `What makes ${targetBrand} stand out among ${focus} in ${year}?`,
    `${targetBrand} vs ${primaryCompetitor}: which ${focus} is better suited to customers?`,
    `Compare ${targetBrand}, ${primaryCompetitor}, and ${secondaryCompetitor} for ${focus}.`,
    `Best ${focus} alternatives to ${targetBrand} right now.`,
    `Why do teams choose ${targetBrand} over ${primaryCompetitor}?`,
    `How do reviewers rate ${targetBrand} compared to ${primaryCompetitor}?`,
    `Which ${focus} deliver the best experience in ${year}?`,
    `Is ${targetBrand} still a top recommendation for ${focus}?`,
  ];

  return templates
    .map(prompt => prompt.replace(/\s+/g, ' ').trim())
    .filter((prompt, index, arr) => arr.indexOf(prompt) === index)
    .slice(0, 8);
}
