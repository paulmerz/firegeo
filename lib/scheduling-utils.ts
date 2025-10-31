import { calculateNextRun, calculateRetryDate } from './scheduling-credits-calculator';

export type Periodicity = 'none' | 'daily' | 'weekly' | 'monthly';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'insufficient_credits';

/**
 * Constantes pour la gestion des retry
 */
export const MAX_RETRIES = 3;
export const RETRY_DELAY_HOURS = [1, 2, 4, 8, 24]; // Backoff exponentiel

/**
 * Calcule la prochaine date d'exécution selon la périodicité
 */
export function getNextRunDate(periodicity: Periodicity): Date {
  return calculateNextRun(periodicity);
}

/**
 * Calcule la date de retry avec backoff exponentiel
 */
export function getRetryDate(retryCount: number): Date {
  return calculateRetryDate(retryCount);
}

/**
 * Vérifie si une analyse est éligible pour exécution
 */
export function isEligibleForExecution(
  isScheduled: boolean,
  schedulePaused: boolean,
  nextRunAt: Date | null
): boolean {
  if (!isScheduled || schedulePaused) {
    return false;
  }
  
  if (!nextRunAt) {
    return false;
  }
  
  return nextRunAt <= new Date();
}

/**
 * Formate une date pour l'affichage dans l'UI
 */
export function formatRunDate(date: Date | string | null | undefined): string {
  if (!date) return 'Jamais';
  
  // Convertir en Date si c'est une string
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Vérifier que la date est valide et que c'est bien un objet Date
  if (!dateObj || typeof dateObj.getTime !== 'function' || isNaN(dateObj.getTime())) {
    return 'Date invalide';
  }
  
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'En retard';
  } else if (diffDays === 0) {
    return 'Aujourd\'hui';
  } else if (diffDays === 1) {
    return 'Demain';
  } else if (diffDays < 7) {
    return `Dans ${diffDays} jours`;
  } else {
    return dateObj.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}

/**
 * Obtient la couleur du badge selon le statut
 */
export function getStatusBadgeColor(status: RunStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'running':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'insufficient_credits':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Obtient le texte du statut en français
 */
export function getStatusText(status: RunStatus): string {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'running':
      return 'En cours';
    case 'completed':
      return 'Terminé';
    case 'failed':
      return 'Échec';
    case 'insufficient_credits':
      return 'Crédits insuffisants';
    default:
      return 'Inconnu';
  }
}

/**
 * Obtient le texte de la périodicité en français
 */
export function getPeriodicityText(periodicity: Periodicity): string {
  switch (periodicity) {
    case 'none':
      return 'Aucune';
    case 'daily':
      return 'Quotidienne';
    case 'weekly':
      return 'Hebdomadaire';
    case 'monthly':
      return 'Mensuelle';
    default:
      return 'Inconnue';
  }
}

/**
 * Vérifie si une analyse est verrouillée (scheduling activé)
 */
export function isAnalysisLocked(analysis: { isScheduled: boolean }): boolean {
  return analysis.isScheduled;
}

/**
 * Génère un message d'avertissement pour les crédits insuffisants
 */
export function generateCreditsWarning(
  requiredCredits: number,
  availableCredits: number,
  renewalDate: Date,
  runsUntilRenewal: number
): string {
  const daysUntilRenewal = Math.ceil(
    (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  return `Cette configuration nécessitera ${requiredCredits} crédits d'ici le ${renewalDate.toLocaleDateString('fr-FR')} (${runsUntilRenewal} exécutions dans ${daysUntilRenewal} jours), mais vous n'avez que ${availableCredits} crédits disponibles.`;
}
