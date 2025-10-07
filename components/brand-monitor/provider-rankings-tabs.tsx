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

// Provider icon mapping
const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'OpenAI':
      return (
        <img 
          src="https://cdn.brandfetch.io/idR3duQxYl/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1749527471692" 
          alt="OpenAI" 
          className="w-7 h-7"
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
        <div className="w-7 h-7 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-7 h-7">
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
          src="https://cdn.brandfetch.io/idNdawywEZ/w/800/h/800/theme/dark/idgTrPQ4JH.png?c=1bxid64Mup7aczewSAYMX&t=1754453397133" 
          alt="Perplexity" 
          className="w-6 h-6"
        />
      );
    default:
      return <div className="w-7 h-7 bg-gray-400 rounded" />;
  }
};

interface ProviderRankingsTabsProps {
  providerRankings: ProviderSpecificRanking[];
  brandName: string;
  shareOfVoice?: number;
  averagePosition?: number;
  sentimentScore?: number;
  weeklyChange?: number;
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
  brandName,
  shareOfVoice,
  averagePosition,
<<<<<<< Updated upstream
  sentimentScore
=======
  sentimentScore,
  weeklyChange,
  identifiedCompetitors
>>>>>>> Stashed changes
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
  const brandVisibility = selectedCompetitors.find(c => c.isOwn)?.visibilityScore || 0;

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
                  {getProviderIcon(provider)}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {providerRankings.map(({ provider, competitors: providerCompetitors }) => (
            <TabsContent key={provider} value={provider} className="mt-0">
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-left p-3 text-xs font-medium text-gray-900 w-8">#</th>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-left p-3 text-xs font-medium text-gray-900 w-[200px]">{t('company')}</th>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-right p-3 text-xs font-medium text-gray-900">{t('visibility')}</th>
                      <th className="bg-gray-50 border-b border-r border-gray-200 text-right p-3 text-xs font-medium text-gray-900">{t('shareOfVoice')}</th>
                      <th className="bg-gray-50 border-b border-gray-200 text-right p-3 text-xs font-medium text-gray-900">{t('sentiment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerCompetitors.map((competitor, idx) => {
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
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
