import fs from 'fs';
import path from 'path';

type JsonRecord = Record<string, unknown>;

function readJsonFile(filePath: string): JsonRecord {
  const absolute = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolute, 'utf8');
  return JSON.parse(raw) as JsonRecord;
}

function flattenKeys(obj: JsonRecord, parentKey = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const composedKey = parentKey ? `${parentKey}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value as JsonRecord, composedKey));
    } else {
      result[composedKey] = value as unknown;
    }
  }
  return result;
}

function main(): void {
  // Liste des locales à vérifier (en est la référence)
  const locales = ['en', 'fr', 'de'];
  const referenceLocale = 'en';
  
  // Charger tous les fichiers de traduction
  const translations: Record<string, JsonRecord> = {};
  const flatTranslations: Record<string, Record<string, unknown>> = {};
  
  for (const locale of locales) {
    try {
      translations[locale] = readJsonFile(`messages/${locale}.json`);
      flatTranslations[locale] = flattenKeys(translations[locale]);
    } catch (error) {
      console.error(`❌ Erreur lors de la lecture de ${locale}.json:`, error);
      process.exit(1);
    }
  }

  const referenceKeys = new Set(Object.keys(flatTranslations[referenceLocale]));
  let hasError = false;

  // Vérifier chaque locale par rapport à la référence
  for (const locale of locales) {
    if (locale === referenceLocale) continue;

    const localeKeys = new Set(Object.keys(flatTranslations[locale]));
    const missingKeys: string[] = [];
    const extraKeys: string[] = [];
    const emptyValues: string[] = [];

    for (const k of referenceKeys) {
      if (!localeKeys.has(k)) missingKeys.push(k);
    }
    for (const k of localeKeys) {
      if (!referenceKeys.has(k)) extraKeys.push(k);
    }

    emptyValues.push(
      ...Object.entries(flatTranslations[locale])
        .filter(([, v]) => v === '' || v === null || v === undefined)
        .map(([k]) => k)
    );

    if (missingKeys.length > 0) {
      hasError = true;
      console.error(`\n❌ Clés manquantes dans ${locale}.json (vs ${referenceLocale}.json):\n- ${missingKeys.join('\n- ')}`);
    }
    if (extraKeys.length > 0) {
      hasError = true;
      console.error(`\n❌ Clés supplémentaires dans ${locale}.json absentes de ${referenceLocale}.json:\n- ${extraKeys.join('\n- ')}`);
    }
    if (emptyValues.length > 0) {
      console.warn(`\n⚠️  Clés avec valeurs vides dans ${locale}.json:\n- ${emptyValues.join('\n- ')}`);
    }
  }

  if (hasError) {
    console.error('\n❌ Vérification i18n échouée.');
    process.exit(1);
  } else {
    console.log(`\n✅ Vérification i18n OK: les clés correspondent entre ${locales.join(', ')}.`);
  }
}

main();


