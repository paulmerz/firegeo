'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Building2, Globe } from 'lucide-react';
import Image from 'next/image';
import { useAnalysisTemplates } from '@/hooks/useBrandAnalyses';

interface AnalysisTemplatesSectionProps {
  onSelectTemplate: (analysisId: string) => void;
  onNewAnalysis: () => void;
}

export function AnalysisTemplatesSection({
  onSelectTemplate,
  onNewAnalysis,
}: AnalysisTemplatesSectionProps) {
  const { data: templates, isLoading } = useAnalysisTemplates();

  if (isLoading) {
    return <div className="text-center py-4">Chargement...</div>;
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-4">
          Aucune analyse récente
        </h2>
        <p className="text-gray-500 mb-6">
          Commencez par analyser votre première marque
        </p>
        <button
          onClick={onNewAnalysis}
          className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          + Nouvelle analyse
        </button>
      </div>
    );
  }

  // Limiter à 9 templates maximum (3 lignes x 3 colonnes)
  const limitedTemplates = templates.slice(0, 9);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {limitedTemplates.map((template) => (
          <Card
            key={template.id}
            className="p-4 cursor-pointer hover:border-orange-500 transition-colors"
            onClick={() => onSelectTemplate(template.id)}
          >
            <div className="flex items-start gap-3">
              {template.logo ? (
                <Image
                  src={template.logo}
                  alt={template.companyName || ''}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded object-contain"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-gray-400" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">
                  {template.companyName || template.url}
                </h3>
                <p className="text-sm text-gray-500 truncate">
                  {template.url}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>{template.competitorCount} concurrents</span>
                  <span>
                    {new Date(template.lastAnalyzedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Globe className="w-3 h-3" />
                <span>{template.locale.toUpperCase()}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
