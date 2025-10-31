'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProviderSpecificRanking } from '@/lib/types';
import { IdentifiedCompetitor } from '@/lib/brand-monitor-reducer';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CompetitorCell } from './competitor-cell';
import { ProviderIcon } from './provider-icon';

interface ProviderRankingsTabsProps {
  providerRankings: ProviderSpecificRanking[];
  identifiedCompetitors?: IdentifiedCompetitor[];
}

// Generate a fallback URL from competitor name
const generateFallbackUrl = (competitorName: string): string | undefined => {
  // Clean the name for URL generation - preserve hyphens as they're common in domain names
  const cleanName = competitorName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Keep hyphens along with alphanumeric and spaces
    .replace(/\s+/g, '-') // Replace spaces with hyphens for URL
    .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .trim();
  
  if (cleanName.length < 3 || ['inc', 'llc', 'corp', 'company', 'the'].includes(cleanName)) {
    return undefined;
  }
  
  return `${cleanName}.com`;
};

export function ProviderRankingsTabs({ 
  providerRankings,
  identifiedCompetitors
}: ProviderRankingsTabsProps) {
  const t = useTranslations('brandMonitor.providerRankings');
  const [selectedProvider, setSelectedProvider] = useState(
    providerRankings?.[0]?.provider || 'OpenAI'
  );

  if (!providerRankings || providerRankings.length === 0) return null;

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <Badge variant="secondary" className="bg-green-50 text-black text-xs">{t('positive')}</Badge>;
      case 'negative':
        return <Badge variant="secondary" className="bg-red-50 text-black text-xs">{t('negative')}</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-50 text-black text-xs">{t('neutral')}</Badge>;
    }
  };

  const getChangeIcon = (change: number | undefined) => {
    if (!change) return <Minus className="h-3 w-3 text-gray-400" />;
    if (change > 0) return <TrendingUp className="h-3 w-3 text-black" />;
    return <TrendingDown className="h-3 w-3 text-black" />;
  };

  // Get the selected provider's data
  const selectedProviderData = providerRankings.find(p => p.provider === selectedProvider);
  const selectedCompetitors = selectedProviderData?.competitors || [];
  const competitorList = identifiedCompetitors ?? [];

  const findCompetitorData = (name: string): IdentifiedCompetitor | undefined => {
    const normalized = name.trim().toLowerCase();
    const simplified = normalized.replace(/[^a-z0-9]/g, '');

    return competitorList.find((competitor) => {
      const candidate = competitor.name.trim().toLowerCase();
      if (candidate === normalized) {
        return true;
      }

      const candidateSimplified = candidate.replace(/[^a-z0-9]/g, '');
      return Boolean(candidateSimplified) && candidateSimplified === simplified;
    });
  };
  const brandRank = selectedCompetitors.findIndex(c => c.isOwn) + 1;

  return (
    <Card className="p-2 bg-card text-card-foreground gap-6 rounded-xl border py-6 shadow-sm border-gray-200 h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">{t('title')}</CardTitle>
            <CardDescription className="text-sm text-gray-600 mt-1">
              {t('description')}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-600">#{brandRank}</p>
            <p className="text-xs text-gray-500 mt-1">{t('averageRank')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 pb-2 flex-1 flex flex-col">
        <Tabs value={selectedProvider} onValueChange={setSelectedProvider} className="flex-1 flex flex-col">
          <TabsList className={`grid w-full mb-2 h-14 ${providerRankings.length === 2 ? 'grid-cols-2' : providerRankings.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {providerRankings.map(({ provider }) => {
              // Provider info is now handled by icon mapping directly
              return (
                <TabsTrigger 
                  key={provider} 
                  value={provider} 
                  className="text-sm flex items-center justify-center h-full"
                  title={provider}
                >
                  <ProviderIcon provider={provider} size="lg" />
                </TabsTrigger>
              );
            })}
          </TabsList>

          {providerRankings.map(({ provider, competitors: providerCompetitors }) => {
            const sortedCompetitors = [...providerCompetitors].sort((a, b) => {
              const visibilityDiff = (b.visibilityScore ?? 0) - (a.visibilityScore ?? 0);
              if (visibilityDiff !== 0) return visibilityDiff;
              return (b.mentions ?? 0) - (a.mentions ?? 0);
            });

            return (
            <TabsContent key={provider} value={provider} className="mt-0">
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-left p-3 text-xs font-medium text-gray-900 w-8">#</th>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-left p-3 text-xs font-medium text-gray-900 w-[200px]">{t('company')}</th>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-right p-3 text-xs font-medium text-gray-900">{t('visibility')}</th>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-right p-3 text-xs font-medium text-gray-900">{t('mentions')}</th>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-right p-3 text-xs font-medium text-gray-900">{t('shareOfVoice')}</th>
                      <th className="bg-gray-50 border-b border-gray-200 text-right p-3 text-xs font-medium text-gray-900">{t('sentiment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCompetitors.map((competitor, idx) => {
                      const competitorData = findCompetitorData(competitor.name);
                      const competitorUrl = competitorData?.url || generateFallbackUrl(competitor.name);
                      
                      return (
                        <tr 
                          key={idx} 
                          className={`
                            ${idx > 0 ? 'border-t border-gray-200' : ''}
                            ${competitor.isOwn 
                              ? 'bg-orange-50' 
                              : 'hover:bg-gray-50 transition-colors'
                            }
                          `}
                        >
                          <td className="border-r border-gray-200 p-3 text-xs text-black">
                            {idx + 1}
                          </td>
                          <td className="border-r border-gray-200 p-3">
                            <CompetitorCell 
                              name={competitor.name}
                              isOwn={competitor.isOwn}
                              favicon={competitorData?.metadata?.favicon}
                              description={competitorData?.metadata?.description}
                              url={competitorUrl}
                            />
                          </td>
                          <td className="border-r border-gray-200 p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-sm font-medium text-black">
                                {competitor.visibilityScore}%
                              </span>
                              {competitor.weeklyChange !== undefined && competitor.weeklyChange !== 0 && (
                                getChangeIcon(competitor.weeklyChange)
                              )}
                            </div>
                          </td>
                          <td className="border-r border-gray-200 p-3 text-right">
                            <span className="text-sm font-medium text-black">
                              {competitor.mentions || 0}
                            </span>
                          </td>
                          <td className="border-r border-gray-200 p-3 text-right">
                            <span className="text-sm text-black">
                              {competitor.shareOfVoice}%
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {getSentimentBadge(competitor.sentiment)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
