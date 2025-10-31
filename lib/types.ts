export interface CompanyAnalysis {
  url: string;
  companyName: string;
  description: string;
  mainTopics: string[];
  generatedPrompts: string[];
}

export interface LLMProvider {
  id: string;
  name: string;
  model: string;
  enabled: boolean;
}

export interface PromptResult {
  provider: string;
  prompt: string;
  response: string;
  mentions: {
    companyName: string;
    mentioned: boolean;
    context?: string;
    position?: number;
  }[];
  timestamp: Date;
}

export interface CompetitorAnalysis {
  competitor: string;
  visibilityScore: number;
  mentionCount: number;
  averagePosition: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  shareOfVoice: number;
  weeklyChange?: number;
  rankChange?: number;
}

export interface BrandVisibilityReport {
  company: string;
  url: string;
  overallVisibilityScore: number;
  promptsAnalyzed: number;
  competitorComparison: CompetitorAnalysis[];
  detailedResults: PromptResult[];
  shareOfVoice: number;
  analyzedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  url: string;
  originalUrl?: string; // NOUVEAU: URL originale saisie par l'utilisateur
  description?: string;
  industry?: string;
  logo?: string;
  favicon?: string;
  scraped?: boolean;
  scrapedData?: {
    title: string;
    description: string;
    keywords: string[];
    mainContent: string;
    mainProducts?: string[];
    competitors?: string[];
    ogImage?: string;
    favicon?: string;
    // Additional metadata from scraping
    ogTitle?: string;
    ogDescription?: string;
    metaKeywords?: string[];
    rawMetadata?: Record<string, unknown>;
  };
  // Business profile
  businessProfile?: {
    businessType: string;
    marketSegment: string;
    targetCustomers: string;
    primaryMarkets: string[];
    technologies: string[];
    businessModel: string;
    confidenceScore: number;
  };
}

export interface AIProvider {
  name: string;
  model: string;
  icon?: string;
}

export interface BrandPrompt {
  id: string;
  prompt: string;
  category: 'ranking' | 'comparison' | 'alternatives' | 'recommendations' | 'custom';
}

export interface AIResponse {
  provider: string;
  prompt: string;
  response: string;
  timestamp: Date;
  urls?: { url: string; title?: string; start_index?: number; end_index?: number }[];
}

// New: structured analysis separate from raw response
export interface AIResponseAnalysis {
  provider: string;
  response: string;
  rankings: CompanyRanking[];
  brandMentioned: boolean;
  competitors: string[];
  brandPosition?: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

// Mock control for tests via request header
export type MockMode = 'none' | 'raw';

export interface AnalysisSource {
  id?: string;
  analysisId?: string;
  provider?: string;
  prompt?: string;
  domain?: string;
  url?: string;
  title?: string;
  sourceType?: string;
  metadata?: Record<string, unknown> | null;
  rank?: number;
  createdAt?: string;
}


export interface CompanyRanking {
  position: number | null;
  company: string;
  reason?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface BrandAnalysis {
  company: Company;
  prompts: BrandPrompt[];
  responses: AIResponse[];
  brandVariations?: Record<string, BrandVariation>;
  competitors: CompetitorRanking[];
  providerRankings?: ProviderSpecificRanking[];
  providerComparison?: ProviderComparisonData[];
  overallScore: number;
  visibilityScore: number;
  sentimentScore: number;
  shareOfVoice: number;
  averagePosition?: number;
  historicalData?: HistoricalDataPoint[];
}

export interface HistoricalDataPoint {
  date: Date;
  visibilityScore: number;
  position: number;
}

// Types pour les graphiques de tendances
export interface MetricDataPoint {
  runId: string;
  date: Date;
  value: number;
}

export interface CompetitorMetricSeries {
  competitor: string;
  provider: string;
  isOwn: boolean;
  dataPoints: MetricDataPoint[];
}

export interface MetricsHistoryResponse {
  metricType: string;
  series: CompetitorMetricSeries[];
}

// SSE Event Types
export type SSEEventType = 
  | 'start'
  | 'progress'
  | 'stage'
  | 'competitor-found' // Legacy event type, kept for backward compatibility
  | 'prompt-generated'
  | 'analysis-start'
  | 'analysis-progress'
  | 'analysis-complete'
  | 'scoring-start'
  | 'scoring-complete'
  | 'brand-extraction-start'
  | 'brand-extraction-progress'
  | 'brand-extraction-complete'
  | 'partial-result'
  | 'credits'
  | 'complete'
  | 'error';

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  stage: AnalysisStage;
  data: T;
  timestamp: Date;
}

export type AnalysisStage = 
  | 'initializing'
  | 'identifying-competitors' // Legacy stage, kept for backward compatibility
  | 'generating-brand-variations'
  | 'generating-prompts'
  | 'analyzing-prompts'
  | 'extracting-brands'
  | 'calculating-scores'
  | 'finalizing';

export interface ProgressData {
  stage: AnalysisStage;
  progress: number; // 0-100
  message: string;
  details?: unknown;
}

export interface CompetitorFoundData {
  competitor: string;
  index: number;
  total: number;
}

export interface PromptGeneratedData {
  prompt: string;
  category: string;
  index: number;
  total: number;
}

export interface AnalysisProgressData {
  provider: string;
  prompt: string;
  promptIndex: number;
  totalPrompts: number;
  providerIndex: number;
  totalProviders: number;
  status: 'started' | 'completed' | 'failed';
}

export interface PartialResultData {
  provider: string;
  prompt: string;
  response: Partial<AIResponseAnalysis>;
  competitorScores?: Partial<CompetitorRanking>[];
}

export interface ScoringProgressData {
  competitor: string;
  score?: number;
  index: number;
  total: number;
}

export interface ErrorData {
  message: string;
  code?: string;
  stage: AnalysisStage;
  retryable?: boolean;
}

export interface BrandExtractionProgressData {
  stage: 'extracting-brands';
  provider: string;
  responseIndex: number;
  totalResponses: number;
  progress: number;
  message: string;
}

// Progress callback type for AI utils
export type ProgressCallback = (event: SSEEvent) => void;

export interface CompetitorRanking {
  name: string;
  logo?: string;
  mentions: number;
  averagePosition: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  shareOfVoice: number;
  visibilityScore: number;
  weeklyChange?: number;
  isOwn?: boolean;
}

export interface ProviderSpecificRanking {
  provider: string;
  competitors: CompetitorRanking[];
}

export interface ProviderComparisonData {
  competitor: string;
  providers: {
    [provider: string]: {
      visibilityScore: number;
      position: number;
      mentions: number;
      sentiment: 'positive' | 'neutral' | 'negative';
    };
  };
  isOwn?: boolean;
}

// AI_PROVIDERS moved to provider-config.ts for centralized management

export const PROMPT_TEMPLATES = {
  ranking: [
    "What are the top 10 {industry} tools in 2024?",
    "List the best {industry} platforms available today",
    "What are the most popular {industry} solutions?",
    "Rank the top {industry} services by features and capabilities",
    "What are the leading {industry} companies?",
  ],
  comparison: [
    "Compare the top 5 {industry} tools including {brand}",
    "How do the major {industry} platforms compare?",
    "What are the pros and cons of different {industry} solutions?",
  ],
  alternatives: [
    "What are the best alternatives to {brand}?",
    "List similar tools to {brand} for {industry}",
    "What other {industry} options are available besides {brand}?",
  ],
  recommendations: [
    "Which {industry} tool would you recommend for businesses?",
    "What's the best {industry} solution for enterprise use?",
    "Which {industry} platform offers the best value?",
  ],
}; 

export interface BrandVariation {
  original: string;
  variations: string[];
  confidence: number;
} 