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
      if (possibleLocale && routing.locales.includes(possibleLocale as any)) {
        return possibleLocale;
      }
    } catch (error) {
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
      if (routing.locales.includes(lang as any)) {
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
  if (!routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  try {
    const messages = await import(`../messages/${locale}.json`);
    return messages.default;
  } catch (error) {
    console.warn(`Failed to load messages for locale ${locale}, falling back to ${routing.defaultLocale}`);
    const fallbackMessages = await import(`../messages/${routing.defaultLocale}.json`);
    return fallbackMessages.default;
  }
}

/**
 * Get language name from locale code
 */
export function getLanguageName(locale: string): string {
  switch (locale) {
    case 'fr':
      return 'French';
    case 'en':
    default:
      return 'English';
  }
}

/**
 * Get translated text from messages object using dot notation
 */
export function getTranslation(messages: any, key: string, replacements?: Record<string, string>): string {
  const keys = key.split('.');
  let value = messages;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
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
