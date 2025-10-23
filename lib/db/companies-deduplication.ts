/**
 * Company deduplication utilities
 * Handles intelligent matching of companies to avoid duplicates
 */

import { canonicalizeUrl, extractBaseDomain } from './url-utils';

/**
 * Extracts a brand name from a domain
 * e.g., "rolex.com" → "Rolex", "apple.fr" → "Apple"
 */
export function extractBrandNameFromDomain(domain: string): string {
  const canonical = canonicalizeUrl(domain);
  
  // Get the main part (before TLD)
  // rolex.com → rolex
  // rolex.co.uk → rolex
  const baseDomain = extractBaseDomain(canonical);
  const mainPart = baseDomain.split('.')[0];
  
  // Capitalize first letter
  return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
}

/**
 * Normalizes a company name for matching
 * Removes common suffixes, lowercases, removes special chars
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes
    .replace(/\s+(inc|llc|ltd|limited|corp|corporation|sa|sas|gmbh)\.?$/i, '')
    // Remove special characters but keep spaces
    .replace(/[^a-z0-9\s]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two company names are likely the same company
 * Uses normalized comparison
 */
export function isSameCompany(name1: string, name2: string): boolean {
  const normalized1 = normalizeCompanyName(name1);
  const normalized2 = normalizeCompanyName(name2);
  
  return normalized1 === normalized2;
}

/**
 * Checks if two domains likely belong to the same company
 * e.g., rolex.fr and rolex.com → true
 */
export function isSameDomainBase(url1: string, url2: string): boolean {
  const base1 = extractBaseDomain(canonicalizeUrl(url1));
  const base2 = extractBaseDomain(canonicalizeUrl(url2));
  
  // Extract the brand part (before TLD)
  const brand1 = base1.split('.')[0];
  const brand2 = base2.split('.')[0];
  
  return brand1 === brand2;
}

/**
 * Calculates a similarity score between two strings (0-1)
 * Uses Levenshtein-like approach
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeCompanyName(str1);
  const s2 = normalizeCompanyName(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Simple approach: check if one is contained in the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
  }
  
  // Calculate character overlap
  const set1 = new Set(s1.split(''));
  const set2 = new Set(s2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

