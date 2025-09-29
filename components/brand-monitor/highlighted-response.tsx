'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AIResponse } from '@/lib/types';
import { useBrandDetection } from '@/hooks/useBrandDetection';
import type { BrandDetectionResult, BrandDetectionMatch } from '@/lib/brand-detection-service';
import { highlightBrandMentions, segmentsToReactElements, type HighlightedSegment } from '@/lib/text-highlighting-utils';
import { 
  highlightTextWithBrands, 
  highlightMarkdownChildren as highlightMarkdownChildrenUtil,
  type BrandHighlightingConfig 
} from '@/lib/brand-highlighting-utils';

// Simple in-memory cache to avoid redundant brand detection calls
// Keyed by JSON.stringify of { text, brands }
const detectionResultsCache = new Map<string, Map<string, BrandDetectionResult>>();

interface HighlightedResponseProps {
  response: AIResponse;
  brandName: string;
  competitors: string[];
  showHighlighting?: boolean;
  highlightClassName?: string;
  renderMarkdown?: boolean;
}

type DetectionMatch = {
  text: string;
  index: number;
  confidence: number;
  pattern?: string;
};

const TARGET_HIGHLIGHT_CLASS = 'bg-orange-100 text-orange-900 font-semibold px-1 rounded-sm border border-orange-200';
const COMPETITOR_HIGHLIGHT_CLASS = 'bg-gray-200 text-gray-900 font-medium px-1 rounded-sm border border-gray-300';
const DEFAULT_HIGHLIGHT_CLASS = 'bg-gray-100 text-gray-900 px-1 rounded-sm';

// Clean up response text by removing artifacts
function cleanResponseText(text: string, providerName?: string): string {
  let cleaned = text;
  
  // Remove standalone numbers at the beginning of lines (like "0\n")
  cleaned = cleaned.replace(/^\d+\n/gm, '');
  
  // Remove provider name at the beginning if it exists
  if (providerName) {
    const providerPattern = new RegExp(`^${providerName}\\s*\n?`, 'i');
    cleaned = cleaned.replace(providerPattern, '');
  }
  
  // Remove common provider names at the beginning
  const commonProviders = ['OpenAI', 'Anthropic', 'Google', 'Perplexity'];
  commonProviders.forEach(provider => {
    const pattern = new RegExp(`^${provider}\\s*\n?`, 'i');
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Remove HTML tags but preserve the content
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // Remove inline "Sources consultées" section if present
  cleaned = cleaned.replace(/\n?Sources consultées?:[\s\S]*$/i, '').trim();

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return cleaned.trim();
}

export function HighlightedResponse({
  response,
  brandName,
  competitors,
  showHighlighting = true,
  highlightClassName = DEFAULT_HIGHLIGHT_CLASS,
  renderMarkdown = true
}: HighlightedResponseProps) {
  const cleanedResponse = cleanResponseText(response.response, response.provider);
  const { detectMultipleBrands, isLoading: isDetectionLoading, error: detectionError, clearError } = useBrandDetection();
  
  // State for enhanced detection results
  const [enhancedDetectionResults, setEnhancedDetectionResults] = React.useState<Map<string, BrandDetectionResult>>(new Map());
  
  // State for fallback detection (simple text matching)
  const [fallbackDetectionResults, setFallbackDetectionResults] = React.useState<Map<string, BrandDetectionResult>>(new Map());
  const [useFallback, setUseFallback] = React.useState(false);

  const normalizedTargetBrand = React.useMemo(() => brandName.trim().toLowerCase(), [brandName]);

  const competitorNameSet = React.useMemo(() => {
    const set = new Set<string>();
    competitors.forEach((competitor) => {
      if (!competitor) return;
      const normalized = competitor.trim().toLowerCase();
      if (normalized) {
        set.add(normalized);
      }
    });
    return set;
  }, [competitors]);

  const allBrandCandidates = React.useMemo(() => {
    const seen = new Set<string>();
    const names = [brandName, ...competitors];

    return names
      .map((name) => (typeof name === 'string' ? name.trim() : ''))
      .filter((name) => {
        if (!name) return false;
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [brandName, competitors]);

  // Fonction de fallback simple pour la détection de marques
  const performFallbackDetection = React.useCallback((text: string, brands: string[]): Map<string, BrandDetectionResult> => {
    const results = new Map<string, BrandDetectionResult>();
    
    brands.forEach(brand => {
      const matches: BrandDetectionMatch[] = [];
      const brandLower = brand.toLowerCase();
      const textLower = text.toLowerCase();
      
      // Recherche simple insensible à la casse
      let index = 0;
      while ((index = textLower.indexOf(brandLower, index)) !== -1) {
        // Vérifier que c'est un mot complet (pas une partie d'un autre mot)
        const before = index > 0 ? textLower[index - 1] : ' ';
        const after = index + brandLower.length < textLower.length ? textLower[index + brandLower.length] : ' ';
        
        if (!/[a-zA-Z0-9]/.test(before) && !/[a-zA-Z0-9]/.test(after)) {
          matches.push({
            text: text.substring(index, index + brandLower.length),
            index,
            brandName: brand,
            variation: brand,
            confidence: 0.5 // Confiance plus faible pour le fallback
          });
        }
        index += brandLower.length;
      }
      
      results.set(brand, {
        mentioned: matches.length > 0,
        matches,
        confidence: matches.length > 0 ? 0.5 : 0
      });
    });
    
    console.log(`[Fallback Detection] Détection simple pour ${brands.length} marques: ${results.size} résultats`);
    return results;
  }, []);

  // Enhanced detection with intelligent AI variations
  const cacheKey = React.useMemo(() => {
    // Stable cache key for this response + candidates
    return JSON.stringify({ text: cleanedResponse, brands: allBrandCandidates });
  }, [cleanedResponse, allBrandCandidates]);

  React.useEffect(() => {
    // Decide if we need enhanced detection:
    // - No highlighting → skip
    // - If provider supplied detection details AND competitor matches, skip
    const hasProviderDetails = Boolean(response.detectionDetails);
    const providerHasCompetitors = hasProviderDetails && Boolean(
      (response.detectionDetails as any)?.competitorMatches &&
      ((response.detectionDetails as any)?.competitorMatches instanceof Map
        ? (response.detectionDetails as any)?.competitorMatches.size > 0
        : Object.keys((response.detectionDetails as any)?.competitorMatches || {}).length > 0)
    );

    if (!showHighlighting || (hasProviderDetails && providerHasCompetitors)) {
      // Skip if highlighting is disabled or provider already supplied competitor matches
      return;
    }

    const performIntelligentDetection = async () => {
      try {
        // Use cache if available
        const cached = detectionResultsCache.get(cacheKey);
        if (cached) {
          setEnhancedDetectionResults(cached);
          setUseFallback(false);
          return;
        }

        const results = await detectMultipleBrands(cleanedResponse, allBrandCandidates, {
          caseSensitive: false,
          excludeNegativeContext: false,
          minConfidence: 0.3
        });
        
        setEnhancedDetectionResults(results);
        setUseFallback(false);
        detectionResultsCache.set(cacheKey, results);
      } catch (error) {
        console.error('Intelligent brand detection failed, using fallback:', error);
        
        // Utiliser le fallback en cas d'erreur
        const fallbackResults = performFallbackDetection(cleanedResponse, allBrandCandidates);
        setFallbackDetectionResults(fallbackResults);
        setUseFallback(true);
        setEnhancedDetectionResults(new Map());
        
        // Effacer l'erreur après avoir activé le fallback
        clearError();
      }
    };

    performIntelligentDetection();
  }, [cacheKey, cleanedResponse, allBrandCandidates, showHighlighting, response.detectionDetails]);

  const detectionResults = React.useMemo(() => {
    if (!showHighlighting) return new Map();

    const results = new Map<string, BrandDetectionResult>();

    // Seed from provider details if present
    if (response.detectionDetails) {
      if (response.detectionDetails.brandMatches && response.detectionDetails.brandMatches.length > 0) {
        const convertedMatches: BrandDetectionMatch[] = response.detectionDetails.brandMatches.map(match => ({
          text: match.text,
          index: match.index,
          brandName: brandName,
          variation: brandName, // legacy
          confidence: match.confidence
        }));
        results.set(brandName, {
          mentioned: true,
          matches: convertedMatches,
          confidence: Math.max(...response.detectionDetails.brandMatches.map((m) => m.confidence))
        });
      }

      const cm = (response.detectionDetails as any).competitorMatches;
      if (cm) {
        if (cm instanceof Map) {
          cm.forEach((matches: any[], competitor: string) => {
            if (Array.isArray(matches) && matches.length > 0) {
              const convertedMatches: BrandDetectionMatch[] = matches.map((match: any) => ({
                text: match.text,
                index: match.index,
                brandName: competitor,
                variation: competitor, // legacy
                confidence: match.confidence
              }));
              results.set(competitor, {
                mentioned: true,
                matches: convertedMatches,
                confidence: Math.max(...convertedMatches.map((m) => m.confidence))
              });
            }
          });
        } else {
          Object.entries(cm as Record<string, any[]>).forEach(([competitor, matches]) => {
            if (Array.isArray(matches) && matches.length > 0) {
              const convertedMatches: BrandDetectionMatch[] = matches.map((match: any) => ({
                text: match.text,
                index: match.index,
                brandName: competitor,
                variation: competitor, // legacy
                confidence: match.confidence
              }));
              results.set(competitor, {
                mentioned: true,
                matches: convertedMatches,
                confidence: Math.max(...convertedMatches.map((m) => m.confidence))
              });
            }
          });
        }
      }
    }

    // Merge in enhanced results to fill missing competitors (e.g., Perplexity)
    if (enhancedDetectionResults.size > 0) {
      enhancedDetectionResults.forEach((enh, name) => {
        const existing = results.get(name);
        if (!existing || existing.matches.length === 0) {
          results.set(name, enh);
        }
      });
    }

    // Si on utilise le fallback, fusionner les résultats de fallback
    if (useFallback && fallbackDetectionResults.size > 0) {
      fallbackDetectionResults.forEach((fallback, name) => {
        const existing = results.get(name);
        if (!existing || existing.matches.length === 0) {
          results.set(name, fallback);
        }
      });
    }

    return results;
  }, [brandName, response, showHighlighting, enhancedDetectionResults, useFallback, fallbackDetectionResults]);

  const segments = React.useMemo(() => {
    if (!showHighlighting || renderMarkdown) return [];
    return highlightBrandMentions(cleanedResponse, detectionResults);
  }, [cleanedResponse, detectionResults, showHighlighting, renderMarkdown]);

  const highlightClassResolver = React.useCallback((segment: HighlightedSegment) => {
    const matchedBrand = segment.brandName?.trim().toLowerCase();
    if (!matchedBrand) return highlightClassName;

    if (normalizedTargetBrand && matchedBrand === normalizedTargetBrand) {
      return TARGET_HIGHLIGHT_CLASS;
    }

    if (competitorNameSet.has(matchedBrand)) {
      return COMPETITOR_HIGHLIGHT_CLASS;
    }

    return highlightClassName;
  }, [competitorNameSet, highlightClassName, normalizedTargetBrand]);

  const highlightedElements = React.useMemo(() => {
    if (!showHighlighting || renderMarkdown) return [];
    return segmentsToReactElements(segments, highlightClassResolver);
  }, [segments, showHighlighting, highlightClassResolver, renderMarkdown]);

  const uniqueKeyRef = React.useRef(0);
  uniqueKeyRef.current = 0;

  // Configuration for brand highlighting
  const highlightingConfig: BrandHighlightingConfig = React.useMemo(() => ({
    targetBrand: brandName,
    competitors,
    targetHighlightClass: TARGET_HIGHLIGHT_CLASS,
    competitorHighlightClass: COMPETITOR_HIGHLIGHT_CLASS,
    defaultHighlightClass: highlightClassName
  }), [brandName, competitors, highlightClassName]);

  // Simplified highlighting functions using utilities
  const highlightString = React.useCallback((text: string): React.ReactNode => {
    return highlightTextWithBrands(text, detectionResults, highlightingConfig, showHighlighting);
  }, [detectionResults, highlightingConfig, showHighlighting]);

  const highlightMarkdownChildren = React.useCallback((children: React.ReactNode): React.ReactNode => {
    return highlightMarkdownChildrenUtil(children, detectionResults, highlightingConfig, showHighlighting);
  }, [detectionResults, highlightingConfig, showHighlighting]);

  // Indicateur de mode fallback
  const fallbackIndicator = useFallback && (
    <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
      <span className="font-medium">Mode de détection simplifiée :</span> La détection intelligente des marques n'est pas disponible. Utilisation d'une détection basique.
    </div>
  );

  if (!showHighlighting) {
    if (renderMarkdown) {
      return (
        <div>
          {fallbackIndicator}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              table: ({ children }) => (
                <div className="overflow-x-auto my-4 max-w-full">
                  <table className="w-full max-w-full border-collapse border border-gray-300 text-xs table-fixed">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
              th: ({ children }) => (
                <th className="border border-gray-300 px-2 py-1 text-left font-semibold bg-gray-100">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-gray-300 px-2 py-1">
                  {children}
                </td>
              )
            }}
          >
            {cleanedResponse}
          </ReactMarkdown>
        </div>
      );
    }

    return (
      <div>
        {fallbackIndicator}
        {cleanedResponse}
      </div>
    );
  }

  if (renderMarkdown) {
    return (
      <div className="prose prose-sm max-w-full prose-slate overflow-hidden">
        {fallbackIndicator}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-3 leading-relaxed">{highlightMarkdownChildren(children)}</p>,
            ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{highlightMarkdownChildren(children)}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{highlightMarkdownChildren(children)}</ol>,
            li: ({ children }) => <li className="text-sm">{highlightMarkdownChildren(children)}</li>,
            strong: ({ children }) => <strong className="font-semibold text-gray-900">{highlightMarkdownChildren(children)}</strong>,
            em: ({ children }) => <em className="italic">{highlightMarkdownChildren(children)}</em>,
            h1: ({ children }) => <h1 className="text-lg font-bold mb-3 text-gray-900">{highlightMarkdownChildren(children)}</h1>,
            h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-gray-900">{highlightMarkdownChildren(children)}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 text-gray-900">{highlightMarkdownChildren(children)}</h3>,
            table: ({ children }) => (
              <div className="overflow-x-auto my-4 max-w-full">
                <table className="w-full max-w-full border-collapse border border-gray-300 text-xs table-fixed">
                  {highlightMarkdownChildren(children)}
                </table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-gray-50">{highlightMarkdownChildren(children)}</thead>,
            tbody: ({ children }) => <tbody>{highlightMarkdownChildren(children)}</tbody>,
            tr: ({ children }) => <tr className="border-b border-gray-200">{highlightMarkdownChildren(children)}</tr>,
            th: ({ children }) => (
              <th className="border border-gray-300 px-2 py-1 text-left font-semibold bg-gray-100">
                {highlightMarkdownChildren(children)}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 px-2 py-1">
                {highlightMarkdownChildren(children)}
              </td>
            ),
            code: ({ children, className }) => {
              if (className?.includes('language-')) {
                return (
                  <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto mb-3">
                    <code>{children}</code>
                  </pre>
                );
              }
              return <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{children}</code>;
            },
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-3">
                {highlightMarkdownChildren(children)}
              </blockquote>
            )
          }}
        >
          {cleanedResponse}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div>
      {fallbackIndicator}
      <div className="whitespace-pre-wrap">{highlightedElements}</div>
    </div>
  );
}

// Export a simpler version for use in tooltips or previews
export function HighlightedText({
  text,
  brandName,
  competitors = [],
  highlightClassName = DEFAULT_HIGHLIGHT_CLASS
}: {
  text: string;
  brandName: string;
  competitors?: string[];
  highlightClassName?: string;
}) {
  const { detectMultipleBrands } = useBrandDetection();
  const normalizedTargetBrand = React.useMemo(() => brandName.trim().toLowerCase(), [brandName]);

  const competitorNameSet = React.useMemo(() => {
    const set = new Set<string>();
    competitors.forEach((competitor) => {
      if (!competitor) return;
      const normalized = competitor.trim().toLowerCase();
      if (normalized) {
        set.add(normalized);
      }
    });
    return set;
  }, [competitors]);

  const brandCandidates = React.useMemo(() => {
    const seen = new Set<string>();
    const candidates = [brandName, ...competitors];

    return candidates
      .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
      .filter((candidate) => {
        if (!candidate) return false;
        const key = candidate.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [brandName, competitors]);

  const highlightClassResolver = React.useCallback((segment: HighlightedSegment) => {
    const matchedBrand = segment.brandName?.trim().toLowerCase();
    if (!matchedBrand) return highlightClassName;

    if (normalizedTargetBrand && matchedBrand === normalizedTargetBrand) {
      return TARGET_HIGHLIGHT_CLASS;
    }

    if (competitorNameSet.has(matchedBrand)) {
      return COMPETITOR_HIGHLIGHT_CLASS;
    }

    return highlightClassName;
  }, [competitorNameSet, highlightClassName, normalizedTargetBrand]);

  const [detectionResults, setDetectionResults] = React.useState<Map<string, BrandDetectionResult>>(new Map());

  React.useEffect(() => {
    const performDetection = async () => {
      try {
        const results = await detectMultipleBrands(text, brandCandidates, {
          caseSensitive: false,
          excludeNegativeContext: false,
          minConfidence: 0.3
        });
        setDetectionResults(results);
      } catch (error) {
        console.error('Brand detection failed:', error);
        setDetectionResults(new Map());
      }
    };

    performDetection();
  }, [brandCandidates, text]);

  const segments = React.useMemo(() => highlightBrandMentions(text, detectionResults), [text, detectionResults]);

  const elements = React.useMemo(
    () => segmentsToReactElements(segments, highlightClassResolver),
    [segments, highlightClassResolver]
  );

  return <>{elements}</>;
}
