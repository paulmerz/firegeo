'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, DollarSign, Clock, Zap, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ApiUsageSummary {
  totalCalls: number;
  totalCost: number;
  totalDuration: number;
  byProvider: Record<string, {
    calls: number;
    cost: number;
    tokens: { input: number; output: number };
  }>;
  byOperation: Record<string, {
    calls: number;
    cost: number;
    providers: string[];
  }>;
  byPhase: Record<string, {
    calls: number;
    cost: number;
    duration: number;
    providers: string[];
    averageCostPerCall?: number;
    promptAnalysis?: {
      totalPrompts: number;
      averageCostPerPrompt: number;
    };
  }>;
  errors: number;
}

interface ApiUsageSummaryProps {
  summary: ApiUsageSummary | null;
  isVisible?: boolean;
  onToggle?: () => void;
}

export function ApiUsageSummary({ summary, isVisible = false, onToggle }: ApiUsageSummaryProps) {
  const t = useTranslations('brandMonitor');
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary) return null;

  // Vérifier que les propriétés nécessaires existent et les initialiser si nécessaire
  const safeSummary = {
    ...summary,
    byPhase: summary.byPhase || {},
    byProvider: summary.byProvider || {},
    byOperation: summary.byOperation || {}
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const formatDuration = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
  const formatTokens = (tokens: number) => tokens.toLocaleString();

  const getOperationName = (operation: string) => {
    const names: Record<string, string> = {
      'scrape': 'Scraping initial',
      'competitor_search': 'Recherche de concurrents',
      'prompt_generation': 'Génération de prompts',
      'analysis': 'Analyse des résultats',
      'brand_canonicalization': 'Normalisation des marques',
      'brand_cleaning': 'Nettoyage des marques',
      'brand_extraction': 'Extraction des marques',
      'structured_analysis': 'Analyse structurée'
    };
    return names[operation] || operation;
  };

  const getPhaseName = (phase: string) => {
    const names: Record<string, string> = {
      'url_analysis': 'Analyse de l\'URL',
      'competitor_search': 'Trouver concurrents',
      'prompt_generation': 'Génération de prompts',
      'prompt_analysis': 'Analyse des prompts',
      'result_analysis': 'Analyse des résultats'
    };
    return names[phase] || phase;
  };

  const getProviderIcon = (provider: string) => {
    const icons: Record<string, string> = {
      'openai': '🤖',
      'anthropic': '🧠',
      'perplexity': '🔍',
      'google': '🔬',
      'firecrawl': '🕷️'
    };
    return icons[provider.toLowerCase()] || '⚡';
  };

  return (
    <Card className="w-full border-l-4 border-l-orange-500 bg-orange-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-lg font-semibold text-orange-800">
              Résumé des coûts API
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {safeSummary.errors > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {safeSummary.errors} erreur{safeSummary.errors > 1 ? 's' : ''}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-orange-600 hover:text-orange-700"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <CardDescription className="text-orange-700">
          Détail des appels API et coûts pour cette analyse
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-6">
          {/* Statistiques générales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-orange-600">{safeSummary.totalCalls}</div>
              <div className="text-sm text-gray-600">Appels totaux</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-green-600">{formatCost(safeSummary.totalCost)}</div>
              <div className="text-sm text-gray-600">Coût total</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">{formatDuration(safeSummary.totalDuration)}</div>
              <div className="text-sm text-gray-600">Durée totale</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">{Object.keys(safeSummary.byProvider).length}</div>
              <div className="text-sm text-gray-600">Providers utilisés</div>
            </div>
          </div>

          {/* Par phase */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Par phase d'analyse
            </h4>
            <div className="space-y-3">
              {Object.entries(safeSummary.byPhase).map(([phase, data]) => (
                <div key={phase} className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="font-semibold text-gray-800">{getPhaseName(phase)}</span>
                      <Badge variant="outline" className="text-xs">
                        {data.calls} appel{data.calls > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600 text-lg">{formatCost(data.cost)}</div>
                      <div className="text-xs text-gray-500">
                        {data.providers.map(p => getProviderIcon(p)).join(' ')}
                      </div>
                    </div>
                  </div>
                  
                  {/* Métriques détaillées */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-700">{data.calls}</div>
                      <div className="text-xs text-gray-500">Appels</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-700">{formatDuration(data.duration)}</div>
                      <div className="text-xs text-gray-500">Durée</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-700">{formatCost(data.averageCostPerCall || 0)}</div>
                      <div className="text-xs text-gray-500">Coût moyen/appel</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-700">{data.providers.length}</div>
                      <div className="text-xs text-gray-500">Providers</div>
                    </div>
                  </div>

                  {/* Métriques spéciales pour l'analyse des prompts */}
                  {phase === 'prompt_analysis' && data.promptAnalysis && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="font-medium text-blue-800">Analyse des prompts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-semibold text-blue-700">{data.promptAnalysis.totalPrompts}</div>
                          <div className="text-xs text-blue-600">Prompts analysés</div>
                        </div>
                        <div>
                          <div className="font-semibold text-blue-700">{formatCost(data.promptAnalysis.averageCostPerPrompt)}</div>
                          <div className="text-xs text-blue-600">Coût moyen/prompt</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Par provider */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Par provider
            </h4>
            <div className="space-y-2">
              {Object.entries(safeSummary.byProvider).map(([provider, data]) => (
                <div key={provider} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getProviderIcon(provider)}</span>
                    <span className="font-medium text-gray-700 capitalize">{provider}</span>
                    <Badge variant="outline" className="text-xs">
                      {data.calls} appel{data.calls > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">{formatCost(data.cost)}</div>
                    <div className="text-xs text-gray-500">
                      {formatTokens(data.tokens.input)} → {formatTokens(data.tokens.output)} tokens
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note sur les estimations */}
          <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg">
            <strong>Note :</strong> Les coûts sont estimés basés sur les tokens utilisés. 
            Les coûts réels peuvent varier selon les tarifs actuels des providers.
          </div>
        </CardContent>
      )}
    </Card>
  );
}
