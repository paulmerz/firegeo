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
  const en = readJsonFile('messages/en.json');
  const fr = readJsonFile('messages/fr.json');

  const flatEn = flattenKeys(en);
  const flatFr = flattenKeys(fr);

  const enKeys = new Set(Object.keys(flatEn));
  const frKeys = new Set(Object.keys(flatFr));

  const missingInFr: string[] = [];
  const missingInEn: string[] = [];

  for (const k of enKeys) {
    if (!frKeys.has(k)) missingInFr.push(k);
  }
  for (const k of frKeys) {
    if (!enKeys.has(k)) missingInEn.push(k);
  }

  const emptyFrValues: string[] = Object.entries(flatFr)
    .filter(([_, v]) => v === '' || v === null || v === undefined)
    .map(([k]) => k);

  let hasError = false;
  if (missingInFr.length > 0) {
    hasError = true;
    console.error(`Clés manquantes dans fr.json (vs en.json):\n- ${missingInFr.join('\n- ')}`);
  }
  if (missingInEn.length > 0) {
    hasError = true;
    console.error(`Clés supplémentaires dans fr.json absentes de en.json:\n- ${missingInEn.join('\n- ')}`);
  }
  if (emptyFrValues.length > 0) {
    console.warn(`Clés avec valeurs vides dans fr.json:\n- ${emptyFrValues.join('\n- ')}`);
  }

  if (hasError) {
    process.exit(1);
  } else {
    console.log('Vérification i18n OK: les clés correspondent entre en.json et fr.json.');
  }
}

main();


