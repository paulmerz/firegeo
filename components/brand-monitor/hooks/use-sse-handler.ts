import { useRef, useEffect } from 'react';
import {
  BrandMonitorState,
  BrandMonitorAction,
  Analysis,
  PromptCompletionStatus
} from '@/lib/brand-monitor-reducer';
import { SSEParser } from '@/lib/sse-parser';
import {
  ProgressData,
  CompetitorFoundData,
  PromptGeneratedData,
  AnalysisProgressData,
  PartialResultData,
  BrandExtractionProgressData,
  ScoringProgressData,
  SSEEvent,
  AnalysisStage
} from '@/lib/types';
import type { ApiUsageSummaryData } from '../api-usage-summary';

interface UseSSEHandlerProps {
  state: BrandMonitorState;
  dispatch: React.Dispatch<BrandMonitorAction>;
  onCreditsUpdate?: () => void;
  onAnalysisComplete?: (analysis: Analysis) => void;
  onApiUsageSummary?: (summary: ApiUsageSummaryData) => void;
}

import { logger } from '@/lib/logger';
import { useTranslations } from 'next-intl';

type SSEMessage<T = unknown> = Omit<SSEEvent<T>, 'stage'> & { stage?: AnalysisStage };

interface AnalysisCompletePayload {
  analysis: Analysis;
  apiUsageSummary?: ApiUsageSummaryData;
}

export function useSSEHandler({ state, dispatch, onCreditsUpdate, onAnalysisComplete, onApiUsageSummary }: UseSSEHandlerProps) {
  const tErrors = useTranslations('brandMonitor.errors');
  // Use ref to track current prompt status to avoid closure issues in SSE handler
  const promptCompletionStatusRef = useRef<PromptCompletionStatus>(state.promptCompletionStatus);
  const analyzingPromptsRef = useRef<string[]>(state.analyzingPrompts);
  
  useEffect(() => {
    promptCompletionStatusRef.current = state.promptCompletionStatus;
  }, [state.promptCompletionStatus]);
  
  useEffect(() => {
    analyzingPromptsRef.current = state.analyzingPrompts;
  }, [state.analyzingPrompts]);

  // Fonction pour calculer la progression globale
  const calculateGlobalProgress = (
    stage: string,
    stageProgress: number,
    promptCompletionStatus: PromptCompletionStatus | undefined,
    analyzingPrompts: string[]
  ) => {
    switch (stage) {
      case 'analyzing-prompts':
        // Calculer la progression basée sur les prompts terminés (0-70%)
        if (!promptCompletionStatus || analyzingPrompts.length === 0) {
          return 0;
        }
        
        const enabledProviders = ['OpenAI', 'Anthropic', 'Google']; // Peut être récupéré dynamiquement
        const totalTasks = analyzingPrompts.length * enabledProviders.length;
        let completedTasks = 0;
        
        analyzingPrompts.forEach(prompt => {
          const normalizedPrompt = prompt.trim();
          enabledProviders.forEach(provider => {
            const status = promptCompletionStatus[normalizedPrompt]?.[provider];
            if (status === 'completed' || status === 'failed' || status === 'skipped') {
              completedTasks++;
            }
          });
        });
        
        const promptProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 70 : 0;
        return Math.min(Math.round(promptProgress), 70);
        
      case 'extracting-brands':
        // Utiliser directement la progression envoyée (70-90%)
        return stageProgress;
        
      case 'calculating-scores':
        // Utiliser directement la progression envoyée (90-100%)
        return stageProgress;
        
      default:
        return stageProgress;
    }
  };

  const handleSSEEvent = (eventData: SSEMessage<unknown>) => {
    
    try {
      switch (eventData.type) {
      case 'credits':
        // Handle credit update event
        if (onCreditsUpdate) {
          onCreditsUpdate();
        }
        break;
        
      case 'start':
        // Déjà géré par la logique d'initialisation du reducer
        break;

      case 'progress': {
        const progressData = eventData.data as ProgressData;
        const globalProgress = calculateGlobalProgress(
          progressData.stage,
          progressData.progress,
          promptCompletionStatusRef.current,
          analyzingPromptsRef.current
        );
        
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          payload: {
            stage: progressData.stage,
            progress: globalProgress,
            message: progressData.message
          }
        });
        break;
      }

      case 'competitor-found':
        const competitorData = eventData.data as CompetitorFoundData;
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          payload: {
            competitors: [...(state.analysisProgress.competitors || []), competitorData.competitor]
          }
        });
        break;

      case 'prompt-generated':
        const promptData = eventData.data as PromptGeneratedData;
        const existingPrompts = analyzingPromptsRef.current || [];
        const analysisPrompts = state.analysisProgress.prompts || [];
        
        // If prompts are already set (from custom prompts), don't process prompt-generated events
        // This prevents overwriting the initial prompts set in handleAnalyze
        if (existingPrompts.length > 0) {
          
          // Still update analysis progress prompts to keep them in sync
          if (!analysisPrompts.includes(promptData.prompt)) {
            dispatch({
              type: 'UPDATE_ANALYSIS_PROGRESS',
              payload: {
                prompts: [...analysisPrompts, promptData.prompt]
              }
            });
          }
          break;
        }
        
        // Only process if this is truly a new prompt being generated
        if (!existingPrompts.includes(promptData.prompt)) {
          dispatch({
            type: 'UPDATE_ANALYSIS_PROGRESS',
            payload: {
              prompts: [...analysisPrompts, promptData.prompt]
            }
          });
          dispatch({
            type: 'SET_ANALYZING_PROMPTS',
            payload: [...existingPrompts, promptData.prompt]
          });
          
          // Initialize prompt completion status
          const newStatus = { ...promptCompletionStatusRef.current };
          const normalizedPrompt = promptData.prompt.trim();
          newStatus[normalizedPrompt] = {};
          state.availableProviders.forEach(provider => {
            newStatus[normalizedPrompt][provider] = 'pending';
          });
          dispatch({
            type: 'SET_PROMPT_COMPLETION_STATUS',
            payload: newStatus
          });
        }
        break;

      case 'analysis-start':
        const analysisStartData = eventData.data as AnalysisProgressData;
        const normalizedStartPrompt = analysisStartData.prompt.trim();
        
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          payload: {
            currentProvider: analysisStartData.provider,
            currentPrompt: normalizedStartPrompt,
          }
        });
        
        dispatch({
          type: 'UPDATE_PROMPT_STATUS',
          payload: {
            prompt: normalizedStartPrompt,
            provider: analysisStartData.provider,
            status: 'running'
          }
        });
        
        // Update tile status to running
        const tileIndex = state.analysisTiles.findIndex(tile => tile.prompt === analysisStartData.prompt);
        if (tileIndex !== -1) {
          const updatedTile = { ...state.analysisTiles[tileIndex] };
          const providerIndex = updatedTile.providers.findIndex(p => p.name === analysisStartData.provider);
          if (providerIndex !== -1) {
            updatedTile.providers[providerIndex].status = 'running';
            dispatch({
              type: 'UPDATE_ANALYSIS_TILE',
              payload: { index: tileIndex, tile: updatedTile }
            });
          }
        }
        break;

      case 'partial-result':
        const partialData = eventData.data as PartialResultData;
        const normalizedPartialPrompt = partialData.prompt.trim();
        
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          payload: {
            partialResults: [...(state.analysisProgress.partialResults || []), partialData],
          }
        });
        
        dispatch({
          type: 'UPDATE_PROMPT_STATUS',
          payload: {
            prompt: normalizedPartialPrompt,
            provider: partialData.provider,
            status: 'completed'
          }
        });
        
        // Update tile with result
        const partialTileIndex = state.analysisTiles.findIndex(tile => tile.prompt === partialData.prompt);
        if (partialTileIndex !== -1) {
          const updatedTile = { ...state.analysisTiles[partialTileIndex] };
          const providerIndex = updatedTile.providers.findIndex(p => p.name === partialData.provider);
          if (providerIndex !== -1) {
            updatedTile.providers[providerIndex] = {
              ...updatedTile.providers[providerIndex],
              status: 'completed',
              result: {
                brandMentioned: partialData.response.brandMentioned || false,
                brandPosition: partialData.response.brandPosition,
                sentiment: partialData.response.sentiment || 'neutral'
              }
            };
            dispatch({
              type: 'UPDATE_ANALYSIS_TILE',
              payload: { index: partialTileIndex, tile: updatedTile }
            });
          }
        }
        break;

      case 'analysis-complete': {
        const analysisCompleteData = eventData.data as AnalysisProgressData;
        
        if (!analysisCompleteData.prompt || !analysisCompleteData.provider) {
          logger.error('[ERROR] Missing prompt or provider in analysis-complete event');
          break;
        }
        
        const normalizedCompletePrompt = analysisCompleteData.prompt.trim();
        
        if (analysisCompleteData.status === 'failed') {
          dispatch({
            type: 'UPDATE_PROMPT_STATUS',
            payload: {
              prompt: normalizedCompletePrompt,
              provider: analysisCompleteData.provider,
              status: 'failed'
            }
          });
          
          // Update tile status to failed
          const failedTileIndex = state.analysisTiles.findIndex(tile => tile.prompt === analysisCompleteData.prompt);
          if (failedTileIndex !== -1) {
            const updatedTile = { ...state.analysisTiles[failedTileIndex] };
            const providerIndex = updatedTile.providers.findIndex(p => p.name === analysisCompleteData.provider);
            if (providerIndex !== -1) {
              updatedTile.providers[providerIndex].status = 'failed';
              dispatch({
                type: 'UPDATE_ANALYSIS_TILE',
                payload: { index: failedTileIndex, tile: updatedTile }
              });
            }
          }
        } /* else if ('status' in analysisCompleteData && analysisCompleteData.status === 'skipped') {
          dispatch({
            type: 'UPDATE_PROMPT_STATUS',
            payload: {
              prompt: normalizedCompletePrompt,
              provider: analysisCompleteData.provider,
              status: 'skipped'
            }
          });
        } else */ {
          dispatch({
            type: 'UPDATE_PROMPT_STATUS',
            payload: {
              prompt: normalizedCompletePrompt,
              provider: analysisCompleteData.provider,
              status: 'completed'
            }
          });
        }
        
        // Recalculer la progression globale après chaque prompt terminé
        const updatedStatus: PromptCompletionStatus = {
          ...promptCompletionStatusRef.current,
          [normalizedCompletePrompt]: {
            ...promptCompletionStatusRef.current[normalizedCompletePrompt],
            [analysisCompleteData.provider]: analysisCompleteData.status === 'failed' ? 'failed' : 'completed'
          }
        };
        
        const recomputedProgress = calculateGlobalProgress(
          'analyzing-prompts',
          0,
          updatedStatus,
          analyzingPromptsRef.current
        );
        
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          payload: {
            stage: 'analyzing-prompts',
            progress: recomputedProgress,
            message: `Analyzing prompts... (${recomputedProgress}%)`
          }
        });
        
        break;
      }

      case 'brand-extraction-progress':
        // Gestion de la progression d'extraction de marques
        const brandExtractionData = eventData.data as BrandExtractionProgressData;
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          payload: {
            stage: brandExtractionData.stage,
            progress: brandExtractionData.progress,
            message: brandExtractionData.message
          }
        });
        break;
        
      case 'stage':
        // Gestion des changements de stage pour éviter que la progression retombe à 0
        const stageData = eventData.data as ProgressData;
        let adjustedProgress = stageData.progress;
        
        // S'assurer que la progression ne retombe jamais en arrière
        if (stageData.stage === 'extracting-brands' && stageData.progress < 70) {
          adjustedProgress = 70;
        } else if (stageData.stage === 'calculating-scores' && stageData.progress < 90) {
          adjustedProgress = 90;
        }
        
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          payload: {
            stage: stageData.stage,
            progress: adjustedProgress,
            message: stageData.message
          }
        });
        break;

      case 'scoring-start':
        // Événement indiquant le début du calcul des scores pour un concurrent
        const scoringData = eventData.data as ScoringProgressData;
        const progressPercent = 90 + Math.round((scoringData.index / scoringData.total) * 10);
        const progressMessage = `Calculating scores for ${scoringData.competitor} (${scoringData.index}/${scoringData.total})`;
        
        dispatch({
          type: 'UPDATE_ANALYSIS_PROGRESS',
          payload: {
            stage: 'calculating-scores',
            progress: progressPercent,
            message: progressMessage
          }
        });
        break;

      case 'complete': {
        const completeData = eventData.data as AnalysisCompletePayload;
        if (completeData.analysis) {
          dispatch({
            type: 'ANALYSIS_COMPLETE',
            payload: completeData.analysis
          });
        }
        // Update credits after analysis is complete
        if (onCreditsUpdate) {
          onCreditsUpdate();
        }
        // Call the completion callback
        if (completeData.analysis && onAnalysisComplete) {
          onAnalysisComplete(completeData.analysis);
        }
        // Handle API usage summary if provided
        if (completeData.apiUsageSummary && onApiUsageSummary) {
          onApiUsageSummary(completeData.apiUsageSummary);
        }
        break;
      }

      case 'error':
        const errorData = eventData.data as { message?: string };
        let rawMessage = 'Analysis failed';
        if (errorData && typeof errorData === 'object') {
          if (errorData.message) {
            rawMessage = errorData.message;
          } else if (typeof errorData === 'string') {
            rawMessage = errorData;
          } else {
            rawMessage = JSON.stringify(errorData);
          }
        } else if (typeof errorData === 'string') {
          rawMessage = errorData;
        }

        // Map known server messages to i18n keys
        const mappedMessage = rawMessage === 'Please provide a prompt for the analysis'
          ? tErrors('promptRequired')
          : rawMessage;

        dispatch({
          type: 'SET_ERROR',
          payload: mappedMessage
        });
        logger.error('Analysis error:', errorData);
        break;
        
      default:
        logger.warn('[SSE] Unknown event type:', eventData.type);
        break;
    }
    } catch (error) {
      logger.error('[SSE] Error handling event:', error, 'Event data:', eventData);
      dispatch({
        type: 'SET_ERROR',
        payload: 'Error processing analysis event'
      });
    }
  };

  const startSSEConnection = async (url: string, options?: RequestInit, onConnected?: () => void) => {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze');
      }

      // Notify when connection is established successfully (HTTP 200)
      if (onConnected) {
        try { onConnected(); } catch (e) { logger.warn('[SSE] onConnected callback error:', e); }
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const parser = new SSEParser();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const events = parser.parse(chunk);

        for (const event of events) {
          if (event.data) {
            try {
              const eventData = JSON.parse(event.data);
              handleSSEEvent(eventData);
            } catch (e) {
              logger.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } catch (error) {
      // Check if it's a connection error
      if (error instanceof TypeError && error.message.includes('network')) {
        dispatch({
          type: 'SET_ERROR',
          payload: 'Connection lost. Please check your internet connection and try again.'
        });
      } else {
        dispatch({
          type: 'SET_ERROR',
          payload: 'Failed to analyze brand visibility'
        });
      }
      logger.error(error instanceof Error ? error.message : String(error));
      
      // Reset progress
      dispatch({
        type: 'SET_ANALYSIS_PROGRESS',
        payload: {
          stage: 'initializing',
          progress: 0,
          message: '',
          competitors: [],
          prompts: [],
          partialResults: []
        }
      });
    }
  };

  return { startSSEConnection };
}
