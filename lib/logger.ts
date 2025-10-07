type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const isProduction = process.env.NODE_ENV === 'production';

// En production, ne loguer que les warnings et erreurs
const shouldLog = (level: LogLevel): boolean => {
  if (isProduction) {
    return level === 'warn' || level === 'error';
  }
  return true; // En développement, tout loguer
};

export const logger: Logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.log(`[DEBUG] ${sanitizeForConsole(message)}`, ...sanitizeArgs(args));
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    if (shouldLog('info')) {
      console.log(`[INFO] ${sanitizeForConsole(message)}`, ...sanitizeArgs(args));
    }
  },
  
  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${sanitizeForConsole(message)}`, ...sanitizeArgs(args));
    }
  },
  
  error: (message: string, ...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${sanitizeForConsole(message)}`, ...sanitizeArgs(args));
    }
  }
};

// Export par défaut pour faciliter l'import
export default logger;

/**
 * Supprime les caractères hors BMP (ex: emojis) pour éviter le mojibake
 * dans des consoles non-UTF-8 (ex: PowerShell avec code page legacy).
 * Conserve les accents et caractères européens.
 */
function sanitizeForConsole(input: unknown): string {
  const text = typeof input === 'string' ? input : String(input);
  // Répare d'abord les séquences mojibake (UTF-8 lu en CP1252), ex: "ðŸš€" → "🚀"
  const repaired = repairMojibakeIfNeeded(text);
  let sanitized = '';
  for (const char of repaired) {
    const codePoint = char.codePointAt(0) as number;
    // Filtrer les caractères > U+FFFF (hors BMP), typiquement emojis/symboles étendus
    if (codePoint <= 0xffff) {
      sanitized += char;
    }
  }
  return sanitized;
}

function sanitizeArgs(args: any[]): any[] {
  return args.map((arg) => (typeof arg === 'string' ? sanitizeForConsole(arg) : arg));
}

// Détecte des motifs typiques de mojibake (UTF-8 mal décodé en CP1252)
const MOJIBAKE_PATTERN = /(Ã.|Â.|ðŸ.)/;

function repairMojibakeIfNeeded(input: string): string {
  if (!MOJIBAKE_PATTERN.test(input)) return input;
  try {
    // Recompose les bytes CP1252 et redécode en UTF-8 de manière sûre côté navigateur/Node
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      bytes[i] = input.charCodeAt(i) & 0xff;
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch {
    return input;
  }
}
