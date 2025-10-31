'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronsDown, ChevronsUp } from 'lucide-react';
import { BrandPrompt, AIResponse, BrandVariation } from '@/lib/types';
import { HighlightedResponse } from './highlighted-response';
import { SourcesList } from './sources-list';
import { useTranslations } from 'next-intl';
import { logger } from '@/lib/logger';
import { extractUrlsFromText } from '@/lib/brand-monitor-sources';
import { cleanProviderResponse } from '@/lib/provider-response-utils';

interface DetectionResult {
  brandMentioned: boolean;
  detectionDetails: {
    brandMatches: Array<{
      text: string;
      index: number;
      brandName: string;
      variation: string;
      confidence: number;
    }>;
    competitorMatches: Map<string, Array<{
      text: string;
      index: number;
      brandName: string;
      variation: string;
      confidence: number;
    }>>;
  };
  confidence: number;
}

interface PromptsResponsesTabProps {
  prompts: BrandPrompt[];
  responses: AIResponse[];
  expandedPromptIndex: number | null;
  onToggleExpand: (index: number | null) => void;
  brandName: string;
  competitors: string[];
  webSearchUsed?: boolean;
  hideWebSearchSources?: boolean;
  brandVariations?: Record<string, BrandVariation>;
}

// Provider icon mapping
const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'OpenAI':
      return (
        <img 
          src="/OpenAI_logo.svg" 
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
          src="/Perplexity_logo.svg" 
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
  hideWebSearchSources = false,
  brandVariations,
}: PromptsResponsesTabProps) {
  const t = useTranslations('brandMonitor');
  const [allExpanded, setAllExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Track which (prompt, provider) sources list is expanded beyond 3
  // const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [detectionCache, setDetectionCache] = useState<Map<string, DetectionResult>>(new Map());

  useEffect(() => {
    if (!responses || responses.length === 0) return;

    // Unable to detect without precomputed variations (client-side env has no API key)
    if (!brandVariations || Object.keys(brandVariations).length === 0) {
      detectionCache.clear();
      return;
    }

    let cancelled = false;

    const runDetection = async () => {
      const updates: Array<[string, DetectionResult]> = [];

      for (const response of responses) {
        const cacheKey = `${response.provider}:${response.prompt}`;
        if (detectionCache.has(cacheKey)) continue;

        try {
          const cleanedText = cleanProviderResponse(response.response, { providerName: response.provider });
          
          // Use the new BrandMatcher API
          const apiResponse = await fetch('/api/brand-detection/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              text: cleanedText, 
              brandVariations 
            })
          });
          
          if (!apiResponse.ok) {
            throw new Error(`Brand detection API failed: ${apiResponse.status}`);
          }
          
          const { matches, brandIdToName } = await apiResponse.json();
          
          // Convert matches to DetectionResult format
          const allBrands = [brandName, ...competitors];
          const brandMatches: Array<{
            text: string;
            index: number;
            brandName: string;
            variation: string;
            confidence: number;
          }> = [];
          
          const competitorMatches = new Map<string, Array<{
            text: string;
            index: number;
            brandName: string;
            variation: string;
            confidence: number;
          }>>();
          
          // Initialize competitor matches map
          competitors.forEach(competitor => {
            competitorMatches.set(competitor, []);
          });
          
          // Process matches en mappant vers la marque cible ou concurrents connus
          const normalize = (v: string) => v.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
          const knownNames = new Map<string, string>();
          [brandName, ...competitors].forEach(n => knownNames.set(normalize(n), n));
          const mapToKnown = (name: string) => {
            const n = normalize(name);
            if (knownNames.has(n)) return knownNames.get(n)!;
            for (const [kn, original] of knownNames.entries()) {
              if (n.includes(kn) || kn.includes(n)) return original;
            }
            return name;
          };

          matches.forEach((match: { brandId: string; surface: string; start: number; end: number }) => {
            const displayName = mapToKnown((brandIdToName && brandIdToName[match.brandId]) || match.brandId);
            const matchData = {
              text: match.surface,
              index: match.start,
              brandName: displayName,
              variation: match.surface,
              confidence: 1.0
            };
            
            if (displayName === brandName) {
              brandMatches.push(matchData);
            } else if (competitors.includes(displayName)) {
              competitorMatches.get(displayName)!.push(matchData);
            }
          });
          
          const detection: DetectionResult = {
            brandMentioned: brandMatches.length > 0,
            detectionDetails: {
              brandMatches,
              competitorMatches
            },
            confidence: brandMatches.length > 0 ? 1.0 : 0
          };

          updates.push([cacheKey, detection]);
        } catch (error) {
          logger.error('[PromptsResponsesTab] Shared detection failed:', error);
        }
      }

      if (cancelled || updates.length === 0) return;

      setDetectionCache((prev) => {
        const next = new Map(prev);
        updates.forEach(([key, detection]) => {
          if (!next.has(key)) {
            next.set(key, detection);
          }
        });
        return next;
      });
    };

    runDetection();

    return () => {
      cancelled = true;
    };
  }, [responses, brandName, competitors, brandVariations, detectionCache]);
  
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
        const hasBrandMention = promptResponses.some(response => {
          const cacheKey = `${response.provider}:${response.prompt}`;
          const detection = detectionCache.get(cacheKey);
          return detection?.brandMentioned ?? false;
        });
        
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
                    const cacheKey = `${providerResponse.provider}:${providerResponse.prompt}`;
                    const detection = detectionCache.get(cacheKey);
                    const detectedMention = detection?.brandMentioned ?? false;
                    
                    return (
                      <div key={providerName} className="relative flex items-center">
                        <div className="w-6 h-6 flex items-center justify-center">
                          {getProviderIcon(providerName)}
                        </div>
                        {isFailed ? (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 flex items-center justify-center bg-red-500 rounded-full border border-white">
                            <span className="text-white text-xs font-bold leading-none">×</span>
                          </div>
                        ) : detectedMention ? (
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
                      const cacheKey = `${response.provider}:${response.prompt}`;
                      const detection = detectionCache.get(cacheKey);
                      const detectedMention = detection?.brandMentioned ?? false;

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
                          ) : detectedMention ? (
                            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                              Brand Mentioned
                            </Badge>
                          ) : null}
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
                              brandVariations={brandVariations}
                              showHighlighting={true}
                              renderMarkdown={true}
                              hideWebSearchSources={hideWebSearchSources}
                            />
                          )}
                        </div>
                        {!hideWebSearchSources && !isFailed && (() => {
                          // Prefer structured urls from provider; fallback to text extraction
                          const structured = Array.isArray(response.urls) ? response.urls : [];
                          let items: { url: string; title?: string }[];
                          if (structured.length > 0) {
                            // Deduplicate by URL, preserve order
                            const seen = new Set<string>();
                            const dedup: { url: string; title?: string }[] = [];
                            for (const u of structured) {
                              const key = (u.url || '').trim().toLowerCase();
                              if (key && !seen.has(key)) {
                                seen.add(key);
                                dedup.push({ url: u.url, title: u.title });
                              }
                            }
                            items = dedup;
                          } else {
                            const urls = extractUrlsFromText(response.response || '');
                            items = urls.map((u) => ({ url: u }));
                          }
                          if (!items || items.length === 0) return null;
                          
                          return (
                            <SourcesList 
                              sources={items}
                              maxVisible={3}
                            />
                          );
                        })()}
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
