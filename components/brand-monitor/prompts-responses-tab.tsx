'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronsDown, ChevronsUp } from 'lucide-react';
import { BrandPrompt, AIResponse } from '@/lib/types';
import { HighlightedResponse } from './highlighted-response';
import { useTranslations } from 'next-intl';
import { logger } from '@/lib/logger';

interface PromptsResponsesTabProps {
  prompts: BrandPrompt[];
  responses: AIResponse[];
  expandedPromptIndex: number | null;
  onToggleExpand: (index: number | null) => void;
  brandName: string;
  competitors: string[];
  webSearchUsed?: boolean;
  hideWebSearchSources?: boolean;
}

// Provider icon mapping
const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'OpenAI':
      return (
        <img 
          src="https://cdn.brandfetch.io/idR3duQxYl/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B" 
          alt="OpenAI" 
          className="w-6 h-6"
        />
      );
    case 'Anthropic':
      return (
        <img 
          src="https://cdn.brandfetch.io/idmJWF3N06/theme/dark/symbol.svg" 
          alt="Anthropic" 
          className="w-6 h-6"
        />
      );
    case 'Google':
      return (
        <div className="w-6 h-6 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6">
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
          src="https://cdn.brandfetch.io/idNdawywEZ/w/800/h/800/theme/dark/icon.png?c=1dxbfHSJFAPEGdCLU4o5B" 
          alt="Perplexity" 
          className="w-6 h-6"
        />
      );
    default:
      return <div className="w-6 h-6 bg-gray-400 rounded" />;
  }
};

export function PromptsResponsesTab({
  prompts,
  responses,
  expandedPromptIndex,
  onToggleExpand,
  brandName,
  competitors,
  webSearchUsed = false,
  hideWebSearchSources = false
}: PromptsResponsesTabProps) {
  const t = useTranslations('brandMonitor');
  const [allExpanded, setAllExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Track which (prompt, provider) sources list is expanded beyond 3
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  
  const handleExpandAll = () => {
    if (allExpanded) {
      // Collapse all
      setAllExpanded(false);
      onToggleExpand(null);
    } else {
      // Expand all - we'll use -1 as a special value to indicate all expanded
      setAllExpanded(true);
      onToggleExpand(-1);
    }
  };
  
  // Filter prompts based on search query
  const filteredPromptIndices = prompts
    .map((prompt, idx) => {
      if (!searchQuery) return idx;
      
      const promptMatches = prompt.prompt.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Check if any response contains the search query
      const promptResponses = responses?.filter(response => 
        response.prompt === prompt.prompt
      ) || [];
      
      const responseMatches = promptResponses.some(response => 
        response.response.toLowerCase().includes(searchQuery.toLowerCase()) ||
        response.provider.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      return (promptMatches || responseMatches) ? idx : null;
    })
    .filter(idx => idx !== null);
  
  return (
    <div className="space-y-2 max-w-full overflow-hidden">
      {/* Web Search Indicator */}
      {webSearchUsed && !hideWebSearchSources && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm font-medium text-blue-800">
              Recherche en ligne activée
            </span>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Données récentes
            </Badge>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Les modèles d&apos;IA ont effectué des recherches en ligne pour obtenir des informations plus récentes et précises
          </p>
        </div>
      )}
      
      {/* Search and Controls */}
      {prompts.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPromptsPlaceholder')}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
              <svg 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Expand/Collapse All Button */}
            <button
              onClick={handleExpandAll}
              className="h-9 px-4 py-2 rounded-[10px] text-sm font-medium flex items-center gap-2 transition-all duration-200 bg-orange-500 text-white hover:bg-orange-600 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#c2410c,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#c2410c,_0px_1px_3px_0px_rgba(234,_88,_12,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#c2410c,_0px_1px_2px_0px_rgba(234,_88,_12,_30%)]"
            >
              {allExpanded ? (
                <>
                  <ChevronsUp className="h-4 w-4" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronsDown className="h-4 w-4" />
                  Expand All
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-3 w-3 rounded-sm border border-orange-300 bg-orange-200" aria-hidden="true" />
              <span>{t('legendTargetBrand', { defaultMessage: 'Target brand mentions' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-3 w-3 rounded-sm border border-gray-300 bg-gray-200" aria-hidden="true" />
              <span>{t('legendCompetitorBrand', { defaultMessage: 'Competitor mentions' })}</span>
            </div>
          </div>
        </div>
      )}
      
      {prompts.map((promptData, idx) => {
        // Skip if filtered out
        if (!filteredPromptIndices.includes(idx)) return null;
        
        // Find responses for this prompt
        const promptResponses = responses?.filter(response => 
          response.prompt === promptData.prompt
        ) || [];
        
        // Debug logging to identify prompt matching issues
        logger.debug(`[PromptsResponsesTab] Prompt ${idx} - Expected: "${promptData.prompt?.substring(0, 50)}..."`);
        logger.debug(`[PromptsResponsesTab] Total responses available: ${responses?.length || 0}`);
        logger.debug(`[PromptsResponsesTab] Matched responses: ${promptResponses.length}`);
        
        if (responses && responses.length > 0) {
          logger.debug(`[PromptsResponsesTab] Available response prompts:`, 
            responses.map((r, i) => `${i}: "${r.prompt?.substring(0, 50)}..."`));
        }
        
        if (responses && responses.length > 0 && promptResponses.length === 0) {
          logger.warn(`[PromptsResponsesTab] ❌ No responses matched for prompt ${idx}`);
        }
        
        // Check if any provider mentioned the brand
        const hasBrandMention = promptResponses.some(r => r.brandMentioned);
        
        // Check if this tile is expanded - auto-expand when searching
        const isExpanded = searchQuery 
          ? true 
          : (expandedPromptIndex === -1 || expandedPromptIndex === idx);
        
        return (
          <div
            key={idx}
            className={`
              relative border rounded-lg transition-all duration-300 max-w-full overflow-hidden
              ${isExpanded 
                ? 'border-orange-200 bg-white shadow-md' 
                : 'border-gray-200 bg-white hover:border-orange-100 hover:shadow-sm'
              }
            `}
          >
            {/* Tile Header - Compact single line */}
            <div 
              className="px-3 py-4 cursor-pointer select-none"
              onClick={() => {
                if (expandedPromptIndex === -1) {
                  // If all are expanded, clicking one should collapse all and keep this one expanded
                  setAllExpanded(false);
                  onToggleExpand(idx);
                } else {
                  // Normal toggle behavior
                  onToggleExpand(isExpanded ? null : idx);
                }
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{promptData.prompt}</p>
                  {hasBrandMention && (
                    <Badge variant="default" className="text-xs bg-green-100 text-green-800 shrink-0">
                      Brand Mentioned
                    </Badge>
                  )}
                </div>
                
                {/* Provider icons preview - deduplicated and ordered */}
                <div className="flex items-center gap-2 shrink-0">
                  {['OpenAI', 'Anthropic', 'Google', 'Perplexity'].map((providerName) => {
                    const providerResponse = promptResponses.find(r => r.provider === providerName);
                    if (!providerResponse) return null;
                    
                    // Check if response failed (empty response text)
                    const isFailed = !providerResponse.response || providerResponse.response.trim().length === 0;
                    
                    return (
                      <div key={providerName} className="relative flex items-center">
                        <div className="w-6 h-6 flex items-center justify-center">
                          {getProviderIcon(providerName)}
                        </div>
                        {isFailed ? (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 flex items-center justify-center bg-red-500 rounded-full border border-white">
                            <span className="text-white text-xs font-bold leading-none">×</span>
                          </div>
                        ) : providerResponse.brandMentioned ? (
                          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                
                {/* Expand/Collapse indicator */}
                <div className={`transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            {/* Expandable content */}
            <div
              className={`
                overflow-hidden transition-all duration-300
                ${isExpanded ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-t border-gray-100 px-3 py-3">
                {promptResponses.length > 0 ? (
                  <div className="space-y-4">
                    {['OpenAI', 'Anthropic', 'Google', 'Perplexity'].map((providerName) => {
                      const response = promptResponses.find(r => r.provider === providerName);
                      if (!response) return null;
                      
                      // Check if response failed (empty response text)
                      const isFailed = !response.response || response.response.trim().length === 0;
                      
                      return (
                      <div key={providerName} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {getProviderIcon(response.provider)}
                            <span className="font-medium text-sm text-gray-900">{response.provider}</span>
                          </div>
                          {isFailed ? (
                            <Badge variant="destructive" className="text-xs bg-red-100 text-red-800">
                              Failed ×
                            </Badge>
                          ) : response.brandMentioned ? (
                            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                              Brand Mentioned
                            </Badge>
                          ) : null}
                          {response.brandPosition && response.brandPosition > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Position #{response.brandPosition}
                            </Badge>
                          )}
                        </div>
                        <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 select-text cursor-text max-w-full overflow-hidden">
                          {isFailed ? (
                            <div className="text-red-600 italic">
                              Response failed or returned empty content
                            </div>
                          ) : (
                            <HighlightedResponse
                              response={response}
                              brandName={brandName}
                              competitors={competitors}
                              showHighlighting={true}
                              renderMarkdown={true}
                            />
                          )}
                        </div>
                        
                        {/* Web Search Sources */}
                        {!hideWebSearchSources && response.webSearchSources && response.webSearchSources.length > 0 && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex items-center gap-1 mb-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <span className="text-xs font-medium text-blue-800">Sources consultées</span>
                            </div>
                            <div className="space-y-1">
                              {(() => {
                                const expandKey = `${idx}-${providerName}`;
                                const toDomain = (input: string): string | null => {
                                  if (!input) return null;
                                  try {
                                    const maybeUrl = /^(https?:)?\/\//i.test(input) ? input : `https://${input}`;
                                    const { hostname } = new URL(maybeUrl);
                                    return hostname.replace(/^www\./i, '');
                                  } catch {
                                    // Fallback: strip path if any
                                    return input.split('/')[0].replace(/^www\./i, '').trim() || null;
                                  }
                                };
                                const domains = Array.from(new Set(
                                  (response.webSearchSources || [])
                                    .map((s: { domain?: string; url?: string }) => toDomain(
                                      typeof s?.domain === 'string' && s.domain.trim()
                                        ? s.domain
                                        : (typeof s?.url === 'string' ? s.url : '')
                                    ))
                                    .filter(Boolean)
                                )) as string[];

                                const showAll = !!expandedSources[expandKey];
                                const visible = showAll ? domains : domains.slice(0, 3);
                                return (
                                  <>
                                    {visible.map((domain) => (
                                      <div key={domain} className="text-xs text-blue-700">
                                        <a
                                          href={`https://${domain}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="hover:text-blue-900 underline"
                                        >
                                          {domain}
                                        </a>
                                      </div>
                                    ))}
                                    {domains.length > 3 && (
                                      showAll ? (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedSources(prev => ({ ...prev, [expandKey]: false }))}
                                          className="text-xs text-blue-600 italic underline"
                                        >
                                          {t('sourcesTab.showLess')}
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedSources(prev => ({ ...prev, [expandKey]: true }))}
                                          className="text-xs text-blue-600 italic underline"
                                        >
                                          +{domains.length - 3} {t('sourcesTab.showMore')}
                                        </button>
                                      )
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-red-800 font-medium">Aucune réponse disponible</span>
                    </div>
                    <p className="text-red-700 text-sm mb-2">
                      Aucun fournisseur d&apos;IA n&apos;a pu traiter ce prompt.
                    </p>
                    <p className="text-red-600 text-xs">
                      Vérifiez que les clés API sont configurées (OpenAI, Anthropic, Google, ou Perplexity).
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      {/* No results message */}
      {searchQuery && filteredPromptIndices.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-2">No results found for &quot;{searchQuery}&quot;</p>
          <p className="text-gray-500 text-sm">Try searching for different keywords</p>
        </div>
      )}
    </div>
  );
}
