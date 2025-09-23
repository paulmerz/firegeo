/**
 * Système de tracking centralisé pour les appels API externes
 * Permet de calculer les coûts et d'afficher un résumé détaillé
 */

import { logger } from './logger';

export interface ApiCall {
  id: string;
  provider: string;
  model: string;
  operation: 'scrape' | 'competitor_search' | 'prompt_generation' | 'analysis' | 'brand_canonicalization' | 'brand_cleaning' | 'brand_extraction' | 'structured_analysis';
  phase: 'url_analysis' | 'competitor_search' | 'prompt_generation' | 'prompt_analysis' | 'result_analysis';
  timestamp: Date;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ApiUsageSummary {
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

class ApiUsageTracker {
  private calls: ApiCall[] = [];
  private currentAnalysisId: string | null = null;

  /**
   * Détermine la phase d'un appel basé sur l'opération et les métadonnées
   */
  private getPhaseFromCall(call: ApiCall): string {
    // Phase basée sur l'opération
    switch (call.operation) {
      case 'scrape':
        return 'url_analysis';
      case 'competitor_search':
        return 'competitor_search';
      case 'prompt_generation':
        return 'prompt_generation';
      case 'analysis':
        return 'prompt_analysis';
      case 'brand_canonicalization':
      case 'brand_cleaning':
      case 'brand_extraction':
      case 'structured_analysis':
        return 'result_analysis';
      default:
        return 'result_analysis';
    }
  }

  /**
   * Démarre un nouveau tracking d'analyse
   */
  startAnalysis(analysisId: string) {
    this.currentAnalysisId = analysisId;
    logger.info(`[ApiUsageTracker] Début du tracking pour l'analyse: ${analysisId}`);
  }

  /**
   * Enregistre un appel API
   */
  trackCall(call: Omit<ApiCall, 'id' | 'timestamp' | 'phase'>): string {
    const id = `${call.provider}-${call.operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const apiCall: ApiCall = {
      ...call,
      id,
      timestamp: new Date(),
      phase: this.getPhaseFromCall(call as ApiCall)
    };
    
    this.calls.push(apiCall);
    
    logger.debug(`[ApiUsageTracker] Appel enregistré:`, {
      id,
      provider: call.provider,
      model: call.model,
      operation: call.operation,
      tokens: { input: call.inputTokens, output: call.outputTokens },
      success: call.success
    });
    
    return id;
  }

  /**
   * Met à jour un appel existant
   */
  updateCall(id: string, updates: Partial<ApiCall>) {
    const callIndex = this.calls.findIndex(call => call.id === id);
    if (callIndex !== -1) {
      this.calls[callIndex] = { ...this.calls[callIndex], ...updates };
      logger.debug(`[ApiUsageTracker] Appel mis à jour: ${id}`, updates);
    }
  }

  /**
   * Calcule le résumé des coûts
   */
  getSummary(): ApiUsageSummary {
    const summary: ApiUsageSummary = {
      totalCalls: this.calls.length,
      totalCost: 0,
      totalDuration: 0,
      byProvider: {},
      byOperation: {},
      byPhase: {},
      errors: 0
    };

    this.calls.forEach(call => {
      // Coût total
      if (call.cost) {
        summary.totalCost += call.cost;
      }

      // Durée totale
      if (call.duration) {
        summary.totalDuration += call.duration;
      }

      // Erreurs
      if (!call.success) {
        summary.errors++;
      }

      // Par provider
      if (!summary.byProvider[call.provider]) {
        summary.byProvider[call.provider] = {
          calls: 0,
          cost: 0,
          tokens: { input: 0, output: 0 }
        };
      }
      summary.byProvider[call.provider].calls++;
      if (call.cost) summary.byProvider[call.provider].cost += call.cost;
      if (call.inputTokens) summary.byProvider[call.provider].tokens.input += call.inputTokens;
      if (call.outputTokens) summary.byProvider[call.provider].tokens.output += call.outputTokens;

      // Par opération
      if (!summary.byOperation[call.operation]) {
        summary.byOperation[call.operation] = {
          calls: 0,
          cost: 0,
          providers: []
        };
      }
      summary.byOperation[call.operation].calls++;
      if (call.cost) summary.byOperation[call.operation].cost += call.cost;
      if (!summary.byOperation[call.operation].providers.includes(call.provider)) {
        summary.byOperation[call.operation].providers.push(call.provider);
      }

      // Par phase
      const phase = this.getPhaseFromCall(call);
      if (!summary.byPhase[phase]) {
        summary.byPhase[phase] = {
          calls: 0,
          cost: 0,
          duration: 0,
          providers: []
        };
      }
      summary.byPhase[phase].calls++;
      if (call.cost) summary.byPhase[phase].cost += call.cost;
      if (call.duration) summary.byPhase[phase].duration += call.duration;
      if (!summary.byPhase[phase].providers.includes(call.provider)) {
        summary.byPhase[phase].providers.push(call.provider);
      }
    });

    // Calculer les moyennes et métriques spéciales
    Object.keys(summary.byPhase).forEach(phase => {
      const phaseData = summary.byPhase[phase];
      phaseData.averageCostPerCall = phaseData.calls > 0 ? phaseData.cost / phaseData.calls : 0;

      // Métriques spéciales pour l'analyse des prompts
      if (phase === 'prompt_analysis') {
        // Compter le nombre de prompts uniques analysés
        const uniquePrompts = new Set();
        this.calls
          .filter(call => this.getPhaseFromCall(call) === 'prompt_analysis')
          .forEach(call => {
            // Essayer différentes clés pour trouver le prompt
            const prompt = call.metadata?.prompt || 
                          call.metadata?.promptText || 
                          call.metadata?.promptText?.substring(0, 100) + '...';
            if (prompt) {
              uniquePrompts.add(prompt);
            }
          });
        
        // Si on n'a pas trouvé de prompts uniques, estimer basé sur le nombre d'appels et providers
        let totalPrompts = uniquePrompts.size;
        if (totalPrompts === 0) {
          // Estimation: nombre d'appels divisé par le nombre de providers (car chaque prompt est analysé par chaque provider)
          const providers = new Set();
          this.calls
            .filter(call => this.getPhaseFromCall(call) === 'prompt_analysis')
            .forEach(call => providers.add(call.provider));
          
          totalPrompts = Math.max(1, Math.floor(phaseData.calls / Math.max(1, providers.size)));
        }
        
        phaseData.promptAnalysis = {
          totalPrompts,
          averageCostPerPrompt: phaseData.cost / totalPrompts
        };
      }
    });

    // Initialiser les phases manquantes pour un affichage cohérent
    const phaseKeys = ['url_analysis','competitor_search','prompt_generation','prompt_analysis','result_analysis'] as const;
    phaseKeys.forEach((key) => {
      if (!summary.byPhase[key]) {
        summary.byPhase[key] = {
          calls: 0,
          cost: 0,
          duration: 0,
          providers: [],
          averageCostPerCall: 0
        };
      }
    });

    return summary;
  }

  /**
   * Affiche le résumé détaillé dans les logs
   */
  logSummary() {
    const summary = this.getSummary();
    
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 RÉSUMÉ DES COÛTS API - ANALYSE TERMINÉE');
    logger.info('='.repeat(80));
    
    logger.info(`\n🔢 STATISTIQUES GÉNÉRALES:`);
    logger.info(`   • Total d'appels: ${summary.totalCalls}`);
    logger.info(`   • Coût total: $${summary.totalCost.toFixed(4)}`);
    logger.info(`   • Durée totale: ${(summary.totalDuration / 1000).toFixed(2)}s`);
    logger.info(`   • Erreurs: ${summary.errors}`);
    
    logger.info(`\n🏢 PAR OPÉRATION:`);
    Object.entries(summary.byOperation).forEach(([operation, data]) => {
      const operationName = {
        'scrape': 'Scraping initial',
        'competitor_search': 'Recherche de concurrents',
        'prompt_generation': 'Génération de prompts',
        'analysis': 'Analyse des résultats'
      }[operation] || operation;
      
      logger.info(`   📋 ${operationName}:`);
      logger.info(`      • Appels: ${data.calls}`);
      logger.info(`      • Coût: $${data.cost.toFixed(4)}`);
      logger.info(`      • Providers: ${data.providers.join(', ')}`);
    });
    
    logger.info(`\n🤖 PAR PROVIDER:`);
    Object.entries(summary.byProvider).forEach(([provider, data]) => {
      logger.info(`   🔧 ${provider.toUpperCase()}:`);
      logger.info(`      • Appels: ${data.calls}`);
      logger.info(`      • Coût: $${data.cost.toFixed(4)}`);
      logger.info(`      • Tokens: ${data.tokens.input} entrée, ${data.tokens.output} sortie`);
    });
    
    logger.debug(`\n📋 DÉTAIL DES APPELS:`);
    this.calls.forEach((call, index) => {
      const status = call.success ? '✅' : '❌';
      const tokens = call.inputTokens && call.outputTokens 
        ? ` (${call.inputTokens}→${call.outputTokens} tokens)`
        : '';
      const cost = call.cost ? ` - $${call.cost.toFixed(4)}` : '';
      const duration = call.duration ? ` - ${(call.duration / 1000).toFixed(2)}s` : '';
      
      logger.debug(`   ${index + 1}. ${status} ${call.provider}/${call.model} - ${call.operation}${tokens}${cost}${duration}`);
      if (call.error) {
        logger.error(`      ❌ Erreur: ${call.error}`);
      }
    });
    
    logger.info('='.repeat(80) + '\n');
  }

  /**
   * Retourne les appels pour une opération spécifique
   */
  getCallsForOperation(operation: ApiCall['operation']): ApiCall[] {
    return this.calls.filter(call => call.operation === operation);
  }

  /**
   * Retourne tous les appels
   */
  getAllCalls(): ApiCall[] {
    return [...this.calls];
  }

  /**
   * Reset le tracker
   */
  reset() {
    this.calls = [];
    this.currentAnalysisId = null;
  }
}

// Instance singleton
export const apiUsageTracker = new ApiUsageTracker();

/**
 * Helper pour calculer les coûts estimés basés sur les tokens
 */
export function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  // Prix réels par 1M tokens (input/output) - mis à jour avec les vrais prix
  const pricing: Record<string, Record<string, { input: number; output: number }>> = {
    'openai': {
      'gpt-4o': { input: 2.50, output: 10.0 }, // $2.50 input, $10.00 output
      'gpt-4o-mini': { input: 0.15, output: 0.6 }, // $0.15 input, $0.60 output
      'gpt-4-turbo': { input: 10.0, output: 30.0 }
    },
    'anthropic': {
      'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 }, // $3 input, $15 output
      'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
      'claude-3-5-sonnet-latest': { input: 3.0, output: 15.0 } // $3 input, $15 output
    },
    'perplexity': {
      'sonar': { input: 1.0, output: 1.0 }, // $1 input, $1 output
      'sonar-pro': { input: 3.0, output: 15.0 }, // $3 input, $15 output
      'sonar-reasoning': { input: 3.0, output: 15.0 } // Même prix que Sonar Pro
    },
    'google': {
      'gemini-1.5-flash': { input: 0.075, output: 0.3 }
    }
  };

  const providerPricing = pricing[provider.toLowerCase()];
  if (!providerPricing) return 0;

  const modelPricing = providerPricing[model.toLowerCase()];
  if (!modelPricing) {
    console.warn(`[estimateCost] Model pricing not found for ${provider}/${model}`);
    return 0;
  }

  const inputCost = (inputTokens / 1000000) * modelPricing.input;
  const outputCost = (outputTokens / 1000000) * modelPricing.output;
  
  return inputCost + outputCost;
}

/**
 * Helper pour extraire les tokens des réponses AI SDK
 */
export function extractTokensFromUsage(usage: any): { inputTokens: number; outputTokens: number } {
  if (!usage) return { inputTokens: 0, outputTokens: 0 };
  
  return {
    inputTokens: usage.promptTokens || usage.inputTokens || 0,
    outputTokens: usage.completionTokens || usage.outputTokens || 0
  };
}
