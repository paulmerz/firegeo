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
 */
export function createHighlightedHtml(
  text: string,
  detectionResults: Map<string, BrandDetectionResultForHighlighting>,
  config: BrandHighlightingConfig
): string {
  let highlightedText = text;

  detectionResults.forEach((result, brandName) => {
    if (!result.mentioned || result.matches.length === 0) return;

    // Get unique variations for this brand (use the actual matched texts)
    const variations = [...new Set(result.matches.map((m) => m.text))];
    const className = getBrandHighlightClass(brandName, config);

    variations.forEach((variation) => {
      const escaped = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');

      highlightedText = highlightedText.replace(
        regex,
        (match) =>
          `<span class="${className}" data-brand-highlight="true" data-brand-name="${brandName}">${match}</span>`
      );
    });
  });

  return highlightedText;
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
