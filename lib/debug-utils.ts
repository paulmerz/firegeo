/**
 * Utilitaires de debug pour identifier les problèmes de configuration
 */

export interface DebugInfo {
  timestamp: string;
  environment: string;
  nodeVersion: string;
  platform: string;
  envVars: {
    required: Record<string, boolean>;
    optional: Record<string, boolean>;
  };
  providers: {
    name: string;
    configured: boolean;
    hasKey: boolean;
  }[];
  database?: {
    connected: boolean;
    error?: string;
  };
  firecrawl?: {
    connected: boolean;
    error?: string;
  };
}

export function getEnvironmentDebugInfo(): Partial<DebugInfo> {
  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    nodeVersion: process.version,
    platform: process.platform,
    envVars: {
      required: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
        NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
        AUTUMN_SECRET_KEY: !!process.env.AUTUMN_SECRET_KEY,
      },
      optional: {
        FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        PERPLEXITY_API_KEY: !!process.env.PERPLEXITY_API_KEY,
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
        GOOGLE_SEARCH_API_KEY: !!process.env.GOOGLE_SEARCH_API_KEY,
        GOOGLE_SEARCH_ENGINE_ID: !!process.env.GOOGLE_SEARCH_ENGINE_ID,
      }
    },
    providers: [
      { name: 'OpenAI', configured: !!process.env.OPENAI_API_KEY, hasKey: !!process.env.OPENAI_API_KEY },
      { name: 'Anthropic', configured: !!process.env.ANTHROPIC_API_KEY, hasKey: !!process.env.ANTHROPIC_API_KEY },
      { name: 'Google', configured: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY, hasKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY },
      { name: 'Perplexity', configured: !!process.env.PERPLEXITY_API_KEY, hasKey: !!process.env.PERPLEXITY_API_KEY },
      { name: 'Firecrawl', configured: !!process.env.FIRECRAWL_API_KEY, hasKey: !!process.env.FIRECRAWL_API_KEY },
    ]
  };
}

export function logDebugInfo(context: string, info: Partial<DebugInfo>) {
  // Ne loguer qu'en développement ou si explicitement demandé
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔍 [${context}] Debug Info:`, JSON.stringify(info, null, 2));
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('network') || 
         message.includes('timeout') || 
         message.includes('connection') ||
         message.includes('fetch') ||
         message.includes('enotfound') ||
         message.includes('econnrefused');
}

export function isApiKeyError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('api key') || 
         message.includes('unauthorized') ||
         message.includes('authentication') ||
         message.includes('invalid key') ||
         message.includes('not configured');
}

export function isRateLimitError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('rate limit') || 
         message.includes('too many requests') ||
         message.includes('quota exceeded');
}

export function getErrorCategory(error: unknown): 'network' | 'api_key' | 'rate_limit' | 'validation' | 'unknown' {
  if (isNetworkError(error)) return 'network';
  if (isApiKeyError(error)) return 'api_key';
  if (isRateLimitError(error)) return 'rate_limit';
  if (error instanceof Error && error.name === 'ValidationError') return 'validation';
  return 'unknown';
}

export function getErrorRecommendation(error: unknown): string {
  const category = getErrorCategory(error);
  
  switch (category) {
    case 'network':
      return 'Vérifiez votre connexion internet et réessayez. Si le problème persiste, il peut y avoir un problème de réseau ou de firewall.';
    case 'api_key':
      return 'Vérifiez que toutes les clés API requises sont configurées dans votre fichier .env.local';
    case 'rate_limit':
      return 'Vous avez atteint la limite de requêtes. Attendez quelques minutes avant de réessayer.';
    case 'validation':
      return 'Les données fournies ne sont pas valides. Vérifiez l\'URL et réessayez.';
    default:
      return 'Une erreur inattendue s\'est produite. Consultez les logs pour plus de détails.';
  }
}



