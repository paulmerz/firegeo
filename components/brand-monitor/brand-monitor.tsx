'use client';

import React, { useReducer, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Company, ProviderSpecificRanking } from '@/lib/types';
import type { BrandAnalysisWithSources } from '@/lib/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { ClientApiError } from '@/lib/client-errors';
import { 
  brandMonitorReducer, 
  initialBrandMonitorState,
  IdentifiedCompetitor,
  PromptCompletionStatus,
  PromptStatus,
  Analysis
} from '@/lib/brand-monitor-reducer';
import {
  validateUrl,
  validateCompetitorUrl
} from '@/lib/brand-monitor-utils';
import { getEnabledProviders } from '@/lib/provider-config';
import { useSaveBrandAnalysis } from '@/hooks/useBrandAnalyses';

// Components
import { UrlInputSection } from './url-input-section';
import { CompanyCard } from './company-card';
import { AnalysisProgressSection } from './analysis-progress-section';
import { ResultsNavigation } from './results-navigation';
import { PromptsResponsesTab } from './prompts-responses-tab';
import { VisibilityScoreTab } from './visibility-score-tab';
import { SourcesTab } from './sources-tab';
import { ErrorMessage } from './error-message';
import { AddPromptModal } from './modals/add-prompt-modal';
import { AddCompetitorModal } from './modals/add-competitor-modal';
import { ProviderComparisonMatrix } from './provider-comparison-matrix';
import { ProviderRankingsTabs } from './provider-rankings-tabs';
import { WebSearchToggle } from './web-search-toggle';
import { logger } from '@/lib/logger';
import { extractAnalysisSources } from '@/lib/brand-monitor-sources';
import { ApiUsageSummary, ApiUsageSummaryData } from './api-usage-summary';
import {
  CREDIT_COST_URL_ANALYSIS,
  CREDIT_COST_COMPETITOR_ANALYSIS,
  CREDIT_COST_PER_PROMPT_ANALYSIS_WEB,
  CREDIT_COST_PER_PROMPT_ANALYSIS_NO_WEB,
  CREDIT_COST_PROMPT_GENERATION
} from '@/config/constants';

// Hooks
import { useSSEHandler } from './hooks/use-sse-handler';

// Dev flag to restrict certain UI elements to local/dev only
const isDev = process.env.NODE_ENV === 'development';

interface BrandMonitorProps {
  creditsAvailable?: number;
  onCreditsUpdate?: () => void;
  selectedAnalysis?: BrandAnalysisWithSources | null;
  onSaveAnalysis?: (analysis: BrandAnalysisWithSources) => void;
  hideSourcesTab?: boolean;
  hideWebSearchSources?: boolean;
}

interface CompetitorSearchResponse {
  success: boolean;
  competitors: Array<{ name: string; url?: string | null }>;
  stats?: unknown;
  warning?: string;
}

type RawCompany = Omit<Company, 'id' | 'name' | 'url'> & {
  id?: string;
  name?: string;
  url?: string;
};

interface ScrapeResponse {
  company: RawCompany;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAnalysisPayload(value: unknown): value is Analysis {
  if (!isRecord(value)) {
    return false;
  }

  const candidate = value as Partial<Analysis>;
  return (
    isRecord(candidate.company) &&
    Array.isArray(candidate.competitors) &&
    Array.isArray(candidate.prompts) &&
    Array.isArray(candidate.responses) &&
    isRecord(candidate.scores)
  );
}

function normalizeScrapedCompany(input: RawCompany): Company {
  const url = input.url?.trim();
  if (!url) {
    throw new Error('Scraped company is missing a URL');
  }

  const name = (input.name ?? url).trim() || url;
  const id = input.id ?? url;

  return {
    id,
    name,
    url,
    description: input.description,
    industry: input.industry,
    logo: input.logo,
    favicon: input.favicon,
    scraped: input.scraped,
    scrapedData: input.scrapedData,
    businessProfile: input.businessProfile,
  };
}

function buildCompanyFromSelection(
  selection: BrandAnalysisWithSources,
  analysisData?: Analysis | null
): Company | null {
  const reference = analysisData?.company;
  const url = reference?.url ?? selection.url;
  if (!url) {
    return reference ?? null;
  }

  const name = reference?.name ?? selection.companyName ?? url;
  const id = reference?.id ?? selection.id ?? url;

  return {
    id,
    name,
    url,
    description: reference?.description,
    industry: reference?.industry ?? selection.industry ?? undefined,
    logo: reference?.logo,
    favicon: reference?.favicon,
    scraped: reference?.scraped,
    scrapedData: reference?.scrapedData,
    businessProfile: reference?.businessProfile,
  };
}

export function BrandMonitor({ 
  creditsAvailable = 0, 
  onCreditsUpdate,
  selectedAnalysis,
  onSaveAnalysis,
  hideSourcesTab = false,
  hideWebSearchSources = false,
}: BrandMonitorProps = {}) {
  const tErrors = useTranslations('brandMonitor.errors');
  const tAnalysis = useTranslations('brandMonitor.analysis');
  const [state, dispatch] = useReducer(brandMonitorReducer, initialBrandMonitorState);
  const saveAnalysis = useSaveBrandAnalysis();
  const hasSavedRef = useRef(false);
  const [isRefreshingMatrix, setIsRefreshingMatrix] = useState(false);
  const [apiUsageSummary, setApiUsageSummary] = useState<ApiUsageSummaryData | null>(null);
  
  const { startSSEConnection } = useSSEHandler({ 
    state, 
    dispatch, 
    onCreditsUpdate,
    onAnalysisComplete: (completedAnalysis) => {
      // Only save if this is a new analysis (not loaded from existing)
      if (!selectedAnalysis && !hasSavedRef.current) {
        hasSavedRef.current = true;
        
        const normalizedSources = extractAnalysisSources(completedAnalysis);
        const normalizedAnalysis = {
          ...completedAnalysis,
          sources: normalizedSources,
        };

        const analysisData: Partial<BrandAnalysisWithSources> = {
          url: company?.url || url,
          companyName: company?.name,
          industry: company?.industry,
          analysisData: normalizedAnalysis,
          competitors: identifiedCompetitors,
          prompts: analyzingPrompts,
          creditsUsed: (completedAnalysis?.prompts?.length || 0) * (useWebSearch ? CREDIT_COST_PER_PROMPT_ANALYSIS_WEB : CREDIT_COST_PER_PROMPT_ANALYSIS_NO_WEB),
        };

        saveAnalysis.mutate(analysisData, {
          onSuccess: (savedAnalysis: BrandAnalysisWithSources) => {
            logger.info('Analysis saved successfully:', savedAnalysis);
            if (onSaveAnalysis) {
              onSaveAnalysis(savedAnalysis);
            }
          },
          onError: (error: unknown) => {
            logger.error('Failed to save analysis:', error);
            hasSavedRef.current = false;
          }
        });
      }
    },
    onApiUsageSummary: (summary) => {
      setApiUsageSummary(summary);
    }
  });
  
  // Extract state for easier access
  const {
    url,
    urlValid,
    error,
    loading,
    analyzing,
    preparingAnalysis,
    company,
    showInput,
    showCompanyCard,
    showPromptsList,
    showCompetitors,
    customPrompts,
    removedDefaultPrompts,
    identifiedCompetitors,
    analysisProgress,
    promptCompletionStatus,
    analyzingPrompts,
    analysis,
    activeResultsTab,
    expandedPromptIndex,
    showAddPromptModal,
    showAddCompetitorModal,
    newPromptText,
    newCompetitorName,
    newCompetitorUrl,
    scrapingCompetitors,
    useWebSearch,
    useIntelliSearch
  } = state;
  const displaySources = useMemo(() => {
    const persisted = selectedAnalysis?.sources ?? null;

    if (analysis) {
      return extractAnalysisSources(analysis, persisted);
    }

    if (selectedAnalysis?.analysisData) {
      return extractAnalysisSources(selectedAnalysis.analysisData, persisted);
    }

    if (persisted) {
      return extractAnalysisSources(undefined, persisted);
    }

    return [];
  }, [analysis, selectedAnalysis]);

  // Remove the auto-save effect entirely - we'll save manually when analysis completes
  
  // Load selected analysis if provided or reset when null
  useEffect(() => {
    logger.debug('[BrandMonitor] selectedAnalysis changed:', selectedAnalysis);

    if (selectedAnalysis === null) {
      logger.info('[BrandMonitor] Resetting state for new analysis');
      dispatch({ type: 'RESET_STATE' });
      hasSavedRef.current = false;
      return;
    }

    if (!selectedAnalysis) {
      return;
    }

    logger.info('[BrandMonitor] Loading existing analysis');
    const analysisPayload = isAnalysisPayload(selectedAnalysis.analysisData)
      ? selectedAnalysis.analysisData
      : null;

    if (analysisPayload) {
      dispatch({ type: 'SET_ANALYSIS', payload: analysisPayload });
    } else if (selectedAnalysis.analysisData) {
      logger.warn('[BrandMonitor] Selected analysis data had unexpected shape; skipping load');
    }

    const restoredCompany = buildCompanyFromSelection(selectedAnalysis, analysisPayload);
    if (restoredCompany) {
      dispatch({ type: 'SCRAPE_SUCCESS', payload: restoredCompany });
    }
  }, [selectedAnalysis]);
  
  // Handlers
  const handleUrlChange = useCallback((newUrl: string) => {
    dispatch({ type: 'SET_URL', payload: newUrl });
    
    // Clear any existing error when user starts typing
    if (error) {
      dispatch({ type: 'SET_ERROR', payload: null });
    }
    
    // Validate URL on change
    if (newUrl.length > 0) {
      const isValid = validateUrl(newUrl);
      dispatch({ type: 'SET_URL_VALID', payload: isValid });
    } else {
      dispatch({ type: 'SET_URL_VALID', payload: null });
    }
  }, [error]);
  
  const handleScrape = useCallback(async () => {
    if (!url) {
      dispatch({ type: 'SET_ERROR', payload: tErrors('pleaseEnterUrl') });
      return;
    }

    // Validate URL
    if (!validateUrl(url)) {
      dispatch({ type: 'SET_ERROR', payload: tErrors('pleaseEnterValidUrl') });
      dispatch({ type: 'SET_URL_VALID', payload: false });
      return;
    }

    // Check if user has enough credits for initial scrape
    if (creditsAvailable < CREDIT_COST_URL_ANALYSIS) {
      dispatch({ type: 'SET_ERROR', payload: tErrors('insufficientCreditsUrl', { credits: CREDIT_COST_URL_ANALYSIS }) });
      return;
    }

    logger.info('Starting scrape for URL:', url);
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_URL_VALID', payload: true });
    
    try {
      const response = await fetch('/api/brand-monitor/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week in milliseconds
          useDeepCrawl: false // Temporarily disabled
        }),
      });

      logger.debug('Scrape response status:', response.status);

      if (!response.ok) {
        try {
          const errorData = await response.json();
          logger.error('Scrape API error:', errorData);
          if (errorData.error?.message) {
            throw new ClientApiError(errorData);
          }
          throw new Error(errorData.error || tErrors('failedToScrape'));
        } catch (innerError) {
          if (innerError instanceof ClientApiError) throw innerError;
          throw new Error(tErrors('failedToScrape'));
        }
      }

      const data: ScrapeResponse = await response.json();
      logger.debug('Scrape data received:', data);

      if (!data?.company) {
        throw new Error(tErrors('noCompanyData'));
      }

      const scrapedCompany = normalizeScrapedCompany(data.company);
      // Debit for URL analysis on successful scrape result
      try {
        const debitRes = await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: CREDIT_COST_URL_ANALYSIS, reason: 'scrape_success' })
        });
        if (!debitRes.ok) {
          const err = (await debitRes.json().catch(() => null)) as { error?: string } | null;
          logger.warn('[Credits] Debit on scrape_success failed:', err?.error || debitRes.statusText);
        } else if (onCreditsUpdate) {
          onCreditsUpdate();
        }
      } catch (creditError) {
        logger.warn('[Credits] Debit on scrape_success error:', creditError);
      }
      
      // Scrape was successful - credits have been deducted, refresh the navbar
      if (onCreditsUpdate) {
        onCreditsUpdate();
      }
      
      // Start fade out transition
      dispatch({ type: 'SET_SHOW_INPUT', payload: false });
      
      // After fade out completes, set company and show card with fade in
      setTimeout(() => {
        dispatch({ type: 'SCRAPE_SUCCESS', payload: scrapedCompany });
        // Small delay to ensure DOM updates before fade in
        setTimeout(() => {
          dispatch({ type: 'SET_SHOW_COMPANY_CARD', payload: true });
          logger.info('Showing company card');
        }, 50);
      }, 500);
    } catch (unknownError) {
      logger.error('❌ [BrandMonitor] Scrape error:', unknownError);

      let errorMessage = tErrors('failedToExtractCompany');
      if (unknownError instanceof ClientApiError) {
        errorMessage = unknownError.getUserMessage();
      } else if (unknownError instanceof Error) {
        logger.error('❌ [BrandMonitor] Error details:', {
          message: unknownError.message,
          name: unknownError.name,
          stack: unknownError.stack,
          cause: (unknownError as { cause?: unknown }).cause
        });

        if (unknownError.message.includes('FIRECRAWL_API_KEY not configured')) {
          errorMessage = 'Clé API Firecrawl manquante. Veuillez configurer FIRECRAWL_API_KEY dans .env.local';
        } else if (unknownError.message.includes('No AI providers configured')) {
          errorMessage = 'Aucun fournisseur IA configuré. Veuillez configurer au moins une clé API (OpenAI, Anthropic, etc.)';
        } else if (unknownError.message.includes('timed out')) {
          errorMessage = 'Timeout lors du scraping. Le site web met trop de temps à répondre.';
        } else if (unknownError.message.includes('network') || unknownError.message.includes('fetch')) {
          errorMessage = 'Erreur de réseau. Vérifiez votre connexion internet.';
        } else {
          errorMessage = tErrors('failedToExtractCompanyWithReason', { reason: unknownError.message });
        }
      }

      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [url, creditsAvailable, onCreditsUpdate, tErrors]);
  
  const handlePrepareAnalysis = useCallback(async () => {
    if (!company) return;

    // Validate credits and show error but allow click to give feedback like URL stage
    if (creditsAvailable < CREDIT_COST_COMPETITOR_ANALYSIS) {
      dispatch({ type: 'SET_ERROR', payload: tErrors('insufficientCreditsCompetitors', { credits: CREDIT_COST_COMPETITOR_ANALYSIS }) });
      return;
    }

    dispatch({ type: 'SET_PREPARING_ANALYSIS', payload: true });
    
    // Check which providers are available
    try {
      const response = await fetch('/api/brand-monitor/check-providers', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'SET_AVAILABLE_PROVIDERS', payload: data.providers || ['OpenAI', 'Anthropic', 'Google'] });
      }
    } catch {
      // Default to providers with API keys if check fails
      const defaultProviders = [];
      if (process.env.NEXT_PUBLIC_HAS_OPENAI_KEY) defaultProviders.push('OpenAI');
      if (process.env.NEXT_PUBLIC_HAS_ANTHROPIC_KEY) defaultProviders.push('Anthropic');
      dispatch({ type: 'SET_AVAILABLE_PROVIDERS', payload: defaultProviders.length > 0 ? defaultProviders : ['OpenAI', 'Anthropic'] });
    }
    
    try {
      const detectedLocale = navigator.language.split('-')[0] || 'en';
      logger.info('ðŸš€ Starting competitor search...');
      logger.debug('🌐 Detected browser locale:', navigator.language, '→', detectedLocale);
      
      // Import search method configuration
      const { ACTIVE_SEARCH_CONFIG, getApiEndpoint, buildRequestBody } = await import('@/lib/competitor-pipeline/search-method-config');
      
      const apiEndpoint = getApiEndpoint(ACTIVE_SEARCH_CONFIG.method);
      const requestBody = buildRequestBody(ACTIVE_SEARCH_CONFIG, company, detectedLocale, useIntelliSearch);
      
      logger.debug(`ðŸ”¬ [SearchMethod] Active method: ${ACTIVE_SEARCH_CONFIG.method}`);
      logger.debug(`ðŸ”§ [SearchMethod] Config:`, ACTIVE_SEARCH_CONFIG);
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = (await response.json()) as CompetitorSearchResponse & { error?: string };

      if (!data.success) {
        throw new Error(data.error || 'Unknown API error');
      }

      // Debit credits for competitor analysis only after successful generation
      try {
        const debitRes = await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: CREDIT_COST_COMPETITOR_ANALYSIS, reason: 'identify_competitors_success' })
        });
        if (!debitRes.ok) {
          const err = (await debitRes.json().catch(() => null)) as { error?: string } | null;
          logger.warn('[Credits] Debit on identify_competitors_success failed:', err?.error || debitRes.statusText);
        } else if (onCreditsUpdate) {
          onCreditsUpdate();
        }
      } catch (creditError) {
        logger.warn('[Credits] Debit on identify_competitors_success error:', creditError);
      }
      
      // Handle AI web search results
      const foundCompetitors: IdentifiedCompetitor[] = data.competitors.map((comp) => ({
        name: comp.name,
        url: comp.url ?? undefined
      }));
      
      logger.info('ðŸ† Found competitors:', foundCompetitors);
      logger.debug('ðŸ“Š Stats:', data.stats);
      
      if (data.warning) {
        logger.warn('⚠️ Warning:', data.warning);
      }
      
      dispatch({ type: 'SET_IDENTIFIED_COMPETITORS', payload: foundCompetitors });
      logger.info('Final identified competitors:', foundCompetitors);
    } catch (unknownError) {
      logger.error('❌ Error in competitor search:', unknownError);
      dispatch({ type: 'SET_ERROR', payload: tErrors('failedToFindCompetitors') });
    }
    
    // Show competitors on the same page with animation
    dispatch({ type: 'SET_SHOW_COMPETITORS', payload: true });
    dispatch({ type: 'SET_PREPARING_ANALYSIS', payload: false });
  }, [company, useIntelliSearch, onCreditsUpdate, tErrors, creditsAvailable]);
  
  const handleProceedToPrompts = useCallback(() => {
    // Add a fade-out class to the current view
    const currentView = document.querySelector('.animate-panel-in');
    if (currentView) {
      currentView.classList.add('opacity-0');
    }
    
    setTimeout(() => {
      // Require credits for prompt generation; show specific error if missing and do not proceed
      if (creditsAvailable < CREDIT_COST_PROMPT_GENERATION) {
        dispatch({ type: 'SET_ERROR', payload: tErrors('insufficientCreditsPromptGen', { credits: CREDIT_COST_PROMPT_GENERATION }) });
        return;
      }

      dispatch({ type: 'SET_SHOW_COMPETITORS', payload: false });
      dispatch({ type: 'SET_SHOW_PROMPTS_LIST', payload: true });
    }, 300);
  }, [creditsAvailable, tErrors]);
  
  const handleAnalyze = useCallback(async (displayPrompts: string[]) => {
    if (!company) return;

    // Reset saved flag for new analysis
    hasSavedRef.current = false;

    // Check if user has enough credits dynamically: per-prompt cost depends on webSearch
    const normalizedPrompts = displayPrompts.map(p => p.trim());
    const perPromptCost = useWebSearch ? CREDIT_COST_PER_PROMPT_ANALYSIS_WEB : CREDIT_COST_PER_PROMPT_ANALYSIS_NO_WEB;
    const requiredCredits = normalizedPrompts.length * perPromptCost;
    if (creditsAvailable < requiredCredits) {
      dispatch({ type: 'SET_ERROR', payload: tErrors('insufficientCreditsAnalysis', { credits: requiredCredits, perPrompt: perPromptCost }) });
      return;
    }

    // Immediately trigger credit update to reflect deduction in navbar
    if (onCreditsUpdate) {
      onCreditsUpdate();
    }

    try {
      // Use the prompts that are already displayed in the UI instead of regenerating
      // This ensures consistency and avoids unnecessary API calls
      // normalizedPrompts already computed above
      dispatch({ type: 'SET_ANALYZING_PROMPTS', payload: normalizedPrompts });

      logger.info('Starting analysis with existing prompts:', normalizedPrompts.length);
      
      dispatch({ type: 'SET_ANALYZING', payload: true });
      dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: {
        stage: 'initializing',
        progress: 0,
        message: tAnalysis('startingAnalysis'),
        competitors: [],
        prompts: [],
        partialResults: []
      }});
      dispatch({ type: 'SET_ANALYSIS_TILES', payload: [] });
      
      // Initialize prompt completion status
      const initialStatus: PromptCompletionStatus = {};
      const expectedProviders = getEnabledProviders().map(config => config.name);
      
      normalizedPrompts.forEach(prompt => {
        initialStatus[prompt] = {} as Record<string, PromptStatus>;
        expectedProviders.forEach(provider => {
          initialStatus[prompt][provider] = 'pending';
        });
      });
      dispatch({ type: 'SET_PROMPT_COMPLETION_STATUS', payload: initialStatus });

      await startSSEConnection(
        '/api/brand-monitor/analyze',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            company, 
            prompts: normalizedPrompts,
            competitors: identifiedCompetitors,
            useWebSearch
          }),
        },
        async () => {
          // Debit credits for prompts only after SSE connection (HTTP 200)
          const perPrompt = useWebSearch ? CREDIT_COST_PER_PROMPT_ANALYSIS_WEB : CREDIT_COST_PER_PROMPT_ANALYSIS_NO_WEB;
          const debitValue = normalizedPrompts.length * perPrompt;
          try {
            const debitRes = await fetch('/api/credits', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: debitValue, reason: 'prompts_analysis' })
            });
            if (!debitRes.ok) {
              const err = (await debitRes.json().catch(() => null)) as { error?: string } | null;
              logger.warn('[Credits] Debit for prompts failed:', err?.error || debitRes.statusText);
            } else if (onCreditsUpdate) {
              onCreditsUpdate();
            }
          } catch (creditError) {
            logger.warn('[Credits] Debit for prompts error:', creditError);
          }
        }
      );
    } catch (unknownError) {
      logger.error('Error preparing prompts or starting analysis:', unknownError);
      dispatch({ type: 'SET_ERROR', payload: tErrors('analysisPreparationFailed') });
    } finally {
      dispatch({ type: 'SET_ANALYZING', payload: false });
    }
  }, [company, identifiedCompetitors, startSSEConnection, creditsAvailable, tErrors, tAnalysis, useWebSearch, onCreditsUpdate]);
  
  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
    hasSavedRef.current = false;
  }, []);
  
  const handleWebSearchToggle = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_USE_WEB_SEARCH', payload: enabled });
  }, []);
  
  const handleRefreshMatrix = useCallback(async () => {
    if (!company || !analysis?.responses || !identifiedCompetitors) {
      logger.error('Données manquantes pour le refresh de la matrice');
      return;
    }

    setIsRefreshingMatrix(true);
    
    try {
      logger.info('[RefreshMatrix] ðŸ”„ Début du recalcul de la matrice...');
      
      // Préparer les données pour l'API
      const knownCompetitors = identifiedCompetitors.map(c => c.name);
      
      const response = await fetch('/api/brand-monitor/refresh-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          responses: analysis.responses,
          knownCompetitors
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du refresh');
      }

      const data = await response.json();
      logger.info('[RefreshMatrix] ✅ Matrice recalculée avec succès');
      
      // Mettre à jour l'analyse avec les nouvelles données
      const updatedAnalysis = {
        ...analysis,
        providerRankings: data.providerRankings,
        providerComparison: data.providerComparison,
        lastMatrixRefresh: data.timestamp
      };
      
      dispatch({ type: 'SET_ANALYSIS', payload: updatedAnalysis });
      
    } catch (error) {
      logger.error('[RefreshMatrix] ❌ Erreur:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: `Erreur lors du rafraîchissement: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
      });
    } finally {
      setIsRefreshingMatrix(false);
    }
  }, [company, analysis, identifiedCompetitors]);
  
  const batchScrapeAndValidateCompetitors = useCallback(async (competitors: IdentifiedCompetitor[]) => {
    const validatedCompetitors = competitors.map(comp => ({
      ...comp,
      url: comp.url ? validateCompetitorUrl(comp.url) : undefined
    })).filter(comp => comp.url);
    
    if (validatedCompetitors.length === 0) return;
    
    // Implementation for batch scraping - you can move the full implementation here
    // For now, just logging
    logger.info('Batch scraping validated competitors:', validatedCompetitors);
  }, []);
  
  
  // Find brand data
  const brandData = analysis?.competitors?.find(c => c.isOwn);
  const providerRankingsForDisplay: ProviderSpecificRanking[] | undefined = (() => {
    const rankings = analysis?.providerRankings;
    if (!rankings) {
      return undefined;
    }

    if (!analysis?.providerComparison) {
      return rankings;
    }

    const comparisonBrands = new Set(analysis.providerComparison.map(c => c.competitor));
    return rankings.map((ranking) => ({
      ...ranking,
      competitors: ranking.competitors.filter((competitor) => comparisonBrands.has(competitor.name))
    }));
  })();
  
  return (
    <div className="flex flex-col">

      {/* URL Input Section */}
      {showInput && (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <UrlInputSection
              url={url}
              urlValid={urlValid}
              loading={loading}
              analyzing={analyzing}
              onUrlChange={handleUrlChange}
              onSubmit={handleScrape}
            />
          </div>
        </div>
      )}

      {/* Company Card Section with Competitors */}
      {!showInput && company && !showPromptsList && !analyzing && !analysis && (
        <div className="flex items-center justify-center animate-panel-in">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="w-full space-y-6">
            <div className={`transition-all duration-500 ${showCompanyCard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <CompanyCard 
                company={company}
                onAnalyze={handlePrepareAnalysis}
                analyzing={preparingAnalysis}
                showCompetitors={showCompetitors}
                identifiedCompetitors={identifiedCompetitors}
                onRemoveCompetitor={(idx) => dispatch({ type: 'REMOVE_COMPETITOR', payload: idx })}
                onAddCompetitor={() => {
                  // Only allow adding if we have less than 9 competitors
                  if (identifiedCompetitors.length < 9) {
                    dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addCompetitor', show: true } });
                    dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name: '', url: '' } });
                  }
                }}
                onContinueToAnalysis={handleProceedToPrompts}
              />
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompts List Section */}
      {showPromptsList && company && !analysis && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          {/* Web Search Toggle */}
          <div className="mb-6 flex justify-center">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">
                  Recherche en ligne pour améliorer l'analyse
                </span>
                <WebSearchToggle
                  enabled={useWebSearch}
                  onChange={handleWebSearchToggle}
                  disabled={analyzing}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {useWebSearch 
                  ? "Les modèles d&apos;IA effectueront des recherches en ligne pour des informations plus récentes et précises"
                  : "Les modèles d'IA utiliseront uniquement leurs connaissances pré-entraînées"
                }
              </p>
            </div>
          </div>
          
          <AnalysisProgressSection
          company={company}
          analyzing={analyzing}
          identifiedCompetitors={identifiedCompetitors}
          scrapingCompetitors={scrapingCompetitors}
          analysisProgress={analysisProgress}
          prompts={analyzingPrompts}
          customPrompts={customPrompts}
          removedDefaultPrompts={removedDefaultPrompts}
          promptCompletionStatus={promptCompletionStatus}
          onRemoveDefaultPrompt={(index) => dispatch({ type: 'REMOVE_DEFAULT_PROMPT', payload: index })}
          onRemoveCustomPrompt={(prompt) => {
            dispatch({ type: 'SET_CUSTOM_PROMPTS', payload: customPrompts.filter(p => p !== prompt) });
          }}
          onAddPromptClick={() => {
            dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addPrompt', show: true } });
            dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: '' });
          }}
          onStartAnalysis={handleAnalyze}
          onCreditsUpdate={onCreditsUpdate}
        />
        </div>
      )}

      {/* Analysis Results */}
      {analysis && brandData && (
        <div className="flex-1 flex justify-center animate-panel-in pt-8">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            {/* API Usage Summary */}
            {isDev && apiUsageSummary && (
              <div className="mb-6">
                <ApiUsageSummary
                  summary={apiUsageSummary}
                />
              </div>
            )}
            
            <div className="flex gap-6 relative">
            {/* Sidebar Navigation */}
            <ResultsNavigation
              activeTab={activeResultsTab}
              onTabChange={(tab) => {
                // Allow click but keep disabled styling/tooltip handled in nav
                dispatch({ type: 'SET_ACTIVE_RESULTS_TAB', payload: tab });
              }}
              onRestart={handleRestart}
              hideSourcesTab={hideSourcesTab}
            />
            
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
              <div className="w-full flex-1 flex flex-col">
                {/* Tab Content */}
                {activeResultsTab === 'visibility' && (
                  <VisibilityScoreTab
                    competitors={analysis.competitors}
                    brandData={brandData}
                    identifiedCompetitors={identifiedCompetitors}
                  />
                )}

                {activeResultsTab === 'matrix' && (
                  <Card className="p-2 bg-card text-card-foreground gap-6 rounded-xl border py-6 shadow-sm border-gray-200 h-full flex flex-col">
                    <CardHeader className="border-b">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-xl font-semibold">{tAnalysis('comparisonMatrix.title')}</CardTitle>
                          <CardDescription className="text-sm text-gray-600 mt-1">
                            {tAnalysis('comparisonMatrix.description')}
                            
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                          {isDev && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRefreshMatrix}
                              disabled={isRefreshingMatrix}
                              className="flex items-center gap-2"
                            >
                              <RefreshCw className={`w-4 h-4 ${isRefreshingMatrix ? 'animate-spin' : ''}`} />
                              {isRefreshingMatrix ? 'Recalcul...' : 'Rafraîchir'}
                            </Button>
                          )}
                          <div className="text-right">
                            <p className="text-2xl font-bold text-orange-600">{brandData.visibilityScore}%</p>
                            <p className="text-xs text-gray-500 mt-1">{tAnalysis('comparisonMatrix.averageScore')}</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 overflow-auto">
                      {analysis.providerComparison ? (
                        <ProviderComparisonMatrix 
                          data={analysis.providerComparison} 
                          competitors={identifiedCompetitors}
                        />
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>{tAnalysis('comparisonMatrix.noDataAvailable')}</p>
                          <p className="text-sm mt-2">{tAnalysis('comparisonMatrix.ensureProvidersConfigured')}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {activeResultsTab === 'rankings' && providerRankingsForDisplay && (
                  <div id="provider-rankings" className="h-full">
                    <ProviderRankingsTabs 
                      providerRankings={providerRankingsForDisplay} 
                      brandName={company?.name || tAnalysis('yourBrand')}
                      shareOfVoice={brandData.shareOfVoice}
                      averagePosition={Math.round(brandData.averagePosition)}
                      sentimentScore={brandData.sentimentScore}
                      weeklyChange={brandData.weeklyChange}
                    />
                  </div>
                )}

                {activeResultsTab === 'sources' && !hideSourcesTab && (
                  <SourcesTab sources={displaySources} />
                )}

                {activeResultsTab === 'prompts' && analysis.prompts && (
                  <Card className="p-2 bg-card text-card-foreground gap-6 rounded-xl border py-6 shadow-sm border-gray-200 h-full flex flex-col">
                    <CardHeader className="border-b">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-xl font-semibold">{tAnalysis('promptsResponses.title')}</CardTitle>
                          <CardDescription className="text-sm text-gray-600 mt-1">
                            {tAnalysis('promptsResponses.description')}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-600">{analysis.prompts.length}</p>
                          <p className="text-xs text-gray-500 mt-1">{tAnalysis('promptsResponses.totalPrompts')}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 overflow-auto">
                      <PromptsResponsesTab
                        prompts={analysis.prompts}
                        responses={analysis.responses}
                        expandedPromptIndex={expandedPromptIndex}
                        onToggleExpand={(index) => dispatch({ type: 'SET_EXPANDED_PROMPT_INDEX', payload: index })}
                        brandName={analysis.company?.name || ''}
                        competitors={analysis.competitors?.map(c => c.name) || []}
                        webSearchUsed={analysis.webSearchUsed}
                        hideWebSearchSources={hideWebSearchSources}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <ErrorMessage
          error={error}
          onDismiss={() => dispatch({ type: 'SET_ERROR', payload: null })}
        />
      )}
      
      {/* Modals */}
      <AddPromptModal
        isOpen={showAddPromptModal}
        promptText={newPromptText}
        onPromptTextChange={(text) => dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: text })}
        onAdd={async () => {
          const trimmed = newPromptText.trim();
          if (!trimmed) return;
          dispatch({ type: 'ADD_CUSTOM_PROMPT', payload: trimmed });
          dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addPrompt', show: false } });
          dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: '' });
        }}
        onClose={() => {
          dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addPrompt', show: false } });
          dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: '' });
        }}
      />

      <AddCompetitorModal
        isOpen={showAddCompetitorModal}
        competitorName={newCompetitorName}
        competitorUrl={newCompetitorUrl}
        onNameChange={(name) => dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name } })}
        onUrlChange={(url) => dispatch({ type: 'SET_NEW_COMPETITOR', payload: { url } })}
        onAdd={async () => {
          if (newCompetitorName.trim()) {
            const rawUrl = newCompetitorUrl.trim();
            const validatedUrl = rawUrl ? validateCompetitorUrl(rawUrl) : undefined;
            
            const newCompetitor: IdentifiedCompetitor = {
              name: newCompetitorName.trim(),
              url: validatedUrl
            };
            
            dispatch({ type: 'ADD_COMPETITOR', payload: newCompetitor });
            dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addCompetitor', show: false } });
            dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name: '', url: '' } });
            
            // Batch scrape and validate the new competitor if it has a URL
            if (newCompetitor.url) {
              await batchScrapeAndValidateCompetitors([newCompetitor]);
            }
          }
        }}
        onClose={() => {
          dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addCompetitor', show: false } });
          dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name: '', url: '' } });
        }}
      />
    </div>
  );
}


