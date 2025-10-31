import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { findCompetitorsWithAIWebSearch } from '@/lib/competitor-pipeline/ai-web-search';
import { getCompetitorsFromCache } from '@/lib/db/competitors-service';
import { Company } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { 
      company, 
      maxResults = 9,
      useWebSearch = true,
      useSonarReasoning = false,
      workspaceId = null
    }: { 
      company: Company;
      maxResults?: number;
      useWebSearch?: boolean;
      useSonarReasoning?: boolean;
      workspaceId?: string | null;
    } = await request.json();
    
    if (!company || !company.name) {
      return NextResponse.json(
        { error: 'Company data is required' },
        { status: 400 }
      );
    }

    // NOUVEAU : Vérifier le cache des concurrents avant la recherche externe
    if (company.id) {
      logger.info('🔍 [API-AISearch] Checking competitors cache for company:', company.name);
      
      const cachedCompetitors = await getCompetitorsFromCache(
        company.id,
        workspaceId,
        0.1 // Score minimum
      );

      if (cachedCompetitors && cachedCompetitors.length > 0) {
        logger.info(`✅ [API-AISearch] Found ${cachedCompetitors.length} competitors in cache for ${company.name}`);
        
        return NextResponse.json({ 
          success: true, 
          competitors: cachedCompetitors.map(comp => ({
            name: comp.name,
            url: comp.url
          })),
          rawResults: cachedCompetitors,
          method: 'database-cache',
          model: 'cached',
          stats: {
            candidatesFound: cachedCompetitors.length,
            finalCompetitors: cachedCompetitors.length,
            processingTimeMs: 0,
            fromCache: true
          }
        });
      } else {
        logger.info('❌ [API-AISearch] No competitors found in cache, proceeding with external search');
      }
    } else {
      logger.info('⚠️ [API-AISearch] Company ID not provided, skipping cache check');
    }

    logger.info('🚀 [API-AISearch] Starting Perplexity competitor search for:', company.name);
    logger.debug(`⚙️ [API-AISearch] Options: ${maxResults} results, webSearch: ${useWebSearch}, sonarReasoning: ${useSonarReasoning}`);
    
    // Run Perplexity competitor search
    const competitors = await findCompetitorsWithAIWebSearch(
      company,
      maxResults, 
      useWebSearch, 
      company.name, 
      useSonarReasoning
    );
    
    logger.info('✅ [API-AISearch] Perplexity competitor search completed');
    logger.info(`📊 [API-AISearch] Found: ${competitors.length} competitors`);
    
    return NextResponse.json({ 
      success: true, 
      competitors: competitors.map(comp => ({
        name: comp.name,
        url: comp.url
      })),
      rawResults: competitors,
      method: 'perplexity-ai-search',
      model: useSonarReasoning ? 'sonar-reasoning' : 'sonar-pro',
      stats: {
        candidatesFound: competitors.length,
        finalCompetitors: competitors.length,
        processingTimeMs: 0, // Will be calculated in the function
        fromCache: false
      }
    });
    
  } catch (error) {
    logger.error('❌ [API-AISearch] Error in Perplexity competitor search:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to run Perplexity competitor search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
