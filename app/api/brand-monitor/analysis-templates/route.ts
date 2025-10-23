import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { handleApiError, AuthenticationError } from '@/lib/api-errors';
import { getUserDefaultWorkspace } from '@/lib/db/workspace-service';

export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view templates');
    }

    const workspaceId = await getUserDefaultWorkspace(sessionResponse.user.id);

    // Requête avec DISTINCT ON pour déduplication par URL
    // Retourne la plus récente analyse pour chaque URL unique
    const templates = await db.execute(sql`
      SELECT DISTINCT ON (url) 
        id, url, company_name, industry, 
        competitors, created_at, analysis_data
      FROM brand_analyses 
      WHERE workspace_id = ${workspaceId}
      ORDER BY url, created_at DESC
      LIMIT 5
    `);

    // Enrichir avec des métadonnées calculées
    const enrichedTemplates = templates.rows.map((t: Record<string, unknown>) => {
      const competitorCount = Array.isArray(t.competitors) 
        ? t.competitors.length 
        : 0;
      
      const logo = t.analysis_data?.company?.logo || 
                   t.analysis_data?.company?.favicon;
      
      const locale = t.analysis_data?.company?.primaryLanguage || 
                     'en'; // Détection locale depuis analysisData

      return {
        id: t.id,
        url: t.url,
        companyName: t.company_name,
        industry: t.industry,
        logo,
        locale,
        competitorCount,
        lastAnalyzedAt: t.created_at,
      };
    });

    return NextResponse.json({ templates: enrichedTemplates });
  } catch (error) {
    return handleApiError(error);
  }
}
