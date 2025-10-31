import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm/sql';
import { handleApiError, AuthenticationError } from '@/lib/api-errors';
import { getUserDefaultWorkspace } from '@/lib/db/workspace-service';
import { brandAnalysis, companies } from '@/lib/db/schema';

// Interface pour typer analysis_data
interface AnalysisData {
  company?: {
    logo?: string;
    favicon?: string;
    primaryLanguage?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view templates');
    }

    const workspaceId = await getUserDefaultWorkspace(sessionResponse.user.id);

    // Requête avec DISTINCT ON pour déduplication par company_id
    // Retourne la plus récente analyse pour chaque company unique
    const templates = await db.execute(sql`
      SELECT DISTINCT ON (ba.company_id) 
        ba.id, ba.company_id, ba.competitors, ba.created_at,
        c.name as company_name, c.url, c.favicon, c.logo, c.primary_language
      FROM brand_analysis ba
      LEFT JOIN companies c ON ba.company_id = c.id
      WHERE ba.workspace_id = ${workspaceId}
        AND ba.company_id IS NOT NULL
      ORDER BY ba.company_id, ba.created_at DESC
      LIMIT 6
    `);

    // Enrichir avec des métadonnées calculées
    const enrichedTemplates = templates.rows.map((t: Record<string, unknown>) => {
      const competitorCount = Array.isArray(t.competitors) 
        ? t.competitors.length 
        : 0;
      
      // Utiliser le favicon de la table companies en priorité, puis le logo
      const favicon = t.favicon as string | null;
      const logo = t.logo as string | null;
      const iconUrl = favicon || logo;
      
      const locale = t.primary_language as string || 'en';

      return {
        id: t.id,
        url: t.url,
        companyName: t.company_name,
        industry: null, // Plus stocké dans brand_analysis
        logo: iconUrl,
        favicon: favicon, // Ajouter le favicon séparément
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
