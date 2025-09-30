import { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

/**
 * Extract locale from API request headers
 * Uses Accept-Language header and referrer to determine user's preferred locale
 */
export function getLocaleFromRequest(request: NextRequest): string {
  // Try to get locale from referrer URL first (most reliable)
  const referrer = request.headers.get('referer') || request.headers.get('referrer');
  if (referrer) {
    try {
      const url = new URL(referrer);
      const pathSegments = url.pathname.split('/');
      const possibleLocale = pathSegments[1];
      if (possibleLocale && routing.locales.some(l => l === possibleLocale)) {
        return possibleLocale;
      }
    } catch {
      // Invalid URL, continue to fallback
    }
  }

  // Fallback to Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    // Parse Accept-Language header (e.g., "fr-FR,fr;q=0.9,en;q=0.8")
    const languages = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim().toLowerCase())
      .map(lang => lang.split('-')[0]); // Extract language code only

    // Find first supported language
    for (const lang of languages) {
      if (routing.locales.some(l => l === lang)) {
        return lang;
      }
    }
  }

  // Default fallback
  return routing.defaultLocale;
}

/**
 * Load messages for a given locale
 */
export async function getMessages(locale: string) {
  // Ensure locale is supported
  if (!routing.locales.some(l => l === locale)) {
    locale = routing.defaultLocale;
  }

  try {
    const messages = await import(`../messages/${locale}.json`);
    return messages.default;
  } catch {
    console.warn(`Failed to load messages for locale ${locale}, falling back to ${routing.defaultLocale}`);
    const fallbackMessages = await import(`../messages/${routing.defaultLocale}.json`);
    return fallbackMessages.default;
  }
}

/**
 * Get language instruction from locale code
 * LLMs understand locale codes directly and can respond in any language
 */
export function getLanguageInstruction(locale: string): string {
  // For most cases, just use the locale directly - LLMs understand it
  const localeUpper = locale.toUpperCase();
  
  // Common locale mappings for clarity in prompts
  const languageMap: { [key: string]: string } = {
    'EN': 'English',
    'FR': 'French (Français)', 
    'ES': 'Spanish (Español)',
    'DE': 'German (Deutsch)',
    'IT': 'Italian (Italiano)',
    'PT': 'Portuguese (Português)',
    'NL': 'Dutch (Nederlands)',
    'RU': 'Russian (Русский)',
    'JA': 'Japanese (日本語)',
    'KO': 'Korean (한국어)',
    'ZH': 'Chinese (中文)',
    'AR': 'Arabic (العربية)',
    'HI': 'Hindi (हिन्दी)',
    'TR': 'Turkish (Türkçe)',
    'PL': 'Polish (Polski)',
    'SV': 'Swedish (Svenska)',
    'NO': 'Norwegian (Norsk)',
    'DA': 'Danish (Dansk)',
    'FI': 'Finnish (Suomi)',
    'HU': 'Hungarian (Magyar)',
    'CS': 'Czech (Čeština)',
    'SK': 'Slovak (Slovenčina)',
    'UK': 'Ukrainian (Українська)',
    'BG': 'Bulgarian (Български)',
    'RO': 'Romanian (Română)',
    'HR': 'Croatian (Hrvatski)',
    'SR': 'Serbian (Српски)',
    'SL': 'Slovenian (Slovenščina)',
    'ET': 'Estonian (Eesti)',
    'LV': 'Latvian (Latviešu)',
    'LT': 'Lithuanian (Lietuvių)',
    'MT': 'Maltese (Malti)',
    'GA': 'Irish (Gaeilge)',
    'CY': 'Welsh (Cymraeg)',
  };
  
  return languageMap[localeUpper] || `language with locale: ${locale}`;
}

/**
 * Legacy function - kept for compatibility
 * @deprecated Use getLanguageInstruction instead
 */
export function getLanguageName(locale: string): string {
  return getLanguageInstruction(locale);
}

/**
 * Get translated text from messages object using dot notation
 */
export function getTranslation(messages: Record<string, unknown>, key: string, replacements?: Record<string, string>): string {
  const keys = key.split('.');
  let value: unknown = messages;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key; // Return key as fallback
    }
  }
  
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }
  
  // Apply replacements if provided
  if (replacements) {
    return Object.entries(replacements).reduce((text, [placeholder, replacement]) => {
      return text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), replacement);
    }, value);
  }
  
  return value;
}
