/**
 * Configuration for testing different search methods
 */

export interface SearchMethodConfig {
  method: 'ai-web-search';
  useWebSearch?: boolean;
  maxResults?: number;
  useSonarReasoning?: boolean;
}

// Easy configuration presets for testing
export const SEARCH_CONFIGS = {
  // AI web search with OpenAI/Gemini search capabilities
  aiWebSearch: {
    method: 'ai-web-search' as const,
    useWebSearch: true,
    maxResults: 9
  },
  // AI search without web capabilities (knowledge-based only)
  aiKnowledge: {
    method: 'ai-web-search' as const,
    useWebSearch: false,
    maxResults: 9
  }
} as const;

/**
 * Get the appropriate API endpoint for a search method
 */
export function getApiEndpoint(method: SearchMethodConfig['method']): string {
  switch (method) {
    case 'ai-web-search':
      return '/api/competitors/ai-search';
    default:
      return '/api/competitors/ai-search';
  }
}

/**
 * Build request body for the given search method
 */
export function buildRequestBody(
  config: SearchMethodConfig,
  company: any,
  locale?: string,
  useIntelliSearch?: boolean
): Record<string, any> {
  switch (config.method) {
    case 'ai-web-search':
      return {
        company,
        maxResults: config.maxResults || 9,
        useWebSearch: config.useWebSearch ?? true,
        useSonarReasoning: useIntelliSearch ?? config.useSonarReasoning ?? false
      };
    default:
      return { 
        company, 
        maxResults: config.maxResults || 9, 
        useWebSearch: true,
        useSonarReasoning: useIntelliSearch ?? false
      };
  }
}

/**
 * Current active configuration - change this to test different methods
 */
export const ACTIVE_SEARCH_CONFIG = SEARCH_CONFIGS.aiWebSearch; // 🔬 Change this to test different approaches

// Helper function to easily switch config
export function setActiveSearchMethod(configName: keyof typeof SEARCH_CONFIGS) {
  console.log(`🔬 [SearchConfig] Switching to: ${configName}`);
  return SEARCH_CONFIGS[configName];
}
