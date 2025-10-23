'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AIResponse, type BrandVariation } from '@/lib/types';
import type { BrandDetectionResult, BrandDetectionMatch } from '@/lib/brand-detection-service';
import { highlightBrandMentions, segmentsToReactElements, type HighlightedSegment } from '@/lib/text-highlighting-utils';
import {
  highlightMarkdownChildren as highlightMarkdownChildrenUtil,
  type BrandHighlightingConfig
} from '@/lib/brand-highlighting-utils';
import { cleanProviderResponse } from '@/lib/provider-response-utils';
import { detectBrandsInResponse } from '@/lib/brand-detection-service';
import { useBrandDetection } from '@/hooks/useBrandDetection';
import { maskUrlsInText } from '@/lib/text-url-masking';

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
  brandVariations?: Record<string, BrandVariation>;
  hideWebSearchSources?: boolean;
}

const TARGET_HIGHLIGHT_CLASS = 'bg-orange-100 text-orange-900 font-semibold px-1 rounded-sm border border-orange-200';
const COMPETITOR_HIGHLIGHT_CLASS = 'bg-gray-200 text-gray-900 font-medium px-1 rounded-sm border border-gray-300';
const DEFAULT_HIGHLIGHT_CLASS = 'bg-gray-100 text-gray-900 px-1 rounded-sm';

export function HighlightedResponse({
  response,
  brandName,
  competitors,
  showHighlighting = true,
  highlightClassName = DEFAULT_HIGHLIGHT_CLASS,
  renderMarkdown = true,
  brandVariations,
  hideWebSearchSources = false
}: HighlightedResponseProps) {
  const cleanedResponse = cleanProviderResponse(response.response, { providerName: response.provider });
  const maskedResponse = maskUrlsInText(cleanedResponse, hideWebSearchSources);
  const [enhancedDetectionResults, setEnhancedDetectionResults] = React.useState<Map<string, BrandDetectionResult>>(new Map());

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

  // Enhanced detection with intelligent AI variations
  const cacheKey = React.useMemo(() => {
    // Stable cache key for this response + candidates
    return JSON.stringify({ text: maskedResponse, brands: allBrandCandidates });
  }, [maskedResponse, allBrandCandidates]);

  React.useEffect(() => {
    // Impossible d'exécuter la détection locale sans variations pré-calculées (pas de clé API côté client)
    if (!brandVariations || Object.keys(brandVariations).length === 0) {
      detectionResultsCache.delete(cacheKey);
      setEnhancedDetectionResults(new Map());
      return;
    }

    if (!showHighlighting) {
      // Skip if highlighting is disabled
      return;
    }

    const performDetection = async () => {
      try {
        const cached = detectionResultsCache.get(cacheKey);
        if (cached) {
          setEnhancedDetectionResults(cached);
          return;
        }

        const detection = await detectBrandsInResponse(
          maskedResponse,
          brandName,
          competitors,
          {
            caseSensitive: false,
            excludeNegativeContext: false,
            minConfidence: 0.3
          },
          undefined,
          brandVariations
        );

        const results = new Map<string, BrandDetectionResult>();
        results.set(brandName, {
          mentioned: detection.brandMentioned,
          matches: detection.detectionDetails.brandMatches || [],
          confidence: detection.confidence
        });

        detection.detectionDetails.competitorMatches.forEach((matches, competitor) => {
          results.set(competitor, {
            mentioned: matches.length > 0,
            matches,
            confidence: matches.length > 0 ? Math.max(...matches.map(m => m.confidence)) : 0
          });
        });

        detectionResultsCache.set(cacheKey, results);
        setEnhancedDetectionResults(results);
      } catch (error) {
        console.error('Shared brand detection failed:', error);
        setEnhancedDetectionResults(new Map());
      }
    };

    performDetection();
  }, [cacheKey, maskedResponse, showHighlighting, brandName, competitors, brandVariations]);

  const detectionResults = React.useMemo(() => {
    if (!showHighlighting) return new Map();

    const results = new Map<string, BrandDetectionResult>();

    // Use enhanced results for all detection
    if (enhancedDetectionResults.size > 0) {
      enhancedDetectionResults.forEach((enh, name) => {
        results.set(name, enh);
      });
    }

    return results;
  }, [showHighlighting, enhancedDetectionResults]);

  const segments = React.useMemo(() => {
    if (!showHighlighting || renderMarkdown) return [];
    return highlightBrandMentions(maskedResponse, detectionResults);
  }, [maskedResponse, detectionResults, showHighlighting, renderMarkdown]);

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

  // Configuration for brand highlighting
  const highlightingConfig: BrandHighlightingConfig = React.useMemo(() => ({
    targetBrand: brandName,
    competitors,
    targetHighlightClass: TARGET_HIGHLIGHT_CLASS,
    competitorHighlightClass: COMPETITOR_HIGHLIGHT_CLASS,
    defaultHighlightClass: highlightClassName
  }), [brandName, competitors, highlightClassName]);

  // Simplified highlighting functions using utilities
  const highlightMarkdownChildren = React.useCallback((children: React.ReactNode): React.ReactNode => {
    return highlightMarkdownChildrenUtil(children, detectionResults, highlightingConfig, showHighlighting);
  }, [detectionResults, highlightingConfig, showHighlighting]);

  if (!showHighlighting) {
    if (renderMarkdown) {
      return (
        <div>
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
            {maskedResponse}
          </ReactMarkdown>
        </div>
      );
    }

    return (
      <div>{maskedResponse}</div>
    );
  }

  if (renderMarkdown) {
    return (
      <div className="prose prose-sm max-w-full prose-slate overflow-hidden">
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
          {maskedResponse}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap">{highlightedElements}</div>
  );
}

// Export a simpler version for use in tooltips or previews
export function HighlightedText({
  text,
  brandName,
  competitors = [],
  highlightClassName = DEFAULT_HIGHLIGHT_CLASS,
  brandVariations,
  hideWebSearchSources = false
}: {
  text: string;
  brandName: string;
  competitors?: string[];
  highlightClassName?: string;
  brandVariations?: Record<string, BrandVariation>;
  hideWebSearchSources?: boolean;
}) {
  const maskedText = maskUrlsInText(text, hideWebSearchSources);
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
        // If brand variations are provided, use them for more efficient detection
        if (brandVariations && Object.keys(brandVariations).length > 0) {
          const results = new Map<string, BrandDetectionResult>();
          
          for (const brandName of brandCandidates) {
            const variation = brandVariations[brandName];
            if (variation) {
              const textLower = text.toLowerCase();
              const matches: BrandDetectionMatch[] = [];
              
              // Simple text matching with pre-generated variations
              variation.variations.forEach((variationText: string) => {
                const index = textLower.indexOf(variationText.toLowerCase());
                if (index !== -1) {
                  matches.push({
                    text: maskedText.substring(index, index + variationText.length),
                    index,
                    brandName,
                    variation: variationText,
                    confidence: variation.confidence
                  });
                }
              });
              
              results.set(brandName, {
                mentioned: matches.length > 0,
                matches,
                confidence: matches.length > 0 ? variation.confidence : 0
              });
            }
          }
          
          setDetectionResults(results);
        } else {
          // Fallback to full AI detection
          const results = await detectMultipleBrands(maskedText, brandCandidates, {
            caseSensitive: false,
            excludeNegativeContext: false,
            minConfidence: 0.3
          });
          setDetectionResults(results);
        }
      } catch (error) {
        console.error('Brand detection failed:', error);
        setDetectionResults(new Map());
      }
    };

    performDetection();
  }, [brandCandidates, maskedText, brandVariations, detectMultipleBrands, text]);

  const segments = React.useMemo(() => highlightBrandMentions(maskedText, detectionResults), [maskedText, detectionResults]);

  const elements = React.useMemo(
    () => segmentsToReactElements(segments, highlightClassResolver),
    [segments, highlightClassResolver]
  );

  return <>{elements}</>;
}
