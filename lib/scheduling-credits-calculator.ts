import type { BrandAnalysis } from '@/lib/db/schema';

export interface SchedulingCredits {
  perRun: number;
  perMonth: number;
  untilRenewal: number;
  runsUntilRenewal: number;
}

/**
 * Calcule la consommation de crédits prévisionnelle pour une analyse périodique
 */
export function calculateSchedulingCredits(
  analysis: BrandAnalysis,
  renewalDate: Date
): SchedulingCredits {
  const analysisData = analysis.analysisData as { 
    prompts?: string[]; 
    webSearchUsed?: boolean 
  } | null;
  
  const promptsCount = analysisData?.prompts?.length || 0;
  const useWebSearch = analysisData?.webSearchUsed || false;
  
  // Coût par prompt selon la configuration
  const perPrompt = useWebSearch ? 2 : 1;
  const perRun = promptsCount * perPrompt;
  
  // Nombre de runs par mois selon la périodicité
  const runsPerMonth = {
    daily: 30,
    weekly: 4,
    monthly: 1,
    none: 0
  }[analysis.periodicity || 'none'] || 0;
  
  // Calculer les jours jusqu'au renouvellement
  const daysUntilRenewal = Math.ceil(
    (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  // Nombre de jours par période
  const periodDays = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    none: 0
  }[analysis.periodicity || 'none'] || 0;
  
  // Calculer le nombre de runs jusqu'au renouvellement
  const runsUntilRenewal = periodDays > 0 
    ? Math.ceil(daysUntilRenewal / periodDays)
    : 0;
  
  return {
    perRun,
    perMonth: perRun * runsPerMonth,
    untilRenewal: perRun * runsUntilRenewal,
    runsUntilRenewal
  };
}

/**
 * Calcule la prochaine date d'exécution selon la périodicité
 */
export function calculateNextRun(periodicity: string): Date {
  const now = new Date();
  
  switch(periodicity) {
    case 'daily':
      return addDays(now, 1);
    case 'weekly':
      return addDays(now, 7);
    case 'monthly':
      return addMonths(now, 1);
    default:
      return now;
  }
}

/**
 * Calcule la date de retry avec backoff exponentiel
 */
export function calculateRetryDate(retryCount: number): Date {
  const now = new Date();
  // Backoff exponentiel : 1h, 2h, 4h, 8h, 24h max
  const hours = Math.min(Math.pow(2, retryCount), 24);
  return addHours(now, hours);
}

/**
 * Vérifie si une analyse peut être exécutée (crédits suffisants)
 */
export function canExecuteAnalysis(
  analysis: BrandAnalysis,
  availableCredits: number
): boolean {
  const analysisData = analysis.analysisData as { 
    prompts?: string[]; 
    webSearchUsed?: boolean 
  } | null;
  
  const promptsCount = analysisData?.prompts?.length || 0;
  const useWebSearch = analysisData?.webSearchUsed || false;
  const perPrompt = useWebSearch ? 2 : 1;
  const requiredCredits = promptsCount * perPrompt;
  
  return availableCredits >= requiredCredits;
}

// Helper functions
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}
