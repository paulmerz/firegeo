import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // This can either be defined statically at the top level or within
  // the function. Lazy loading in the function is useful if you want
  // to implement locale-based code splitting.
  let locale = await requestLocale;

  // Normalize region-specific Swiss locales to base language for messages
  const localeForMessages =
    locale === 'fr-CH' ? 'fr' : locale === 'de-CH' ? 'de' : locale;

  // Ensure that a valid locale is used
  if (!routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${localeForMessages}.json`)).default
  };
});
