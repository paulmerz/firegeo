'use client';

import React, { useReducer, useCallback, useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Company } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { CREDITS_PER_BRAND_ANALYSIS } from '@/config/constants';
import { ClientApiError } from '@/lib/client-errors';
import { 
  brandMonitorReducer, 
  initialBrandMonitorState,
  BrandMonitorAction,
  IdentifiedCompetitor
} from '@/lib/brand-monitor-reducer';
import {
  validateUrl,
  validateCompetitorUrl,
  normalizeCompetitorName,
  assignUrlToCompetitor,
  getIndustryCompetitors
} from '@/lib/brand-monitor-utils';
import { preparePromptsForAnalysis } from '@/lib/prompt-utils';
import { getEnabledProviders } from '@/lib/provider-config';
import { useSaveBrandAnalysis } from '@/hooks/useBrandAnalyses';

// Components
import { UrlInputSection } from './url-input-section';
import { CompanyCard } from './company-card';
import { AnalysisProgressSection } from './analysis-progress-section';
import { ResultsNavigation } from './results-navigation';
import { PromptsResponsesTab } from './prompts-responses-tab';
import { VisibilityScoreTab } from './visibility-score-tab';
import { ErrorMessage } from './error-message';
import { AddPromptModal } from './modals/add-prompt-modal';
import { AddCompetitorModal } from './modals/add-competitor-modal';
import { ProviderComparisonMatrix } from './provider-comparison-matrix';
import { ProviderRankingsTabs } from './provider-rankings-tabs';

// Hooks
import { useSSEHandler } from './hooks/use-sse-handler';

interface BrandMonitorProps {
  creditsAvailable?: number;
  onCreditsUpdate?: () => void;
  selectedAnalysis?: any;
  onSaveAnalysis?: (analysis: any) => void;
}

export function BrandMonitor({ 
  creditsAvailable = 0, 
  onCreditsUpdate,
  selectedAnalysis,
  onSaveAnalysis 
}: BrandMonitorProps = {}) {
  const t = useTranslations('brandMonitor');
  const tErrors = useTranslations('brandMonitor.errors');
  const tAnalysis = useTranslations('brandMonitor.analysis');
  const [state, dispatch] = useReducer(brandMonitorReducer, initialBrandMonitorState);
  const [demoUrl] = useState('example.com');
  const saveAnalysis = useSaveBrandAnalysis();
  const [isLoadingExistingAnalysis, setIsLoadingExistingAnalysis] = useState(false);
  const hasSavedRef = useRef(false);
  
  const { startSSEConnection } = useSSEHandler({ 
    state, 
    dispatch, 
    onCreditsUpdate,
    onAnalysisComplete: (completedAnalysis) => {
      // Only save if this is a new analysis (not loaded from existing)
      if (!selectedAnalysis && !hasSavedRef.current) {
        hasSavedRef.current = true;
        
        const analysisData = {
          url: company?.url || url,
          companyName: company?.name,
          industry: company?.industry,
          analysisData: completedAnalysis,
          competitors: identifiedCompetitors,
          prompts: analyzingPrompts,
          creditsUsed: CREDITS_PER_BRAND_ANALYSIS
        };
        
        saveAnalysis.mutate(analysisData, {
          onSuccess: (savedAnalysis) => {
            console.log('Analysis saved successfully:', savedAnalysis);
            if (onSaveAnalysis) {
              onSaveAnalysis(savedAnalysis);
            }
          },
          onError: (error) => {
            console.error('Failed to save analysis:', error);
            hasSavedRef.current = false;
          }
        });
      }
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
    availableProviders,
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
    scrapingCompetitors
  } = state;
  
  // Remove the auto-save effect entirely - we'll save manually when analysis completes
  
  // Load selected analysis if provided or reset when null
  useEffect(() => {
    if (selectedAnalysis && selectedAnalysis.analysisData) {
      setIsLoadingExistingAnalysis(true);
      // Restore the analysis state from saved data
      dispatch({ type: 'SET_ANALYSIS', payload: selectedAnalysis.analysisData });
      if (selectedAnalysis.companyName) {
        dispatch({ type: 'SCRAPE_SUCCESS', payload: {
          name: selectedAnalysis.companyName,
          url: selectedAnalysis.url,
          industry: selectedAnalysis.industry
        } as Company });
      }
      // Reset the flag after a short delay to ensure the save effect doesn't trigger
      setTimeout(() => setIsLoadingExistingAnalysis(false), 100);
    } else if (selectedAnalysis === null) {
      // Reset state when explicitly set to null (New Analysis clicked)
      dispatch({ type: 'RESET_STATE' });
      hasSavedRef.current = false;
      setIsLoadingExistingAnalysis(false);
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

    // Check if user has enough credits for initial scrape (1 credit)
    if (creditsAvailable < 1) {
      dispatch({ type: 'SET_ERROR', payload: tErrors('insufficientCreditsUrl') });
      return;
    }

    console.log('Starting scrape for URL:', url);
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_URL_VALID', payload: true });
    
    try {
      const response = await fetch('/api/brand-monitor/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url,
          maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week in milliseconds
        }),
      });

      console.log('Scrape response status:', response.status);

      if (!response.ok) {
        try {
          const errorData = await response.json();
          console.error('Scrape API error:', errorData);
          if (errorData.error?.message) {
            throw new ClientApiError(errorData);
          }
          throw new Error(errorData.error || tErrors('failedToScrape'));
        } catch (e) {
          if (e instanceof ClientApiError) throw e;
          throw new Error(tErrors('failedToScrape'));
        }
      }

      const data = await response.json();
      console.log('Scrape data received:', data);
      
      if (!data.company) {
        throw new Error(tErrors('noCompanyData'));
      }
      
      // Scrape was successful - credits have been deducted, refresh the navbar
      if (onCreditsUpdate) {
        onCreditsUpdate();
      }
      
      // Start fade out transition
      dispatch({ type: 'SET_SHOW_INPUT', payload: false });
      
      // After fade out completes, set company and show card with fade in
      setTimeout(() => {
        dispatch({ type: 'SCRAPE_SUCCESS', payload: data.company });
        // Small delay to ensure DOM updates before fade in
        setTimeout(() => {
          dispatch({ type: 'SET_SHOW_COMPANY_CARD', payload: true });
          console.log('Showing company card');
        }, 50);
      }, 500);
    } catch (error: any) {
      console.error('❌ [BrandMonitor] Scrape error:', error);
      
      let errorMessage = tErrors('failedToExtractCompany');
      if (error instanceof ClientApiError) {
        errorMessage = error.getUserMessage();
      } else if (error.message) {
        // Log detailed error information for debugging
        console.error('❌ [BrandMonitor] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
          cause: error.cause
        });
        
        // Provide more specific error messages based on error type
        if (error.message.includes('FIRECRAWL_API_KEY not configured')) {
          errorMessage = 'Clé API Firecrawl manquante. Veuillez configurer FIRECRAWL_API_KEY dans .env.local';
        } else if (error.message.includes('No AI providers configured')) {
          errorMessage = 'Aucun fournisseur IA configuré. Veuillez configurer au moins une clé API (OpenAI, Anthropic, etc.)';
        } else if (error.message.includes('timed out')) {
          errorMessage = 'Timeout lors du scraping. Le site web met trop de temps à répondre.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Erreur de réseau. Vérifiez votre connexion internet.';
        } else {
          errorMessage = tErrors('failedToExtractCompanyWithReason', { reason: error.message });
        }
      }
      
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [url, creditsAvailable, onCreditsUpdate, tErrors]);
  
  const handlePrepareAnalysis = useCallback(async () => {
    if (!company) return;
    
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
    } catch (e) {
      // Default to providers with API keys if check fails
      const defaultProviders = [];
      if (process.env.NEXT_PUBLIC_HAS_OPENAI_KEY) defaultProviders.push('OpenAI');
      if (process.env.NEXT_PUBLIC_HAS_ANTHROPIC_KEY) defaultProviders.push('Anthropic');
      dispatch({ type: 'SET_AVAILABLE_PROVIDERS', payload: defaultProviders.length > 0 ? defaultProviders : ['OpenAI', 'Anthropic'] });
    }
    
    try {
      const detectedLocale = navigator.language.split('-')[0] || 'en';
      console.log('🚀 Starting competitor search...');
      console.log('🌐 Detected browser locale:', navigator.language, '→', detectedLocale);
      
      // Import search method configuration
      const { ACTIVE_SEARCH_CONFIG, getApiEndpoint, buildRequestBody } = await import('@/lib/competitor-pipeline/search-method-config');
      
      const apiEndpoint = getApiEndpoint(ACTIVE_SEARCH_CONFIG.method);
      const requestBody = buildRequestBody(ACTIVE_SEARCH_CONFIG, company, detectedLocale);
      
      console.log(`🔬 [SearchMethod] Active method: ${ACTIVE_SEARCH_CONFIG.method}`);
      console.log(`🔧 [SearchMethod] Config:`, ACTIVE_SEARCH_CONFIG);
      
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
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown API error');
      }
      
      // Handle AI web search results
      const foundCompetitors = data.competitors.map((comp: any) => ({
        name: comp.name,
        url: comp.url
      }));
      
      console.log('🏆 Found competitors:', foundCompetitors);
      console.log('📊 Stats:', data.stats);
      
      if (data.warning) {
        console.warn('⚠️ Warning:', data.warning);
      }
      
      dispatch({ type: 'SET_IDENTIFIED_COMPETITORS', payload: foundCompetitors });
      console.log('Final identified competitors:', foundCompetitors);
    } catch (error) {
      console.error('❌ Error in competitor search:', error);
      dispatch({ type: 'SET_ERROR', payload: tErrors('failedToFindCompetitors') });
    }
    
    // Show competitors on the same page with animation
    dispatch({ type: 'SET_SHOW_COMPETITORS', payload: true });
    dispatch({ type: 'SET_PREPARING_ANALYSIS', payload: false });
  }, [company]);
  
  const handleProceedToPrompts = useCallback(() => {
    // Add a fade-out class to the current view
    const currentView = document.querySelector('.animate-panel-in');
    if (currentView) {
      currentView.classList.add('opacity-0');
    }
    
    setTimeout(() => {
      dispatch({ type: 'SET_SHOW_COMPETITORS', payload: false });
      dispatch({ type: 'SET_SHOW_PROMPTS_LIST', payload: true });
    }, 300);
  }, []);
  
  const handleAnalyze = useCallback(async () => {
    if (!company) return;

    // Reset saved flag for new analysis
    hasSavedRef.current = false;

    // Check if user has enough credits
    if (creditsAvailable < CREDITS_PER_BRAND_ANALYSIS) {
      dispatch({ type: 'SET_ERROR', payload: tErrors('insufficientCreditsAnalysis', { credits: CREDITS_PER_BRAND_ANALYSIS }) });
      return;
    }

    // Immediately trigger credit update to reflect deduction in navbar
    if (onCreditsUpdate) {
      onCreditsUpdate();
    }

    try {
      // Use centralized prompt preparation logic
      const competitorNames = identifiedCompetitors.map(c => c.name);
      const allPrompts = await preparePromptsForAnalysis(
        company,
        customPrompts,
        removedDefaultPrompts,
        competitorNames,
        true // Use AI-generated prompts for better analysis
      );
      
      // Store the prompts for UI display - make sure they're normalized
      const normalizedPrompts = allPrompts.map(p => p.trim());
      dispatch({ type: 'SET_ANALYZING_PROMPTS', payload: normalizedPrompts });

      console.log('Starting analysis...');
      
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
      const initialStatus: any = {};
      const expectedProviders = getEnabledProviders().map(config => config.name);
      
      normalizedPrompts.forEach(prompt => {
        initialStatus[prompt] = {};
        expectedProviders.forEach(provider => {
          initialStatus[prompt][provider] = 'pending';
        });
      });
      dispatch({ type: 'SET_PROMPT_COMPLETION_STATUS', payload: initialStatus });

      await startSSEConnection('/api/brand-monitor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          company, 
          prompts: normalizedPrompts,
          competitors: identifiedCompetitors 
        }),
      });
    } catch (error) {
      console.error('Error preparing prompts or starting analysis:', error);
      dispatch({ type: 'SET_ERROR', payload: tErrors('analysisPreparationFailed') });
    } finally {
      dispatch({ type: 'SET_ANALYZING', payload: false });
    }
  }, [company, removedDefaultPrompts, customPrompts, identifiedCompetitors, startSSEConnection, creditsAvailable, tErrors, tAnalysis]);
  
  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
    hasSavedRef.current = false;
    setIsLoadingExistingAnalysis(false);
  }, []);
  
  const batchScrapeAndValidateCompetitors = useCallback(async (competitors: IdentifiedCompetitor[]) => {
    const validatedCompetitors = competitors.map(comp => ({
      ...comp,
      url: comp.url ? validateCompetitorUrl(comp.url) : undefined
    })).filter(comp => comp.url);
    
    if (validatedCompetitors.length === 0) return;
    
    // Implementation for batch scraping - you can move the full implementation here
    // For now, just logging
    console.log('Batch scraping validated competitors:', validatedCompetitors);
  }, []);
  
  
  // Find brand data
  const brandData = analysis?.competitors?.find(c => c.isOwn);
  
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
                  dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addCompetitor', show: true } });
                  dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name: '', url: '' } });
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
        />
        </div>
      )}

      {/* Analysis Results */}
      {analysis && brandData && (
        <div className="flex-1 flex justify-center animate-panel-in pt-8">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="flex gap-6 relative">
            {/* Sidebar Navigation */}
            <ResultsNavigation
              activeTab={activeResultsTab}
              onTabChange={(tab) => {
                dispatch({ type: 'SET_ACTIVE_RESULTS_TAB', payload: tab });
              }}
              onRestart={handleRestart}
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
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-600">{brandData.visibilityScore}%</p>
                          <p className="text-xs text-gray-500 mt-1">{tAnalysis('comparisonMatrix.averageScore')}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 overflow-auto">
                      {analysis.providerComparison ? (
                        <ProviderComparisonMatrix 
                          data={analysis.providerComparison} 
                          brandName={company?.name || ''} 
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

                {activeResultsTab === 'rankings' && analysis.providerRankings && (
                  <div id="provider-rankings" className="h-full">
                    <ProviderRankingsTabs 
                      providerRankings={analysis.providerRankings} 
                      brandName={company?.name || tAnalysis('yourBrand')}
                      shareOfVoice={brandData.shareOfVoice}
                      averagePosition={Math.round(brandData.averagePosition)}
                      sentimentScore={brandData.sentimentScore}
                      weeklyChange={brandData.weeklyChange}
                    />
                  </div>
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
        onAdd={() => {
          if (newPromptText.trim()) {
            dispatch({ type: 'ADD_CUSTOM_PROMPT', payload: newPromptText.trim() });
            dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addPrompt', show: false } });
            dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: '' });
          }
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