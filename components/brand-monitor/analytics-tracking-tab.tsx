'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp, 
  BarChart3, 
  Target, 
  Loader2,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { MetricTrendChart } from './metric-trend-chart';
import { CompetitorMetricSeries, MetricsHistoryResponse } from '@/lib/types';
import { logger } from '@/lib/logger';

interface AnalyticsTrackingTabProps {
  analysisId: string;
  competitors: Array<{ name: string; url?: string }>;
  targetBrand: string;
}

export function AnalyticsTrackingTab({ 
  analysisId, 
  competitors, 
  targetBrand 
}: AnalyticsTrackingTabProps) {
  const t = useTranslations('brandMonitor.analyticsTracking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [metricsData, setMetricsData] = useState<{
    visibility: CompetitorMetricSeries[];
    rankings: CompetitorMetricSeries[];
    matrix: Record<string, CompetitorMetricSeries[]>;
  }>({
    visibility: [],
    rankings: [],
    matrix: {}
  });

  // Charger les données des métriques
  useEffect(() => {
    const fetchMetricsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Récupérer les providers disponibles
        const providersResponse = await fetch(`/api/brand-monitor/analyses/${analysisId}/metrics-history?metricType=visibility_score`);
        if (!providersResponse.ok) {
          throw new Error('Failed to fetch providers');
        }
        
        const providersData = await providersResponse.json() as MetricsHistoryResponse;
        const providers = [...new Set(providersData.series.map(s => s.provider))];
        setAvailableProviders(providers);
        setSelectedProviders(providers); // Sélectionner tous par défaut

        // Charger les données pour chaque type de métrique
        const [visibilityData, rankingsData] = await Promise.all([
          fetchMetricsHistory('visibility_score'),
          fetchMetricsHistory('average_position')
        ]);

        // Charger les données de matrice par provider
        const matrixData: Record<string, CompetitorMetricSeries[]> = {};
        for (const provider of providers) {
          matrixData[provider] = await fetchMetricsHistory('visibility_score', [provider]);
        }

        setMetricsData({
          visibility: visibilityData,
          rankings: rankingsData,
          matrix: matrixData
        });

      } catch (err) {
        logger.error('Failed to fetch analytics data:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchMetricsData();
  }, [analysisId]);

  const fetchMetricsHistory = async (
    metricType: string, 
    providers?: string[]
  ): Promise<CompetitorMetricSeries[]> => {
    const params = new URLSearchParams({
      metricType,
      ...(providers && { providers: providers.join(',') })
    });

    const response = await fetch(`/api/brand-monitor/analyses/${analysisId}/metrics-history?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${metricType} data`);
    }

    const data = await response.json() as MetricsHistoryResponse;
    return data.series;
  };

  const handleProviderChange = async (providers: string[]) => {
    setSelectedProviders(providers);
    
    // Recharger les données avec les nouveaux providers
    try {
      const [visibilityData, rankingsData] = await Promise.all([
        fetchMetricsHistory('visibility_score', providers),
        fetchMetricsHistory('average_position', providers)
      ]);

      setMetricsData(prev => ({
        ...prev,
        visibility: visibilityData,
        rankings: rankingsData
      }));
    } catch (err) {
      logger.error('Failed to update metrics data:', err);
    }
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

  const hasData = metricsData.visibility.length > 0 || metricsData.rankings.length > 0;

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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">{t('selectProviders')}:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableProviders.map(provider => (
                <Badge
                  key={provider}
                  variant={selectedProviders.includes(provider) ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    selectedProviders.includes(provider) 
                      ? 'bg-orange-500 hover:bg-orange-600' 
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    const newProviders = selectedProviders.includes(provider)
                      ? selectedProviders.filter(p => p !== provider)
                      : [...selectedProviders, provider];
                    handleProviderChange(newProviders);
                  }}
                >
                  {provider}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score de visibilité global */}
      {metricsData.visibility.length > 0 && (
        <MetricTrendChart
          title={t('visibilityScoreChart')}
          series={metricsData.visibility}
          metricType="visibility_score"
          targetBrand={targetBrand}
          yAxisLabel="Score de visibilité (%)"
          formatValue={formatVisibilityValue}
        />
      )}

      {/* Matrice de comparaison par provider */}
      {Object.entries(metricsData.matrix).map(([provider, series]) => {
        if (series.length === 0 || !selectedProviders.includes(provider)) return null;
        
        return (
          <MetricTrendChart
            key={`matrix-${provider}`}
            title={t('comparisonMatrixChart', { provider })}
            series={series}
            metricType="visibility_score"
            targetBrand={targetBrand}
            yAxisLabel="Score de visibilité (%)"
            formatValue={formatVisibilityValue}
          />
        );
      })}

      {/* Classement des marques par provider */}
      {Object.entries(metricsData.matrix).map(([provider, series]) => {
        if (series.length === 0 || !selectedProviders.includes(provider)) return null;
        
        // Convertir les données de visibilité en classement
        const rankingSeries = series.map(serie => ({
          ...serie,
          dataPoints: serie.dataPoints.map(point => ({
            ...point,
            value: serie.dataPoints
              .filter(p => p.date.getTime() === point.date.getTime())
              .sort((a, b) => b.value - a.value)
              .findIndex(p => p.runId === point.runId) + 1
          }))
        }));

        return (
          <MetricTrendChart
            key={`rankings-${provider}`}
            title={t('rankingsChart', { provider })}
            series={rankingSeries}
            metricType="average_position"
            targetBrand={targetBrand}
            yAxisLabel="Position dans le classement"
            formatValue={formatPositionValue}
            reverseYAxis={true}
          />
        );
      })}
    </div>
  );
}
