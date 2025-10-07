/**
 * Utilities to normalize raw provider responses before downstream processing.
 * Mirrors the cleanup used on the client so brand detection and display stay aligned.
 */

interface CleanResponseOptions {
  providerName?: string;
}

/**
 * Remove provider headers, HTML artefacts, and trailing source sections so
 * detection operates on the same text that we render in the UI.
 */
export function cleanProviderResponse(text: string, options: CleanResponseOptions = {}): string {
  if (!text) {
    return '';
  }

  const { providerName } = options;
  let cleaned = text;

  // Remove standalone numbers at the beginning of lines (like "0\n")
  cleaned = cleaned.replace(/^\d+\n/gm, '');

  // Remove provider name at the beginning if it exists
  if (providerName) {
    const providerPattern = new RegExp(`^${escapeRegExp(providerName)}\\s*\n?`, 'i');
    cleaned = cleaned.replace(providerPattern, '');
  }

  // Remove common provider names at the beginning
  const commonProviders = ['OpenAI', 'Anthropic', 'Google', 'Perplexity'];
  commonProviders.forEach(provider => {
    const pattern = new RegExp(`^${escapeRegExp(provider)}\\s*\n?`, 'i');
    cleaned = cleaned.replace(pattern, '');
  });

  // Remove HTML tags but preserve the content
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Remove inline "Sources consultées" section if present
  cleaned = cleaned.replace(/\n?Sources consultées?:[\s\S]*$/i, '').trim();

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

  return cleaned.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

