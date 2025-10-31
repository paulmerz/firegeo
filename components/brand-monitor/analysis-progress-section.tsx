'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, CheckIcon } from 'lucide-react';
import { Company, AnalysisStage } from '@/lib/types';
import { IdentifiedCompetitor, PromptCompletionStatus } from '@/lib/brand-monitor-reducer';
import { getEnabledProviders } from '@/lib/provider-config';
import { useTranslations } from 'next-intl';
import { generateAdaptivePrompts } from '@/lib/prompt-utils';
import { CREDIT_COST_PROMPT_GENERATION } from '@/config/constants';
import { logger } from '@/lib/logger';
import { useCreditsInvalidation } from '@/hooks/useCreditsInvalidation';

// Type for prompts with custom flag
type PromptWithType = {
  text: string;
  isCustom: boolean;
};

interface AnalysisProgressSectionProps {
  company: Company;
  analyzing: boolean;
  identifiedCompetitors: IdentifiedCompetitor[];
  scrapingCompetitors: boolean;
  analysisProgress: {
    stage: AnalysisStage;
    progress: number;
    message: string;
  };
  prompts: string[];
  customPrompts: string[];
  promptCompletionStatus: PromptCompletionStatus;
  onRemoveCustomPrompt: (prompt: string) => void;
  onAddPromptClick: () => void;
  onStartAnalysis: (displayPrompts: string[]) => void;
  onCreditsUpdate?: () => void;
}

// Provider icon mapping
const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'OpenAI':
      return (
        <img 
          src="/OpenAI_logo.svg" 
          alt="OpenAI" 
          className="w-7 h-7"
        />
      );
    case 'Anthropic':
      return (
        <img 
          src="https://cdn.brandfetch.io/idmJWF3N06/theme/dark/symbol.svg" 
          alt="Anthropic" 
          className="w-5 h-5"
        />
      );
    case 'Google':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
      );
    case 'Perplexity':
      return (
        <img 
          src="/Perplexity_logo.svg" 
          alt="Perplexity" 
          className="w-5 h-5"
        />
      );
    default:
      return <div className="w-5 h-5 bg-gray-400 rounded" />;
  }
};

export function AnalysisProgressSection({
  company,
  analyzing,
  identifiedCompetitors,
  scrapingCompetitors,
  analysisProgress,
  prompts,
  customPrompts,
  promptCompletionStatus,
  onRemoveCustomPrompt,
  onAddPromptClick,
  onStartAnalysis,
  onCreditsUpdate
}: AnalysisProgressSectionProps) {
  const t = useTranslations('brandMonitor.analysisProgress');
  const [displayPrompts, setDisplayPrompts] = useState<PromptWithType[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const { invalidateCredits } = useCreditsInvalidation();
  
  // Load existing prompts only if we're actively analyzing
  useEffect(() => {
    if (prompts.length > 0 && analyzing) {
      // Convert string prompts to PromptWithType format
      const promptsWithType = prompts.map(prompt => ({ text: prompt, isCustom: false }));
      setDisplayPrompts(promptsWithType);
    }
  }, [prompts, analyzing]);
  
  // Handle adding new custom prompts
  useEffect(() => {
    if (!analyzing && customPrompts.length > 0) {
      // Convert custom prompts to the new format with isCustom flag
      const customPromptsWithType = customPrompts.map(prompt => ({ text: prompt, isCustom: true }));
      
      // Get existing generated prompts (non-custom) from the current state
      setDisplayPrompts(prev => {
        const existingGenerated = prev.filter(p => !p.isCustom);
        return [...existingGenerated, ...customPromptsWithType];
      });
    }
  }, [customPrompts, analyzing]);

  // Handle manual prompt generation
  const handleGeneratePrompts = async () => {
    if (!company || loadingPrompts) return;
    
    setLoadingPrompts(true);
    try {
      // Generate adaptive prompts
      const generatedPrompts = await generateAdaptivePrompts(company, identifiedCompetitors);
      
      // Convert to new format with isCustom: false
      const generatedPromptsWithType = generatedPrompts.map(prompt => ({ text: prompt, isCustom: false }));
      
      // Keep existing custom prompts and replace generated ones
      const existingCustom = displayPrompts.filter(p => p.isCustom);
      setDisplayPrompts([...generatedPromptsWithType, ...existingCustom]);
      
      // Debit credits
      try {
        const res = await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: CREDIT_COST_PROMPT_GENERATION, reason: 'prompts_generation' })
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          logger.warn('[Credits] Debit on prompts_generation failed:', err?.error || res.statusText);
        } else {
          await invalidateCredits();
          if (onCreditsUpdate) {
            onCreditsUpdate();
          }
        }
      } catch (e) {
        logger.warn('[Credits] Debit on prompts_generation error:', e);
      }
    } catch (error) {
      logger.error('Error generating prompts:', error);
    } finally {
      setLoadingPrompts(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center animate-panel-in">
      <div className="max-w-4xl w-full">
        <div className="transition-all duration-400 opacity-100 translate-y-0">
          <Card className="p-2 bg-card text-card-foreground gap-6 rounded-xl border py-6 shadow-sm border-gray-200 h-full flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    {analyzing ? t('title') : t('prompts')}
                  </CardTitle>
                  {!analyzing && (
                    <Button
                      onClick={handleGeneratePrompts}
                      disabled={loadingPrompts}
                      className="w-fit h-8 px-4 text-sm bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {loadingPrompts ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('generating')}
                        </>
                      ) : (
                        t('generatePromptsButton')
                      )}
                    </Button>
                  )}
                </div>
                {/* Competitors list on the right */}
                {!analyzing && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{t('competitors')}:</span>
                    <div className="flex -space-x-2">
                      {identifiedCompetitors.slice(0, 6).map((comp, idx) => (
                        <div key={idx} className="w-8 h-8 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden" title={comp.name}>
                          {comp.url ? (
                            <img 
                              src={`https://www.google.com/s2/favicons?domain=${comp.url}&sz=64`}
                              alt={comp.name}
                              className="w-full h-full object-contain p-0.5"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextSibling as HTMLDivElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600" style={{ display: comp.url ? 'none' : 'flex' }}>
                            {comp.name.charAt(0)}
                          </div>
                        </div>
                      ))}
                      {identifiedCompetitors.length > 6 && (
                        <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center">
                          <span className="text-xs text-gray-600 font-medium">+{identifiedCompetitors.length - 6}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {scrapingCompetitors && !analyzing && (
                <CardDescription className="mt-2 flex items-center justify-center gap-2 text-orange-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('validatingCompetitorData')}</span>
                </CardDescription>
              )}
              {analyzing && analysisProgress && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      <span>{analysisProgress.message}</span>
                    </CardDescription>
                    <span className="text-sm text-gray-500">{analysisProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${analysisProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prompts tiles */}
              <div>
                {loadingPrompts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500 mr-2" />
                    <span className="text-gray-600">{t('generatingAdaptivePrompts')}</span>
                  </div>
                ) : displayPrompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-gray-500 text-lg mb-4">{t('noPromptsMessage')}</p>
                    <p className="text-gray-400 text-sm">{t('generateOrAddPrompts')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayPrompts.map((promptObj, index) => {
                      // Handle the new object format
                      const prompt = promptObj.text;
                      const isCustom = promptObj.isCustom;
                      
                      return (
                        <div 
                          key={`${prompt}-${index}`} 
                          className={`group relative bg-white rounded-lg p-5 hover:shadow-md transition-shadow ${
                            isCustom ? 'border-2 border-blue-500' : 'border border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-base font-medium text-gray-900 flex-1">
                              {prompt}
                            </p>
                            {!analyzing && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  
                                  // Update local state immediately for better UX
                                  setDisplayPrompts(prev => prev.filter((_, i) => i !== index));
                                  
                                  if (isCustom) {
                                    // Remove from custom prompts
                                    onRemoveCustomPrompt(prompt);
                                  } else {
                                    // For generated prompts, just remove from display
                                    // No need to call any callback since they're not persisted
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            )}
                        </div>
                        
                        {/* Provider icons and status */}
                        <div className="mt-4 flex items-center gap-3 justify-end">
                          {getEnabledProviders().map(config => {
                            const provider = config.name;
                            const normalizedPrompt = prompt.trim();
                            const status = analyzing ? (promptCompletionStatus[normalizedPrompt]?.[provider] || 'pending') : null;
                            
                            return (
                              <div key={`${prompt}-${provider}`} className="flex items-center gap-1">
                                {getProviderIcon(provider)}
                                {analyzing && (
                                  <>
                                    {status === 'pending' && (
                                      <div className="w-4 h-4 rounded-full border border-gray-300" />
                                    )}
                                    {status === 'running' && (
                                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                    )}
                                    {status === 'completed' && (
                                      <CheckIcon className="w-4 h-4 text-green-500" />
                                    )}
                                    {status === 'failed' && (
                                      <div className="w-4 h-4 rounded-full bg-red-500" />
                                    )}
                                    {status === 'skipped' && (
                                      <div className="w-4 h-4 rounded-full bg-gray-400" />
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {isCustom && <Badge variant="outline" className="text-xs mt-2">{t('custom')}</Badge>}
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>

              {/* Add Prompt Button */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={onAddPromptClick}
                  disabled={analyzing}
                  className="h-9 rounded-[10px] text-sm font-medium flex items-center transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 bg-[#36322F] text-[#fff] hover:bg-[#4a4542] disabled:bg-[#8c8885] disabled:hover:bg-[#8c8885] [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100 px-4 py-1 gap-1"
                >
                  <Plus className="h-4 w-4" />
                  {t('addPrompt')}
                </button>
              </div>

              {/* Start Analysis Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => onStartAnalysis(displayPrompts.map(p => p.text))}
                  disabled={analyzing || displayPrompts.length === 0}
                  className="h-10 px-6 rounded-[10px] text-sm font-medium flex items-center transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 bg-orange-500 text-white hover:bg-orange-600 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#c2410c,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#c2410c,_0px_1px_3px_0px_rgba(234,_88,_12,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#c2410c,_0px_1px_2px_0px_rgba(234,_88,_12,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('analyzing')}
                    </>
                  ) : (
                    t('startAnalysis')
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
