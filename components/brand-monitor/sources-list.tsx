'use client';

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SourceItem {
  url: string;
  title?: string;
}

interface SourcesListProps {
  sources: SourceItem[];
  maxVisible?: number;
  className?: string;
}

export function SourcesList({ 
  sources, 
  maxVisible = 6, 
  className = '' 
}: SourcesListProps) {
  const t = useTranslations('brandMonitor.sourcesList');
  const [showAll, setShowAll] = useState(false);
  
  if (!sources || sources.length === 0) {
    return null;
  }

  const visibleSources = showAll ? sources : sources.slice(0, maxVisible);
  const hasMore = sources.length > maxVisible;

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./i, '');
    } catch {
      return url;
    }
  };

  return (
    <div className={`mt-2 ${className}`}>
      <div className="text-xs text-gray-500 mb-1">{t('title')}</div>
      <div className="flex flex-wrap gap-2">
        {visibleSources.map((source, index) => {
          const host = getHostname(source.url);
          const title = source.title?.trim() || source.url;
          
          return (
            <a
              key={`${source.url}-${index}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 break-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {title} ({host})
            </a>
          );
        })}
      </div>
      
      {hasMore && (
        <div className="mt-2">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
          >
            {showAll ? t('showLess') : t('showMore', { count: sources.length - maxVisible })}
          </button>
        </div>
      )}
    </div>
  );
}
