/**
 * Brand highlighting utilities for text processing
 * Extracted from HighlightedResponse component for better reusability
 */

import React from 'react';

export interface BrandHighlightingConfig {
  targetBrand: string;
  competitors: string[];
  targetHighlightClass: string;
  competitorHighlightClass: string;
  defaultHighlightClass: string;
}

export interface BrandDetectionResultForHighlighting {
  mentioned: boolean;
  matches: Array<{
    text: string;
    index: number;
    brandName: string;
    variation: string;
    confidence: number;
  }>;
  confidence: number;
}

/**
 * Get the appropriate CSS class for a brand based on its type
 */
export function getBrandHighlightClass(
  brandName: string,
  config: BrandHighlightingConfig
): string {
  const normalizedBrand = brandName.toLowerCase();
  const normalizedTarget = config.targetBrand.toLowerCase();
  const competitorSet = new Set(config.competitors.map((c) => c.toLowerCase()));

  if (normalizedBrand === normalizedTarget) {
    return config.targetHighlightClass;
  }
  if (competitorSet.has(normalizedBrand)) {
    return config.competitorHighlightClass;
  }
  return config.defaultHighlightClass;
}

/**
 * Create highlighted HTML for a text based on brand detection results
 * Uses position-based approach to avoid recursive replacements that cause duplications
 */
export function createHighlightedHtml(
  text: string,
  detectionResults: Map<string, BrandDetectionResultForHighlighting>,
  config: BrandHighlightingConfig
): string {
  // Early return for empty text or no matches
  if (!text || text.trim().length === 0 || detectionResults.size === 0) {
    return text;
  }

  // Collect all matches with their positions by searching in the actual text
  const allMatches: Array<{
    start: number;
    end: number;
    brandName: string;
    text: string;
    className: string;
    confidence: number;
  }> = [];

  detectionResults.forEach((result, brandName) => {
    if (!result.mentioned || result.matches.length === 0) return;
    const className = getBrandHighlightClass(brandName, config);
    
    // Get unique variations for this brand (use the actual matched texts)
    const variations = [...new Set(result.matches.map((m) => m.text))].sort((a, b) => b.length - a.length);
    
    variations.forEach((variation) => {
      // Search for the variation in the actual text instead of using provided index
      const escaped = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        // Avoid duplicate matches at the same position
        const isDuplicate = allMatches.some(existing => 
          existing.start === match.index && existing.end === match.index + match[0].length
        );
        
        if (!isDuplicate) {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            brandName,
            text: match[0],
            className,
            confidence: result.matches.find(m => m.text === variation)?.confidence || 0.5
          });
        }
      }
    });
  });

  // Early return if no valid matches
  if (allMatches.length === 0) {
    return text;
  }

  // Sort matches by position
  allMatches.sort((a, b) => a.start - b.start);
  
  // Resolve overlapping matches (keep the one with higher confidence)
  const nonOverlapping = allMatches.reduce((acc, match) => {
    const lastMatch = acc[acc.length - 1];
    if (!lastMatch || match.start >= lastMatch.end) {
      // No overlap
      acc.push(match);
    } else if (match.confidence > lastMatch.confidence) {
      // Overlap but this match has higher confidence
      acc[acc.length - 1] = match;
    }
    // Otherwise keep the existing match
    return acc;
  }, [] as typeof allMatches);

  // Build the final HTML in a single pass
  let result = '';
  let lastEnd = 0;

  nonOverlapping.forEach(match => {
    // Add text before this match
    if (match.start > lastEnd) {
      result += text.substring(lastEnd, match.start);
    }
    
    // Add highlighted match
    result += `<span class="${match.className}" data-brand-highlight="true" data-brand-name="${match.brandName}">${match.text}</span>`;
    
    lastEnd = match.end;
  });

  // Add remaining text
  if (lastEnd < text.length) {
    result += text.substring(lastEnd);
  }

  return result;
}

/**
 * Highlight text with brand mentions using React components
 */
export function highlightTextWithBrands(
  text: string,
  detectionResults: Map<string, BrandDetectionResultForHighlighting>,
  config: BrandHighlightingConfig,
  showHighlighting: boolean = true
): React.ReactNode {
  // Early returns for edge cases
  if (!showHighlighting || !text || text.trim().length < 3 || detectionResults.size === 0) {
    return text;
  }

  const highlightedText = createHighlightedHtml(text, detectionResults, config);

  // Return original text if no highlighting was applied
  if (highlightedText === text) {
    return text;
  }

  return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
}

/**
 * Recursively highlight brand mentions in React children (for markdown processing)
 */
export function highlightMarkdownChildren(
  children: React.ReactNode,
  detectionResults: Map<string, BrandDetectionResultForHighlighting>,
  config: BrandHighlightingConfig,
  showHighlighting: boolean = true
): React.ReactNode {
  return React.Children.map(children, (child) => {
    // Process text nodes
    if (typeof child === 'string') {
      return child.trim().length > 0
        ? (highlightTextWithBrands(
            child,
            detectionResults,
            config,
            showHighlighting
          ) as React.ReactNode)
        : child;
    }

    if (typeof child === 'number') {
      return highlightTextWithBrands(String(child), detectionResults, config, showHighlighting);
    }

    // Process React elements
    if (React.isValidElement(child)) {
      const props = child.props as {
        children?: React.ReactNode;
        'data-brand-highlight'?: boolean;
      };
      // Skip already processed elements
      if (props['data-brand-highlight']) {
        return child;
      }

      // Recursively process children
      if (props.children) {
        return React.cloneElement(child, {
          children: highlightMarkdownChildren(
            props.children,
            detectionResults,
            config,
            showHighlighting
          ),
        });
      }

      return child;
    }

    // Process arrays
    if (Array.isArray(child)) {
      return highlightMarkdownChildren(child, detectionResults, config, showHighlighting);
    }

    return child;
  });
}
