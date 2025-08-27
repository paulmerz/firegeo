import { NextRequest, NextResponse } from 'next/server';
import { findCompetitorsWithAIWebSearch } from '@/lib/competitor-pipeline/ai-web-search';
import { Company } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { 
      company, 
      maxResults = 10,
      useWebSearch = true
    }: { 
      company: Company;
      maxResults?: number;
      useWebSearch?: boolean;
    } = await request.json();
    
    if (!company || !company.name) {
      return NextResponse.json(
        { error: 'Company data is required' },
        { status: 400 }
      );
    }

    console.log('🚀 [API-AISearch] Starting AI web search for:', company.name);
    console.log(`⚙️ [API-AISearch] Options: ${maxResults} results, webSearch: ${useWebSearch}`);
    
    // Run only AI web search
    const competitors = await findCompetitorsWithAIWebSearch(company as any, maxResults, useWebSearch, company.name);
    
    console.log('✅ [API-AISearch] AI web search completed');
    console.log(`📊 [API-AISearch] Found: ${competitors.length} competitors`);
    
    return NextResponse.json({ 
      success: true, 
      competitors: competitors.map(comp => ({
        name: comp.name,
        url: comp.url
      })),
      rawResults: competitors,
      method: 'ai-web-search',
      stats: {
        candidatesFound: competitors.length,
        finalCompetitors: competitors.length,
        processingTimeMs: 0 // Will be calculated in the function
      }
    });
    
  } catch (error) {
    console.error('❌ [API-AISearch] Error in AI web search:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to run AI web search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
