import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalysisSource } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';

interface SourcesTabProps {
  sources: AnalysisSource[];
}

function getHostname(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    const { hostname } = new URL(normalized);
    return hostname.replace(/^www\./i, '') || hostname;
  } catch {
    return url;
  }
}

function getProviderLogo(provider?: string): { url?: string; alt: string } {
  const name = (provider || '').toLowerCase();
  if (name.includes('openai')) {
    return { url: '/OpenAI_logo.svg', alt: 'OpenAI' };
  }
  if (name.includes('perplexity')) {
    return { url: '/Perplexity_logo.svg', alt: 'Perplexity' };
  }
  return { url: undefined, alt: provider || '—' };
}

interface DomainGroup {
  domain: string;
  sources: AnalysisSource[];
}

function groupSourcesByDomain(sources: AnalysisSource[]): DomainGroup[] {
  const groups = new Map<string, AnalysisSource[]>();
  
  sources.forEach(source => {
    const domain = getHostname(source.url) || 'Autres sources';
    if (!groups.has(domain)) {
      groups.set(domain, []);
    }
    groups.get(domain)!.push(source);
  });
  
  return Array.from(groups.entries())
    .map(([domain, sources]) => ({ domain, sources }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

export function SourcesTab({ sources }: SourcesTabProps) {
  const t = useTranslations('brandMonitor.sourcesTab');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  const domainGroups = useMemo(() => {
    if (!Array.isArray(sources)) {
      return [];
    }
    return groupSourcesByDomain(sources);
  }, [sources]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domain)) {
        newSet.delete(domain);
      } else {
        newSet.add(domain);
      }
      return newSet;
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {domainGroups.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-500 text-center p-6 border border-dashed border-gray-200 rounded-lg">
            {t('empty')}
          </div>
        ) : (
          <div className="space-y-2">
            {domainGroups.map((group) => {
              const isExpanded = expandedDomains.has(group.domain);
              const totalSources = group.sources.length;
              
              return (
                <div key={group.domain} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleDomain(group.domain)}
                    className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{group.domain}</span>
                      <span className="text-sm text-gray-500">({totalSources} source{totalSources > 1 ? 's' : ''})</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 uppercase text-xs tracking-wide">
                              <th className="py-2 pr-4 font-medium">{t('provider')}</th>
                              <th className="py-2 pr-4 font-medium">Prompt lié</th>
                              <th className="py-2 font-medium">Lien</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.sources.map((source, index) => {
                              const key = source.id ?? `${source.url ?? 'source'}-${index}`;
                              return (
                                <tr key={key} className="border-t border-gray-100 align-top">
                                  <td className="py-3 pr-4 whitespace-nowrap text-gray-900 font-medium">
                                    {(() => {
                                      const logo = getProviderLogo(source.provider);
                                      return (
                                        <div className="flex items-center gap-2">
                                          {logo.url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={logo.url} alt={logo.alt} className="h-4 w-4 rounded-sm" />
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                          <span>{source.provider || logo.alt || '—'}</span>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-3 pr-4 text-gray-700 max-w-xs">
                                    <div className="break-words">
                                      {source.prompt ? (
                                        <span className="text-sm">{source.prompt}</span>
                                      ) : (
                                        <span className="text-gray-400 italic">Non spécifié</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 text-gray-900">
                                    {source.url ? (
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 break-all"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        {source.title?.trim() || source.url}
                                      </a>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
