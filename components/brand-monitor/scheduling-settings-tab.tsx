'use client';

import React, { useState } from 'react';
// import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Clock, Calendar, CreditCard } from 'lucide-react';
import { DuplicateAnalysisButton } from './duplicate-analysis-button';
import { calculateSchedulingCredits } from '@/lib/scheduling-credits-calculator';
import { 
  formatRunDate, 
  getPeriodicityText, 
  generateCreditsWarning,
  type Periodicity 
} from '@/lib/scheduling-utils';
import type { BrandAnalysis } from '@/lib/db/schema';

interface SchedulingSettingsTabProps {
  analysis: BrandAnalysis;
  creditsAvailable: number;
  onUpdateSchedule: (data: { periodicity: Periodicity; isScheduled: boolean }) => Promise<void>;
}

export function SchedulingSettingsTab({ 
  analysis, 
  creditsAvailable, 
  onUpdateSchedule 
}: SchedulingSettingsTabProps) {
  const [periodicity, setPeriodicity] = useState<Periodicity>(analysis.periodicity as Periodicity);
  const [isScheduled, setIsScheduled] = useState(analysis.isScheduled);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Simuler une date de renouvellement (à remplacer par la vraie logique)
  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + 1);

  // Calculer les crédits prévisionnels
  const credits = calculateSchedulingCredits(analysis, renewalDate);
  const showWarning = credits.untilRenewal > creditsAvailable;

  const handlePeriodicityChange = (value: string) => {
    const newPeriodicity = value as Periodicity;
    setPeriodicity(newPeriodicity);
    
    // Si on désactive la périodicité, désactiver aussi le scheduling
    if (newPeriodicity === 'none') {
      setIsScheduled(false);
    }
  };

  const handleScheduledToggle = (checked: boolean) => {
    setIsScheduled(checked);
    
    // Si on active le scheduling, s'assurer qu'une périodicité est sélectionnée
    if (checked && periodicity === 'none') {
      setPeriodicity('daily');
    }
  };

  const handleSave = async () => {
    if (isScheduled && periodicity === 'none') {
      setError('Veuillez sélectionner une fréquence avant d&apos;activer le scheduling');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      await onUpdateSchedule({
        periodicity,
        isScheduled: isScheduled ?? false
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges = 
    periodicity !== (analysis.periodicity as Periodicity) || 
    isScheduled !== analysis.isScheduled;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Configuration du Scheduling
          </CardTitle>
          <CardDescription>
            Configurez l&apos;exécution automatique de cette analyse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fréquence */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fréquence d&apos;exécution</label>
            <Select 
              value={periodicity} 
              onValueChange={handlePeriodicityChange}
              disabled={(isScheduled ?? false) && (analysis.isScheduled ?? false)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                <SelectItem value="daily">Quotidienne</SelectItem>
                <SelectItem value="weekly">Hebdomadaire</SelectItem>
                <SelectItem value="monthly">Mensuelle</SelectItem>
              </SelectContent>
            </Select>
            {isScheduled && analysis.isScheduled && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Désactivez le scheduling pour modifier la fréquence
              </p>
            )}
          </div>

          {/* Toggle activation */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Activer le scheduling</label>
              <p className="text-xs text-gray-600">
                Exécuter automatiquement cette analyse selon la fréquence choisie
              </p>
            </div>
            <Switch
              checked={isScheduled ?? false}
              onCheckedChange={handleScheduledToggle}
              disabled={periodicity === 'none'}
            />
          </div>

          {/* Status actuel */}
          {analysis.isScheduled && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Status actuel</label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {getPeriodicityText(analysis.periodicity as Periodicity)}
                </Badge>
                {analysis.schedulePaused && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700">
                    En pause
                  </Badge>
                )}
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                {analysis.nextRunAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Prochaine exécution : {formatRunDate(analysis.nextRunAt)}
                  </div>
                )}
                {analysis.lastRunAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Dernière exécution : {formatRunDate(analysis.lastRunAt)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calcul des crédits */}
          {isScheduled && periodicity !== 'none' && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-medium">Consommation prévisionnelle</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Par exécution :</span>
                  <span className="ml-2 font-medium">{credits.perRun} crédits</span>
                </div>
                <div>
                  <span className="text-gray-600">Par mois :</span>
                  <span className="ml-2 font-medium">{credits.perMonth} crédits</span>
                </div>
                <div>
                  <span className="text-gray-600">Jusqu&apos;au renouvellement :</span>
                  <span className="ml-2 font-medium">{credits.untilRenewal} crédits</span>
                </div>
                <div>
                  <span className="text-gray-600">Exécutions prévues :</span>
                  <span className="ml-2 font-medium">{credits.runsUntilRenewal}</span>
                </div>
              </div>
            </div>
          )}

          {/* Warning crédits insuffisants */}
          {showWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {generateCreditsWarning(
                  credits.untilRenewal,
                  creditsAvailable,
                  renewalDate,
                  credits.runsUntilRenewal
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Message d'erreur */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Boutons d'action */}
          <div className="flex justify-between items-center">
            {/* Bouton de duplication si verrouillé */}
            {analysis.isScheduled && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-700">
                  Configuration verrouillée - Dupliquez pour modifier
                </span>
                <DuplicateAnalysisButton analysis={analysis} />
              </div>
            )}
            
            {/* Bouton de sauvegarde */}
            {hasChanges && (
              <Button 
                onClick={handleSave} 
                disabled={isUpdating || ((isScheduled ?? false) && periodicity === 'none')}
                className="min-w-[120px]"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  'Sauvegarder'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
