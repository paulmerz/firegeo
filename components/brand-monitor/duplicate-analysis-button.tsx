'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Copy, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { BrandAnalysis } from '@/lib/db/schema';

interface DuplicateAnalysisButtonProps {
  analysis: BrandAnalysis;
  disabled?: boolean;
}

export function DuplicateAnalysisButton({ 
  analysis, 
  disabled = false 
}: DuplicateAnalysisButtonProps) {
  const router = useRouter();
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicate = async () => {
    if (isDuplicating) return;

    setIsDuplicating(true);
    
    try {
      logger.info(`Duplicating analysis ${analysis.id}`);

      // Créer une copie de l'analyse sans le scheduling
      const duplicateData = {
        url: analysis.url,
        companyName: analysis.companyName,
        industry: analysis.industry,
        analysisData: analysis.analysisData,
        competitors: analysis.competitors,
        prompts: analysis.prompts,
        creditsUsed: analysis.creditsUsed,
        // Ne pas inclure les champs de scheduling
        periodicity: 'none',
        isScheduled: false,
        nextRunAt: null,
        lastRunAt: null,
        schedulePaused: false,
      };

      const response = await fetch('/api/brand-monitor/analyses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erreur lors de la duplication');
      }

      const newAnalysis = await response.json();
      
      logger.info(`Analysis duplicated successfully: ${newAnalysis.id}`);

      // Rediriger vers la nouvelle analyse
      router.push(`/dashboard/brand-monitor?analysis=${newAnalysis.id}`);

    } catch (error) {
      logger.error('Failed to duplicate analysis:', error);
      // TODO: Afficher une notification d'erreur à l'utilisateur
      alert('Erreur lors de la duplication de l\'analyse. Veuillez réessayer.');
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDuplicate}
      disabled={disabled || isDuplicating}
      className="flex items-center gap-2"
    >
      {isDuplicating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Duplication...
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          Dupliquer et modifier
        </>
      )}
    </Button>
  );
}
