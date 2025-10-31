'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Dot
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetitorMetricSeries } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';

interface MetricTrendChartProps {
  title: string;
  series: CompetitorMetricSeries[];
  metricType: string;
  targetBrand: string;
  height?: number;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
  reverseYAxis?: boolean;
  titleTooltip?: string;
  subtitle?: string;
}

export function MetricTrendChart({
  title,
  series,
  metricType,
  targetBrand,
  height = 400,
  yAxisLabel,
  formatValue = (value) => value.toString(),
  reverseYAxis = false,
  titleTooltip,
  subtitle
}: MetricTrendChartProps) {
  const brandColor = '#f97316';
  const competitorPalette = [
    '#6366f1',
    '#0ea5e9',
    '#14b8a6',
    '#f43f5e',
    '#facc15',
    '#8b5cf6',
    '#22c55e',
    '#ec4899',
    '#06b6d4',
    '#94a3b8'
  ];

  const competitorColors = React.useMemo(() => {
    const colorMap = new Map<string, string>();
    let paletteIndex = 0;

    series.forEach((serie) => {
      const key = serie.competitor.trim().toLowerCase();
      if (colorMap.has(key)) {
        return;
      }

      if (serie.isOwn) {
        colorMap.set(key, brandColor);
        return;
      }

      const color = competitorPalette[paletteIndex % competitorPalette.length];
      colorMap.set(key, color);
      paletteIndex += 1;
    });

    return colorMap;
  }, [series]);

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
        dataPoint[`${serie.competitor}-${serie.provider}`] = point ? point.value : null;
      });

      return dataPoint;
    });
  }, [series]);

  // Générer les couleurs pour chaque série
  const getSeriesColor = (serie: CompetitorMetricSeries) => {
    const key = serie.competitor.trim().toLowerCase();
    return competitorColors.get(key) ?? brandColor;
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
            const [competitor] = entry.dataKey.split('-');
            const serie = series.find(s => 
              s.competitor === competitor && `${s.competitor}-${s.provider}` === entry.dataKey
            );
            const rawValue = entry.value;
            const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
            const formattedValue = Number.isFinite(numericValue)
              ? formatValue(numericValue)
              : 'N/A';
            
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium">
                  {competitor}
                </span>
                <span className="font-semibold">
                  {formattedValue}
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

  const yAxisLabelProps = yAxisLabel
    ? {
        label: {
          value: yAxisLabel,
          angle: -90,
          position: 'insideLeft' as const,
          style: {
            textAnchor: 'middle',
            fill: '#4b5563',
            fontWeight: 500
          },
          offset: -10
        }
      }
    : {};

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2">
          <span>{title}</span>
          {titleTooltip && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={titleTooltip}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    <InfoCircledIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="max-w-xs text-left">
                  {titleTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
        {subtitle && (
          <CardDescription>
            {subtitle}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: height * 0.1,
                bottom: height * 0.1,
                left: 32,
                right: 32
              }}
            >
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
                {...yAxisLabelProps}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                align="left"
                iconType="circle"
                wrapperStyle={{
                  paddingTop: 4,
                  fontSize: 12,
                  marginLeft: 32,
                  marginRight: 32,
                  width: 'calc(100% - 64px)'
                }}
              />
              
              {series.map((serie, index) => (
                <Line
                  key={`${serie.competitor}-${serie.provider}`}
                  type="monotone"
                  dataKey={`${serie.competitor}-${serie.provider}`}
                  stroke={getSeriesColor(serie)}
                  strokeWidth={getSeriesStrokeWidth(serie)}
                  dot={({ cx, cy, payload }) => {
                    const value = payload[`${serie.competitor}-${serie.provider}`];
                    if (value === null || value === undefined) return <></>;
                    
                    return (
                      <Dot
                        key={payload.fullDate || `${serie.competitor}-${serie.provider}-${cx}-${cy}`}
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
                  name={serie.competitor}
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
