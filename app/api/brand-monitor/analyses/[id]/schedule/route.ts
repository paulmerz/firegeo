import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalysis } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { 
  AuthenticationError, 
  ValidationError, 
  InsufficientCreditsError,
  NotFoundError
} from '@/lib/api-errors';
import { handleApiError } from '@/lib/api-errors';
import { canExecuteAnalysis } from '@/lib/scheduling-credits-calculator';
import { getNextRunDate } from '@/lib/scheduling-utils';
import { logger } from '@/lib/logger';
import { Autumn } from 'autumn-js';

function getAutumn() {
  const secret = process.env.AUTUMN_SECRET_KEY;
  if (!secret) {
    throw new Error('Autumn secret key is required');
  }
  return new Autumn({ secretKey: secret });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Vérifier la session
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to manage scheduling');
    }

    const { periodicity, isScheduled } = await request.json();

    // Validation des paramètres
    if (!periodicity || !['none', 'daily', 'weekly', 'monthly'].includes(periodicity)) {
      throw new ValidationError('Invalid periodicity value');
    }

    if (typeof isScheduled !== 'boolean') {
      throw new ValidationError('isScheduled must be a boolean');
    }

    // Récupérer l'analyse
    const [analysis] = await db
      .select()
      .from(brandAnalysis)
      .where(eq(brandAnalysis.id, params.id))
      .limit(1);

    if (!analysis) {
      throw new NotFoundError('Analysis not found');
    }

    // Vérifier que l'utilisateur a accès à cette analyse via le workspace
    // TODO: Ajouter vérification workspace membership

    // Si on active le scheduling, vérifier les crédits
    if (isScheduled && periodicity !== 'none') {
      // Récupérer les crédits disponibles
      let availableCredits = 0;
      try {
        const usage = await getAutumn().check({
          customer_id: sessionResponse.user.id,
          feature_id: 'credits',
        });
        availableCredits = usage.data?.balance || 0;
      } catch (err) {
        logger.error('Failed to get remaining credits:', err);
        throw new Error('Failed to check credits');
      }

      // Vérifier si l'analyse peut être exécutée
      if (!canExecuteAnalysis(analysis, availableCredits)) {
        const analysisData = analysis.analysisData as { 
          prompts?: string[]; 
          webSearchUsed?: boolean 
        } | null;
        const promptsCount = analysisData?.prompts?.length || 0;
        const useWebSearch = analysisData?.webSearchUsed || false;
        const perPrompt = useWebSearch ? 2 : 1;
        const requiredCredits = promptsCount * perPrompt;

        throw new InsufficientCreditsError(
          `Vous devez avoir au moins ${requiredCredits} crédits pour activer cette analyse périodique.`,
          requiredCredits,
          availableCredits
        );
      }
    }

    // Calculer next_run_at
    const nextRunAt = isScheduled && periodicity !== 'none' 
      ? getNextRunDate(periodicity as 'daily' | 'weekly' | 'monthly')
      : null;

    // Mettre à jour l'analyse
    const [updatedAnalysis] = await db
      .update(brandAnalysis)
      .set({
        periodicity,
        isScheduled,
        nextRunAt,
        schedulePaused: false, // Réinitialiser la pause lors de l'activation
        updatedAt: new Date(),
      })
      .where(eq(brandAnalysis.id, params.id))
      .returning();

    logger.info(`Analysis ${params.id} scheduling updated`, {
      periodicity,
      isScheduled,
      nextRunAt,
      userId: sessionResponse.user.id
    });

    return NextResponse.json({
      success: true,
      analysis: {
        id: updatedAnalysis.id,
        periodicity: updatedAnalysis.periodicity,
        isScheduled: updatedAnalysis.isScheduled,
        nextRunAt: updatedAnalysis.nextRunAt,
        lastRunAt: updatedAnalysis.lastRunAt,
        schedulePaused: updatedAnalysis.schedulePaused,
      }
    });

  } catch (error) {
    logger.error('Schedule update error:', error);
    return handleApiError(error);
  }
}
