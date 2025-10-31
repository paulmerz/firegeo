import { db } from '@/lib/db';
import { brandAnalysis, brandAnalysisRuns, brandAnalysisSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { performAnalysis } from '@/lib/analyze-common';
import { extractAnalysisSources } from '@/lib/brand-monitor-sources';
import { canExecuteAnalysis } from '@/lib/scheduling-credits-calculator';
import { getNextRunDate, getRetryDate, MAX_RETRIES } from '@/lib/scheduling-utils';
import { logger } from '@/lib/logger';
import { Autumn } from 'autumn-js';
import type { BrandAnalysis } from '@/lib/db/schema';
import { getCompanyById } from '@/lib/db/companies-service';

function getAutumn() {
  const secret = process.env.AUTUMN_SECRET_KEY;
  if (!secret) {
    throw new Error('Autumn secret key is required');
  }
  return new Autumn({ secretKey: secret });
}

/**
 * Exécute une analyse schedulée
 */
export async function executeScheduledAnalysis(analysis: BrandAnalysis): Promise<void> {
  logger.info(`Starting scheduled analysis execution for ${analysis.id}`, {
    analysisId: analysis.id,
    periodicity: analysis.periodicity,
    userId: analysis.userId
  });

  // Créer le record de run avec status 'pending'
  const [run] = await db
    .insert(brandAnalysisRuns)
    .values({
      brandAnalysisId: analysis.id,
      status: 'pending',
      startedAt: new Date(),
    })
    .returning();

  try {
    // Vérifier les crédits disponibles
    const requiredCredits = calculateRequiredCredits(analysis);
    const { balance } = await checkCredits(analysis.userId);
    
    if (!canExecuteAnalysis(analysis, balance)) {
      await updateRunStatus(run.id, 'insufficient_credits', 'Not enough credits');
      
      // Logique de retry
      if ((run.retryCount ?? 0) < MAX_RETRIES) {
        await scheduleRetry(analysis.id, run.id);
      } else {
        await pauseSchedule(analysis.id);
      }
      return;
    }

    // Mettre à jour le statut à 'running'
    await updateRunStatus(run.id, 'running');

    // Récupérer les données de l'entreprise
    const company = await getCompanyById(analysis.companyId);
    if (!company) {
      throw new Error(`Company not found for ID: ${analysis.companyId}`);
    }

    // Déterminer si la recherche web est utilisée
    // Pour les analyses schedulées, on utilise la recherche web par défaut
    const useWebSearch = true;

    const analysisResult = await performAnalysis({
      company: {
        id: company.id,
        name: company.name,
        url: company.url
      },
      customPrompts: analysis.prompts as string[] || [],
      userSelectedCompetitors: (analysis.competitors as Record<string, unknown>[] || []).map(comp => ({
        name: comp.name as string || 'Unknown'
      })),
      useWebSearch,
      locale: 'en', // TODO: Récupérer depuis user settings
      sendEvent: async () => {}, // Pas de SSE pour les runs schedulés
      mockMode: 'none'
    });

    // Débiter les crédits
    await debitCredits(analysis.userId, requiredCredits);

    // Sauvegarder les résultats
    await db
      .update(brandAnalysisRuns)
      .set({
        status: 'completed',
        completedAt: new Date(),
        analysisData: analysisResult,
        creditsUsed: requiredCredits,
        visibilityScore: analysisResult.scores?.overallScore,
        competitorsCount: analysisResult.competitors?.length || 0,
        promptsCount: analysisResult.prompts?.length || 0,
      })
      .where(eq(brandAnalysisRuns.id, run.id));

    // Sauvegarder les sources
    const sources = extractAnalysisSources(analysisResult);
    if (sources.length > 0) {
      await db
        .insert(brandAnalysisSources)
        .values(
          sources.map(source => ({
            ...source,
            runId: run.id,
            analysisId: null, // Null car on utilise runId
            createdAt: source.createdAt ? new Date(source.createdAt) : new Date(),
          }))
        );
    }

    // Insérer les événements métriques pour le suivi analytique
    await insertMetricEvents(run.id, analysis.id, analysisResult as unknown as Record<string, unknown>);

    // Calculer la prochaine exécution
    const nextRun = getNextRunDate(analysis.periodicity as 'daily' | 'weekly' | 'monthly');
    await db
      .update(brandAnalysis)
      .set({
        lastRunAt: new Date(),
        nextRunAt: nextRun,
      })
      .where(eq(brandAnalysis.id, analysis.id));

    logger.info(`Scheduled analysis completed successfully for ${analysis.id}`, {
      analysisId: analysis.id,
      runId: run.id,
      creditsUsed: requiredCredits,
      nextRunAt: nextRun
    });

  } catch (error) {
    logger.error(`Scheduled analysis failed for ${analysis.id}:`, error);
    
    // Mettre à jour le statut à 'failed'
    await updateRunStatus(run.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
    
    // Logique de retry
    if ((run.retryCount ?? 0) < MAX_RETRIES) {
      await scheduleRetry(analysis.id, run.id);
    } else {
      await pauseSchedule(analysis.id);
    }
  }
}

/**
 * Calcule les crédits requis pour une analyse
 */
function calculateRequiredCredits(analysis: BrandAnalysis): number {
  const promptsCount = (analysis.prompts as string[] || []).length;
  // Pour les analyses schedulées, on utilise la recherche web par défaut
  const useWebSearch = true;
  const perPrompt = useWebSearch ? 2 : 1;
  
  return promptsCount * perPrompt;
}

/**
 * Vérifie les crédits disponibles d'un utilisateur
 */
async function checkCredits(userId: string): Promise<{ balance: number }> {
  try {
    const usage = await getAutumn().check({
      customer_id: userId,
      feature_id: 'credits',
    });
    return { balance: usage.data?.balance || 0 };
  } catch (error) {
    logger.error('Failed to check credits:', error);
    throw new Error('Failed to check credits');
  }
}

/**
 * Débite les crédits d'un utilisateur
 */
async function debitCredits(userId: string, amount: number): Promise<void> {
  try {
    await getAutumn().track({
      customer_id: userId,
      feature_id: 'credits',
      value: amount,
    });
    logger.info(`Debited ${amount} credits for user ${userId}`);
  } catch (error) {
    logger.error('Failed to debit credits:', error);
    throw new Error('Failed to debit credits');
  }
}

/**
 * Met à jour le statut d'un run
 */
async function updateRunStatus(
  runId: string, 
  status: 'pending' | 'running' | 'completed' | 'failed' | 'insufficient_credits',
  errorMessage?: string
): Promise<void> {
  await db
    .update(brandAnalysisRuns)
    .set({
      status,
      errorMessage,
      completedAt: status === 'completed' || status === 'failed' || status === 'insufficient_credits' 
        ? new Date() 
        : undefined,
    })
    .where(eq(brandAnalysisRuns.id, runId));
}

/**
 * Programme un retry pour une analyse
 */
async function scheduleRetry(analysisId: string, runId: string): Promise<void> {
  const retryDate = getRetryDate(1); // TODO: Utiliser le retryCount du run
  
  await db
    .update(brandAnalysis)
    .set({
      nextRunAt: retryDate,
    })
    .where(eq(brandAnalysis.id, analysisId));

  await db
    .update(brandAnalysisRuns)
    .set({
      retryCount: 1, // TODO: Incrémenter le retryCount existant
    })
    .where(eq(brandAnalysisRuns.id, runId));

  logger.info(`Scheduled retry for analysis ${analysisId} at ${retryDate}`);
}

/**
 * Met en pause le scheduling d'une analyse
 */
async function pauseSchedule(analysisId: string): Promise<void> {
  await db
    .update(brandAnalysis)
    .set({
      schedulePaused: true,
      nextRunAt: null,
    })
    .where(eq(brandAnalysis.id, analysisId));

  logger.warn(`Paused scheduling for analysis ${analysisId} after max retries`);
}

/**
 * Insère les événements métriques dans la table narrow
 */
export async function insertMetricEvents(
  runId: string, 
  analysisId: string, 
  analysisResult: Record<string, unknown>
): Promise<void> {
  try {
    const metricEvents: Array<{
      run_id: string;
      brand_analysis_id: string;
      competitor_name: string;
      provider: string;
      metric_type: string;
      metric_value: number;
      recorded_at: Date;
    }> = [];

    // Extraire les métriques depuis providerRankings
    if (analysisResult.providerRankings && Array.isArray(analysisResult.providerRankings)) {
      // Collecter toutes les marques (concurrents + marque cible)
      const allBrands = new Set<string>();
      const targetBrand = (analysisResult.company as Record<string, unknown>)?.brand as string | undefined;
      
      analysisResult.providerRankings.forEach((providerRanking: Record<string, unknown>) => {
        if (providerRanking.competitors && Array.isArray(providerRanking.competitors)) {
          providerRanking.competitors.forEach((competitor: Record<string, unknown>) => {
            if (typeof competitor.name === 'string') {
              allBrands.add(competitor.name);
            }
          });
        }
      });
      
      // Ajouter la marque cible si elle n'est pas déjà dans les concurrents
      if (targetBrand) {
        allBrands.add(targetBrand);
      }

      analysisResult.providerRankings.forEach((providerRanking: Record<string, unknown>) => {
        const provider = providerRanking.provider;
        
        if (providerRanking.competitors && Array.isArray(providerRanking.competitors)) {
          providerRanking.competitors.forEach((competitor: Record<string, unknown>) => {
            const competitorName = competitor.name;
            // const isOwn = competitor.isOwn || false; // Variable non utilisée
            
            // 1. MÉTRIQUES PAR PROVIDER POUR CHAQUE MARQUE (5 métriques)
            
            // mentions (valeur réelle, pas 1)
            if (competitor.mentions !== undefined && typeof competitor.mentions === 'number') {
              metricEvents.push({
                run_id: runId,
                brand_analysis_id: analysisId,
                competitor_name: competitorName as string,
                provider: provider as string,
                metric_type: 'mentions',
                metric_value: competitor.mentions,
                recorded_at: new Date()
              });
            }
            
            // visibility_score par provider (score dans l'onglet classement des marques)
            if (competitor.visibilityScore !== undefined && typeof competitor.visibilityScore === 'number') {
              metricEvents.push({
                run_id: runId,
                brand_analysis_id: analysisId,
                competitor_name: competitorName as string,
                provider: provider as string,
                metric_type: 'visibility_score',
                metric_value: competitor.visibilityScore,
                recorded_at: new Date()
              });
            }
            
            // position par provider (position dans le tableau "Classements des Marques")
            if (competitor.averagePosition !== undefined && typeof competitor.averagePosition === 'number') {
              metricEvents.push({
                run_id: runId,
                brand_analysis_id: analysisId,
                competitor_name: competitorName as string,
                provider: provider as string,
                metric_type: 'position',
                metric_value: competitor.averagePosition,
                recorded_at: new Date()
              });
            }
            
            // share_of_voices
            if (competitor.shareOfVoice !== undefined && typeof competitor.shareOfVoice === 'number') {
              metricEvents.push({
                run_id: runId,
                brand_analysis_id: analysisId,
                competitor_name: competitorName as string,
                provider: provider as string,
                metric_type: 'share_of_voices',
                metric_value: competitor.shareOfVoice,
                recorded_at: new Date()
              });
            }
            
            // sentiment_score
            if (competitor.sentimentScore !== undefined && typeof competitor.sentimentScore === 'number') {
              metricEvents.push({
                run_id: runId,
                brand_analysis_id: analysisId,
                competitor_name: competitorName as string,
                provider: provider as string,
                metric_type: 'sentiment_score',
                metric_value: competitor.sentimentScore,
                recorded_at: new Date()
              });
            }
          });
        }
      });
      
      // 2. MÉTRIQUES POUR TOUTES LES MARQUES (2 métriques)
      allBrands.forEach(brandName => {
        // visibility_average (moyenne de tous les providers - score dans "Score de visibilité")
        const visibilityScores = (analysisResult.providerRankings as Record<string, unknown>[])
          ?.map((pr: Record<string, unknown>) => {
            const competitors = pr.competitors as Record<string, unknown>[] | undefined;
            const competitor = competitors?.find((c: Record<string, unknown>) => c.name === brandName);
            return competitor?.visibilityScore;
          })
          .filter((score: unknown) => typeof score === 'number');
        
        if (visibilityScores && visibilityScores.length > 0) {
          const avgVisibilityScore = visibilityScores.reduce((sum: number, score: number) => sum + score, 0) / visibilityScores.length;
          metricEvents.push({
            run_id: runId,
            brand_analysis_id: analysisId,
            competitor_name: brandName,
            provider: 'all',
            metric_type: 'visibility_average',
            metric_value: avgVisibilityScore,
            recorded_at: new Date()
          });
        }
        
        // average_position (moyenne de tous les providers - classement global)
        const positions = (analysisResult.providerRankings as Record<string, unknown>[])
          ?.map((pr: Record<string, unknown>) => {
            const competitors = pr.competitors as Record<string, unknown>[] | undefined;
            const competitor = competitors?.find((c: Record<string, unknown>) => c.name === brandName);
            return competitor?.averagePosition;
          })
          .filter((pos: unknown) => typeof pos === 'number');
        
        if (positions && positions.length > 0) {
          const avgPosition = positions.reduce((sum: number, pos: number) => sum + pos, 0) / positions.length;
          metricEvents.push({
            run_id: runId,
            brand_analysis_id: analysisId,
            competitor_name: brandName,
            provider: 'all',
            metric_type: 'average_position',
            metric_value: avgPosition,
            recorded_at: new Date()
          });
        }
      });
      
      // 3. MÉTRIQUES UNIQUEMENT POUR LA MARQUE CIBLE (1 métrique)
      if (targetBrand) {
        // average_score (moyenne de tous les scores de la marque cible)
        const allScores = (analysisResult.providerRankings as Record<string, unknown>[])
          ?.flatMap((pr: Record<string, unknown>) => {
            const competitors = pr.competitors as Record<string, unknown>[] | undefined;
            return competitors?.filter((c: Record<string, unknown>) => c.name === targetBrand) || [];
          })
          ?.map((c: Record<string, unknown>) => c.visibilityScore)
          .filter((score: unknown) => typeof score === 'number');
        
        if (allScores && allScores.length > 0) {
          const avgScore = allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length;
          metricEvents.push({
            run_id: runId,
            brand_analysis_id: analysisId,
            competitor_name: targetBrand,
            provider: 'target',
            metric_type: 'average_score',
            metric_value: avgScore,
            recorded_at: new Date()
          });
        }
        
      }
    }

    // Insérer tous les événements en une seule requête
    if (metricEvents.length > 0) {
      await db.execute(sql`
        INSERT INTO brand_analysis_metric_events 
        (run_id, brand_analysis_id, competitor_name, provider, metric_type, metric_value, recorded_at)
        VALUES ${sql.join(
          metricEvents.map(event => 
            sql`(${event.run_id}, ${event.brand_analysis_id}, ${event.competitor_name}, ${event.provider}, ${event.metric_type}::metric_type, ${event.metric_value}, ${event.recorded_at})`
          ), 
          sql`, `
        )}
      `);
      
      logger.info(`Inserted ${metricEvents.length} metric events for run ${runId}`, {
        runId,
        analysisId,
        eventsCount: metricEvents.length
      });
    }
  } catch (error) {
    logger.error(`Failed to insert metric events for run ${runId}:`, error);
    // Ne pas faire échouer l'analyse si l'insertion des métriques échoue
  }
}
