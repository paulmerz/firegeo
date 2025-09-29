export function validateUrl(url: string): boolean {
  try {
    // Pre-validation checks before creating URL object
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // Trim whitespace
    url = url.trim();
    
    // Must have some content
    if (url.length === 0) {
      return false;
    }
    
    // Basic sanity checks before URL construction
    if (url.includes(' ') || url.includes('\n') || url.includes('\t')) {
      return false;
    }
    
    // Very basic format check - must contain at least one dot for domain
    if (!url.includes('.')) {
      return false;
    }
    
    // Check for obviously invalid characters
    if (/[<>"|{}\\^`\[\]]/.test(url)) {
      return false;
    }
    
    // Add protocol if missing
    const urlToTest = url.startsWith('http') ? url : `https://${url}`;
    
    // Additional safety check before URL construction
    if (urlToTest.length > 2000) { // URLs shouldn't be extremely long
      return false;
    }
    
    // Try to construct URL object
    const urlObj = new URL(urlToTest);
    
    // Basic domain validation - must have at least one dot and valid TLD
    const hostname = urlObj.hostname;
    
    if (!hostname || hostname.length === 0) {
      return false;
    }
    
    const parts = hostname.split('.');
    
    // Must have at least domain.tld format
    if (parts.length < 2) return false;
    
    // Last part (TLD) must be at least 2 characters and contain only letters
    const tld = parts[parts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
    
    // Domain parts should contain valid characters (allow numbers and hyphens)
    for (const part of parts) {
      if (!part || !/^[a-zA-Z0-9-]+$/.test(part) || part.startsWith('-') || part.endsWith('-')) {
        return false;
      }
    }
    
    return true;
  } catch (e) {
    // Log the error for debugging but don't throw
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.warn('URL validation failed for:', url, '- Error:', errorMessage);
    return false;
  }
}

export function validateCompetitorUrl(url: string): string | undefined {
  if (!url) return undefined;
  
  // Remove trailing slashes
  let cleanUrl = url.trim().replace(/\/$/, '');
  
  // Ensure the URL has a protocol
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  
  try {
    const urlObj = new URL(cleanUrl);
    const hostname = urlObj.hostname;
    
    // Return clean URL without protocol for display
    return hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
  } catch {
    return undefined;
  }
}
