'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetitorMetricSeries } from '@/lib/types';

interface MetricTrendChartProps {
  title: string;
  series: CompetitorMetricSeries[];
  metricType: string;
  targetBrand: string;
  height?: number;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
  reverseYAxis?: boolean;
}

export function MetricTrendChart({
  title,
  series,
  metricType,
  targetBrand,
  height = 400,
  yAxisLabel,
  formatValue = (value) => value.toString(),
  reverseYAxis = false
}: MetricTrendChartProps) {
  // Transformer les données pour recharts
  const chartData = React.useMemo(() => {
    // Créer un map de toutes les dates uniques
    const allDates = new Set<string>();
    series.forEach(serie => {
      serie.dataPoints.forEach(point => {
        allDates.add(point.date.toISOString().split('T')[0]);
      });
    });

    // Créer les données pour chaque date
    const dates = Array.from(allDates).sort();
    
    return dates.map(date => {
      const dataPoint: Record<string, any> = {
        date: new Date(date).toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: '2-digit' 
        }),
        fullDate: date
      };

      // Ajouter les valeurs pour chaque série
      series.forEach(serie => {
        const point = serie.dataPoints.find(p => 
          p.date.toISOString().split('T')[0] === date
        );
        dataPoint[`${serie.competitor}-${serie.provider}`] = point?.value || null;
      });

      return dataPoint;
    });
  }, [series]);

  // Générer les couleurs pour chaque série
  const getSeriesColor = (serie: CompetitorMetricSeries) => {
    if (serie.isOwn) {
      return '#f97316'; // Orange pour la marque cible
    }
    return '#6b7280'; // Gris pour les concurrents
  };

  const getSeriesStrokeWidth = (serie: CompetitorMetricSeries) => {
    return serie.isOwn ? 3 : 1; // Ligne plus épaisse pour la marque cible
  };

  // Configuration du tooltip personnalisé
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            const [competitor, provider] = entry.dataKey.split('-');
            const serie = series.find(s => 
              s.competitor === competitor && s.provider === provider
            );
            
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium">
                  {competitor} {serie?.isOwn && '(Votre marque)'}
                </span>
                <span className="text-gray-500">({provider})</span>
                <span className="font-semibold">
                  {formatValue(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (series.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {yAxisLabel || `Évolution du ${metricType}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            Aucune donnée disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {yAxisLabel || `Évolution du ${metricType}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                fontSize={12}
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
                domain={reverseYAxis ? ['dataMax', 'dataMin'] : ['dataMin', 'dataMax']}
                label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {series.map((serie, index) => (
                <Line
                  key={`${serie.competitor}-${serie.provider}`}
                  type="monotone"
                  dataKey={`${serie.competitor}-${serie.provider}`}
                  stroke={getSeriesColor(serie)}
                  strokeWidth={getSeriesStrokeWidth(serie)}
                  dot={({ cx, cy, payload }) => {
                    const value = payload[`${serie.competitor}-${serie.provider}`];
                    if (value === null || value === undefined) return null;
                    
                    return (
                      <Dot
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={getSeriesColor(serie)}
                        stroke={getSeriesColor(serie)}
                        strokeWidth={2}
                        className="hover:r-6 transition-all duration-200"
                      />
                    );
                  }}
                  connectNulls={false}
                  name={`${serie.competitor} ${serie.isOwn ? '(Votre marque)' : ''} (${serie.provider})`}
                  className={`${serie.isOwn ? '' : 'hover:stroke-blue-500 transition-colors duration-200'}`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
