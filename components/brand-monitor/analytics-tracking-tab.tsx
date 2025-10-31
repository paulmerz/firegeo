'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  BarChart3, 
  Loader2,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { MetricTrendChart } from './metric-trend-chart';
import { CompetitorMetricSeries, MetricsHistoryResponse, MetricDataPoint } from '@/lib/types';
import { logger } from '@/lib/logger';
import { ProviderIcon } from './provider-icon';
import { Input } from '@/components/ui/input';

interface AnalyticsTrackingTabProps {
  analysisId: string;
  competitors: Array<{ name: string; url?: string }>;
  targetBrand: string;
}

const normalizeSeriesDates = (
  series: CompetitorMetricSeries[]
): CompetitorMetricSeries[] =>
  series.map(serie => ({
    ...serie,
    dataPoints: serie.dataPoints.map(point => {
      const rawDate = point.date as unknown;
      const dateValue = rawDate instanceof Date ? rawDate : new Date(rawDate as string | number);

      if (Number.isNaN(dateValue.getTime())) {
        logger.warn('Invalid date in metrics history', {
          runId: point.runId,
          rawDate: point.date,
        });
        return {
          ...point,
          date: new Date(0)
        };
      }

      return {
        ...point,
        date: dateValue
      };
    })
  }));

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const clampToToday = (value: string) => {
  const today = new Date();
  const todayValue = toDateInputValue(today);
  if (!value) return todayValue;
  return value > todayValue ? todayValue : value;
};

export function AnalyticsTrackingTab({ 
  analysisId, 
  competitors, 
  targetBrand 
}: AnalyticsTrackingTabProps) {
  const t = useTranslations('brandMonitor.analyticsTracking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [metricsByProvider, setMetricsByProvider] = useState<Record<string, {
    visibility: CompetitorMetricSeries[];
    rankings: CompetitorMetricSeries[];
    mentions: CompetitorMetricSeries[];
    shareOfVoice: CompetitorMetricSeries[];
  }>>({});
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return {
      start: toDateInputValue(start),
      end: toDateInputValue(end)
    };
  });
  const [draftDateRange, setDraftDateRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return {
      start: toDateInputValue(start),
      end: toDateInputValue(end)
    };
  });

  // Charger les données des métriques
  useEffect(() => {
    const fetchMetricsData = async () => {
      try {
        setLoading(true);
        setError(null);

        const normalizeProvider = (name: string | null | undefined) => (name ?? '').trim();

        const [visibilityRaw, rankingsRaw, mentionsRaw, shareOfVoiceRaw] = await Promise.all([
          fetchMetricsHistory('visibility_score'),
          fetchMetricsHistory('average_position'),
          fetchMetricsHistory('mentions'),
          fetchMetricsHistory('share_of_voices')
        ]);

        const visibilityData = visibilityRaw.map((serie) => ({
          ...serie,
          provider: normalizeProvider(serie.provider)
        }));

        const rankingsData = rankingsRaw.map((serie) => ({
          ...serie,
          provider: normalizeProvider(serie.provider)
        }));

        const mentionsData = mentionsRaw.map((serie) => ({
          ...serie,
          provider: normalizeProvider(serie.provider)
        }));

        const shareOfVoiceData = shareOfVoiceRaw.map((serie) => ({
          ...serie,
          provider: normalizeProvider(serie.provider)
        }));

        const providerSet = new Set<string>();
        const addProvider = (serie: CompetitorMetricSeries) => {
          const providerName = serie.provider;
          if (!providerName) return;
          if (providerName.toLowerCase() === 'all') return;
          providerSet.add(providerName);
        };
        visibilityData.forEach(addProvider);
        rankingsData.forEach(addProvider);
        mentionsData.forEach(addProvider);
        shareOfVoiceData.forEach(addProvider);

        const providers = Array.from(providerSet);
        setAvailableProviders(providers);

        const groupedMetrics = providers.reduce<Record<string, {
          visibility: CompetitorMetricSeries[];
          rankings: CompetitorMetricSeries[];
          mentions: CompetitorMetricSeries[];
          shareOfVoice: CompetitorMetricSeries[];
        }>>((acc, provider) => {
          acc[provider] = {
            visibility: visibilityData.filter((serie) => serie.provider === provider),
            rankings: rankingsData.filter((serie) => serie.provider === provider),
            mentions: mentionsData.filter((serie) => serie.provider === provider),
            shareOfVoice: shareOfVoiceData.filter((serie) => serie.provider === provider)
          };
          return acc;
        }, {});

        setMetricsByProvider(groupedMetrics);
        setSelectedProvider((current) => {
          if (current && providers.includes(current)) {
            return current;
          }
          return providers[0] ?? null;
        });

      } catch (err) {
        logger.error('Failed to fetch analytics data:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchMetricsData();
  }, [analysisId, dateRange.start, dateRange.end]);

  useEffect(() => {
    setDraftDateRange(dateRange);
  }, [dateRange]);

  const fetchMetricsHistory = async (
    metricType: string, 
    providers?: string[]
  ): Promise<CompetitorMetricSeries[]> => {
    const params = new URLSearchParams({
      metricType,
      ...(providers && providers.length > 0 ? { providers: providers.join(',') } : {})
    });

    const normalizeDateForApi = (value: string, endOfDay = false) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      if (endOfDay) {
        date.setHours(23, 59, 59, 999);
      } else {
        date.setHours(0, 0, 0, 0);
      }
      return date.toISOString();
    };

    const startIso = normalizeDateForApi(dateRange.start);
    const endIso = normalizeDateForApi(dateRange.end, true);

    if (startIso) {
      params.set('startDate', startIso);
    }

    if (endIso) {
      params.set('endDate', endIso);
    }

    const response = await fetch(`/api/brand-monitor/analyses/${analysisId}/metrics-history?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${metricType} data`);
    }

    const data = await response.json() as MetricsHistoryResponse;
  return normalizeSeriesDates(data.series);
  };

  const formatVisibilityValue = (value: number) => `${value.toFixed(1)}%`;
  const formatPositionValue = (value: number) => `#${Math.round(value)}`;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-500" />
            <p className="text-gray-600">Chargement des données analytiques...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentMetrics = selectedProvider ? metricsByProvider[selectedProvider] : undefined;
  const visibilitySeries = currentMetrics?.visibility ?? [];
  const mentionsSeries = currentMetrics?.mentions ?? [];
  const shareOfVoiceSeries = currentMetrics?.shareOfVoice ?? [];
  const hasData = Object.values(metricsByProvider).some((metrics) => (
    metrics.visibility.length > 0 ||
    metrics.rankings.length > 0 ||
    metrics.mentions.length > 0 ||
    metrics.shareOfVoice.length > 0
  ));
  const providerGridClass = (() => {
    switch (availableProviders.length) {
      case 0:
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-3';
      default:
        return 'grid-cols-4';
    }
  })();
  const matrixSeries = visibilitySeries;
  const rankingSeries = matrixSeries.map((serie) => ({
    ...serie,
    dataPoints: serie.dataPoints.map((point) => {
      const pointsSameDate = matrixSeries
        .map((candidate) => candidate.dataPoints.find((p) => p.date.getTime() === point.date.getTime()))
        .filter((candidate): candidate is MetricDataPoint => Boolean(candidate));

      const sorted = [...pointsSameDate].sort((a, b) => b.value - a.value);
      const position = sorted.findIndex((p) => p.runId === point.runId) + 1;

      return {
        ...point,
        value: position > 0 ? position : sorted.length
      };
    })
  }));

  const todayValue = toDateInputValue(new Date());

  const handleStartDateCommit = (value: string) => {
    if (!value) return;
    setDateRange((prev) => {
      const clampedEnd = prev.end < value ? value : prev.end;
      return {
        start: value,
        end: clampToToday(clampedEnd)
      };
    });
  };

  const handleEndDateCommit = (value: string) => {
    if (!value) return;
    const clampedValue = clampToToday(value);
    setDateRange((prev) => {
      const start = prev.start > clampedValue ? clampedValue : prev.start;
      return {
        start,
        end: clampedValue
      };
    });
  };

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-2">{t('noData')}</p>
            <p className="text-sm text-gray-500">
              Les données apparaîtront après plusieurs exécutions d'analyses planifiées
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec contrôles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">{t('selectProvider')}:</span>
          </div>
          {availableProviders.length > 0 && selectedProvider && (
            <Tabs value={selectedProvider} onValueChange={(value) => setSelectedProvider(value)} className="w-full">
              <TabsList className={`grid w-full sm:w-auto h-14 gap-2 ${providerGridClass}`}>
                {availableProviders.map((provider) => (
                  <TabsTrigger
                    key={provider}
                    value={provider}
                    className="flex h-full items-center justify-center"
                    title={provider}
                  >
                    <ProviderIcon provider={provider} size="md" />
                    <span className="sr-only">{provider}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="metrics-start-date" className="text-sm font-medium text-gray-700">
                {t('startDate')}
              </label>
              <Input
                id="metrics-start-date"
                type="date"
                value={draftDateRange.start}
                max={draftDateRange.end}
                onChange={(event) => setDraftDateRange((prev) => ({ ...prev, start: event.target.value }))}
                onBlur={(event) => handleStartDateCommit(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="metrics-end-date" className="text-sm font-medium text-gray-700">
                {t('endDate')}
              </label>
              <Input
                id="metrics-end-date"
                type="date"
                value={draftDateRange.end}
                min={draftDateRange.start}
                max={todayValue}
                onChange={(event) => setDraftDateRange((prev) => ({ ...prev, end: event.target.value }))}
                onBlur={(event) => handleEndDateCommit(event.target.value)}
              />
            </div>
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Score de visibilité */}
      {selectedProvider && matrixSeries.length > 0 && (
        <MetricTrendChart
          key={`matrix-${selectedProvider}`}
          title={`${t('visibilityScoreChart')} (%)`}
          series={matrixSeries}
          metricType="visibility_score"
          targetBrand={targetBrand}
          yAxisLabel="Score de visibilité (%)"
          formatValue={formatVisibilityValue}
          titleTooltip={t('visibilityScoreTooltip')}
        />
      )}

      {/* Nombre de mentions */}
      {selectedProvider && mentionsSeries.length > 0 && (
        <MetricTrendChart
          key={`mentions-${selectedProvider}`}
          title={t('mentionsChart')}
          series={mentionsSeries}
          metricType="mentions"
          targetBrand={targetBrand}
          yAxisLabel={t('mentionsYAxis')}
          formatValue={(value) => value.toString()}
        />
      )}

      {/* Part de voix */}
      {selectedProvider && shareOfVoiceSeries.length > 0 && (
        <MetricTrendChart
          key={`share-of-voice-${selectedProvider}`}
          title={`${t('shareOfVoiceChart')} (%)`}
          series={shareOfVoiceSeries}
          metricType="share_of_voices"
          targetBrand={targetBrand}
          yAxisLabel={t('shareOfVoiceYAxis')}
          formatValue={formatVisibilityValue}
          titleTooltip={t('shareOfVoiceTooltip')}
        />
      )}

      {/* Classement des marques */}
      {selectedProvider && rankingSeries.length > 0 && (
        <MetricTrendChart
          key={`rankings-${selectedProvider}`}
          title={t('rankingsChart')}
          series={rankingSeries}
          metricType="average_position"
          targetBrand={targetBrand}
          titleTooltip={t('rankingsChartTooltip')}
          formatValue={formatPositionValue}
          reverseYAxis={true}
        />
      )}
    </div>
  );
}
