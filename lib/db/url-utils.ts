/**
 * URL normalization utilities for company domain management
 * Handles canonicalization of URLs to ensure consistent domain matching
 */

/**
 * Normalizes a URL to a canonical domain format
 * Extracts the base domain by removing subdomains (including www)
 * 
 * @param url - The URL to normalize (can include protocol, www, paths, etc.)
 * @returns The canonical base domain (e.g., "example.com" from "https://www.example.com/path")
 * 
 * @example
 * canonicalizeUrl("https://www.example.com/path?query=1") // "example.com"
 * canonicalizeUrl("http://example.com:8080") // "example.com"
 * canonicalizeUrl("www.example.com") // "example.com"
 * canonicalizeUrl("https://campaign.jaeger-lecoultre.com") // "jaeger-lecoultre.com"
 * canonicalizeUrl("https://api.stripe.com") // "stripe.com"
 */
export function canonicalizeUrl(url: string): string {
  try {
    // Ensure the URL has a protocol for proper parsing
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsed = new URL(normalizedUrl);
    let domain = parsed.hostname.toLowerCase();

    // Remove trailing dots
    domain = domain.replace(/\.+$/, '');

    // Extract the base domain (removes all subdomains including www)
    return extractBaseDomain(domain);
  } catch {
    // If URL parsing fails, attempt basic domain extraction
    const cleaned = url
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .split(':')[0]
      .replace(/\.+$/, '');

    // Extract the base domain from the cleaned string
    return extractBaseDomain(cleaned);
  }
}

/**
 * Extracts the base domain from a canonical domain
 * Useful for grouping subdomains
 * 
 * @param canonicalDomain - A canonical domain string
 * @returns The base domain (e.g., "example.com" from "sub.example.com")
 */
export function extractBaseDomain(canonicalDomain: string): string {
  const parts = canonicalDomain.split('.');
  
  // Handle special cases like .co.uk, .com.au, etc.
  const twoPartTlds = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'co.in', 'com.br'];
  const lastTwo = parts.slice(-2).join('.');
  
  if (twoPartTlds.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join('.');
  }
  
  // For most domains, return last two parts
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  
  return canonicalDomain;
}

/**
 * Checks if two URLs belong to the same canonical domain
 * 
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns true if both URLs resolve to the same canonical domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  return canonicalizeUrl(url1) === canonicalizeUrl(url2);
}

/**
 * Validates if a string is a valid URL or domain
 * 
 * @param url - The URL or domain to validate
 * @returns true if the URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    canonicalizeUrl(url);
    return true;
  } catch {
    return false;
  }
}
