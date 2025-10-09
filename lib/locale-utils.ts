import { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import enMessages from '../messages/en.json';
import frMessages from '../messages/fr.json';
import deMessages from '../messages/de.json';

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
    // Parse Accept-Language header (e.g., "fr-CH,fr;q=0.9,de-CH;q=0.8") en conservant la région
    const candidates = acceptLanguage
      .split(',')
      .map(item => item.split(';')[0].trim().toLowerCase());

    // 1) Chercher une correspondance exacte (incluant fr-CH / de-CH)
    for (const cand of candidates) {
      if (routing.locales.some(l => l.toLowerCase() === cand)) {
        return cand;
      }
    }

    // 2) Sinon, réduire à la langue et chercher une correspondance (fr, de, en)
    for (const cand of candidates) {
      const base = cand.split('-')[0];
      if (routing.locales.some(l => l === base)) {
        return base;
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
  // Normaliser la locale et mapper les variantes CH vers les bases
  const normalized = routing.locales.some(l => l === locale) ? locale : routing.defaultLocale;
  const base = normalized === 'fr-CH' ? 'fr' : normalized === 'de-CH' ? 'de' : normalized;

  // Import statique pour compatibilité Turbopack/HMR
  switch (base) {
    case 'fr':
      return frMessages as Record<string, unknown>;
    case 'de':
      return deMessages as Record<string, unknown>;
    case 'en':
    default:
      return enMessages as Record<string, unknown>;
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
 * Return a BCP-47 locale for number/currency formatting.
 * Keeps region when provided (e.g., fr-CH, de-CH) to get Swiss rules.
 */
export function getFormattingLocale(locale: string): string {
  // Prefer exact locale tag if present, else fall back to language only
  if (routing.locales.includes(locale as (typeof routing.locales)[number])) return locale;
  const language = locale.split('-')[0];
  return routing.locales.includes(language as (typeof routing.locales)[number]) ? language : routing.defaultLocale;
}

/**
 * Format a currency amount based on the UI locale.
 * - Uses CHF by default for fr-CH/de-CH, otherwise requires explicit currency.
 */
export function formatCurrency(amount: number, locale: string, currency?: string): string {
  const isSwiss = locale === 'fr-CH' || locale === 'de-CH';
  const resolvedCurrency = currency || (isSwiss ? 'CHF' : 'EUR');
  const formattingLocale = getFormattingLocale(locale);
  return new Intl.NumberFormat(formattingLocale, {
    style: 'currency',
    currency: resolvedCurrency,
    currencyDisplay: 'symbol'
  }).format(amount);
}

/**
 * Mappe la locale UI vers la locale Stripe Checkout attendue.
 * Stripe accepte des BCP-47 standards; on force les variantes suisses.
 */
export function getStripeCheckoutLocale(uiLocale: string): string {
  // Liste des locales supportées par Stripe (extraites de la doc)
  const supported = new Set([
    'auto','bg','cs','da','de','el','en','en-GB','es','es-419','et','fi','fil','fr','fr-CA','hr','hu','id','it','ja','ko','lt','lv','ms','mt','nb','nl','pl','pt','pt-BR','ro','ru','sk','sl','sv','th','tr','vi','zh','zh-HK','zh-TW'
  ]);

  // Normaliser les variantes suisses vers la langue de base supportée
  if (uiLocale === 'fr-CH') return 'fr';
  if (uiLocale === 'de-CH') return 'de';

  // Si déjà supportée, retourner tel quel
  if (supported.has(uiLocale)) return uiLocale;

  // Retenter avec la langue de base
  const base = uiLocale.split('-')[0];
  if (supported.has(base)) return base;

  // Fallback raisonnable
  return 'en';
}

/**
 * Devise par défaut selon la locale UI.
 * - fr-CH / de-CH => CHF
 * - sinon => EUR (par défaut) sauf override explicite.
 */
export function getCurrencyForLocale(uiLocale: string): 'CHF' | 'EUR' {
  return uiLocale === 'fr-CH' || uiLocale === 'de-CH' ? 'CHF' : 'EUR';
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
