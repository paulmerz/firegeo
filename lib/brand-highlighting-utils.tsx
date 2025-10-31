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
    
    // Use the already detected matches instead of re-searching
    result.matches.forEach((match) => {
      // Only include matches that are actually in the current text
      if (match.index >= 0 && match.index < text.length) {
        allMatches.push({
          start: match.index,
          end: match.index + match.text.length,
          brandName,
          text: match.text,
          className,
          confidence: match.confidence
        });
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

  // Project global indices to this local text by re-finding surfaces with word boundaries
  const localized = new Map<string, BrandDetectionResultForHighlighting>();
  const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);
  const findAll = (hay: string, needle: string): number[] => {
    const positions: number[] = [];
    if (!needle) return positions;
    let start = 0;
    while (start <= hay.length - needle.length) {
      const idx = hay.indexOf(needle, start);
      if (idx === -1) break;
      const before = hay[idx - 1];
      const after = hay[idx + needle.length];
      const leftOk = !isWordChar(before);
      const rightOk = !isWordChar(after);
      if (leftOk && rightOk) positions.push(idx);
      start = idx + Math.max(needle.length, 1);
    }
    return positions;
  };

  detectionResults.forEach((res, brand) => {
    const locMatches: typeof res.matches = [];
    const seenSpans = new Set<string>();
    res.matches.forEach((m) => {
      const positions = findAll(text, m.text);
      positions.forEach((p) => {
        const key = `${p}:${p + m.text.length}`;
        if (seenSpans.has(key)) return;
        seenSpans.add(key);
        locMatches.push({
          text: m.text,
          index: p,
          brandName: brand,
          variation: m.variation,
          confidence: m.confidence,
        });
      });
    });
    if (locMatches.length > 0) {
      localized.set(brand, { mentioned: true, matches: locMatches, confidence: res.confidence });
    }
  });

  const highlightedText = createHighlightedHtml(text, localized, config);

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
        return React.createElement(
          child.type,
          props,
          highlightMarkdownChildren(
            props.children,
            detectionResults,
            config,
            showHighlighting
          )
        );
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
