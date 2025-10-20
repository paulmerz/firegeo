/**
 * Competitors service - Competitor relationship management
 */

import { db } from '@/lib/db';
import {
  competitorEdges,
  companies,
  type CompetitorEdge,
  type NewCompetitorEdge,
} from '@/lib/db/schema/companies';
import { getOrCreateCompanyByUrl } from './companies-service';
import { eq, and, or, desc } from 'drizzle-orm';

export async function upsertCompetitorEdge({
  companyId,
  competitorName,
  competitorUrl,
  score,
  source,
  scope,
  workspaceId,
  userId,
}: {
  companyId: string;
  competitorName: string;
  competitorUrl?: string;
  score: number;
  source: 'scrape' | 'user';
  scope: 'global' | 'workspace';
  workspaceId?: string | null;
  userId?: string | null;
}): Promise<void> {
  let competitorId: string;

  if (competitorUrl) {
    const { company: competitor } = await getOrCreateCompanyByUrl({
      url: competitorUrl,
      workspaceId: workspaceId || undefined,
    });
    competitorId = competitor.id;
  } else {
    const [existingCompetitor] = await db
      .select()
      .from(companies)
      .where(eq(companies.name, competitorName))
      .limit(1);

    if (existingCompetitor) {
      competitorId = existingCompetitor.id;
    } else {
      const [newCompetitor] = await db
        .insert(companies)
        .values({
          name: competitorName,
          url: '',
          canonicalDomain: competitorName.toLowerCase().replace(/\s+/g, '-'),
          enrichmentStatus: 'stub',
        })
        .returning();
      competitorId = newCompetitor.id;
    }
  }

  const edgeData: NewCompetitorEdge = {
    companyId,
    competitorId,
    competitionScore: score.toString(),
    source,
    scope,
    workspaceId: scope === 'workspace' ? workspaceId || null : null,
    createdByUserId: userId,
    updatedByUserId: userId,
  };

  await db
    .insert(competitorEdges)
    .values(edgeData)
    .onConflictDoUpdate({
      target: [
        competitorEdges.companyId,
        competitorEdges.competitorId,
        competitorEdges.scope,
        competitorEdges.workspaceId,
      ],
      set: {
        competitionScore: edgeData.competitionScore,
        updatedByUserId: userId,
        updatedAt: new Date(),
      },
    });
}

export async function mergeCompetitorsForWorkspace({
  companyId,
  workspaceId,
}: {
  companyId: string;
  workspaceId?: string | null;
  locale?: string;
}): Promise<
  Array<{
    id: string;
    name: string;
    url: string;
    score: number;
    scope: 'global' | 'workspace';
  }>
> {
  const conditions = [eq(competitorEdges.companyId, companyId)];

  if (workspaceId) {
    conditions.push(
      or(
        eq(competitorEdges.scope, 'global'),
        and(
          eq(competitorEdges.scope, 'workspace'),
          eq(competitorEdges.workspaceId, workspaceId)
        )
      )
    );
  } else {
    conditions.push(eq(competitorEdges.scope, 'global'));
  }

  const edges = await db
    .select({
      edge: competitorEdges,
      competitor: companies,
    })
    .from(competitorEdges)
    .innerJoin(companies, eq(competitorEdges.competitorId, companies.id))
    .where(and(...conditions))
    .orderBy(desc(competitorEdges.competitionScore));

  const competitorMap = new Map<
    string,
    {
      id: string;
      name: string;
      url: string;
      score: number;
      scope: 'global' | 'workspace';
    }
  >();

  for (const { edge, competitor } of edges) {
    if (!competitorMap.has(competitor.id)) {
      competitorMap.set(competitor.id, {
        id: competitor.id,
        name: competitor.name,
        url: competitor.url,
        score: parseFloat(edge.competitionScore),
        scope: edge.scope,
      });
    }
  }

  return Array.from(competitorMap.values());
}

export async function getCompetitorEdges(
  companyId: string,
  workspaceId?: string | null
): Promise<CompetitorEdge[]> {
  const conditions = [eq(competitorEdges.companyId, companyId)];

  if (workspaceId) {
    conditions.push(
      or(
        eq(competitorEdges.scope, 'global'),
        and(
          eq(competitorEdges.scope, 'workspace'),
          eq(competitorEdges.workspaceId, workspaceId)
        )
      )
    );
  } else {
    conditions.push(eq(competitorEdges.scope, 'global'));
  }

  return db.select().from(competitorEdges).where(and(...conditions));
}

export async function deleteCompetitorEdge(
  edgeId: string
): Promise<void> {
  await db.delete(competitorEdges).where(eq(competitorEdges.id, edgeId));
}

/**
 * Récupère les concurrents depuis le cache BDD pour éviter une recherche externe
 * Retourne null si aucun concurrent n'est trouvé en cache
 */
export async function getCompetitorsFromCache(
  companyId: string,
  workspaceId?: string | null,
  minScore: number = 0.1
): Promise<Array<{
  name: string;
  url: string;
  score: number;
}> | null> {
  try {
    const cachedCompetitors = await mergeCompetitorsForWorkspace({
      companyId,
      workspaceId,
    });

    // Filtrer par score minimum et vérifier qu'il y a des concurrents
    const filteredCompetitors = cachedCompetitors
      .filter(comp => comp.score >= minScore)
      .map(comp => ({
        name: comp.name,
        url: comp.url,
        score: comp.score,
      }));

    if (filteredCompetitors.length === 0) {
      return null;
    }

    return filteredCompetitors;
  } catch (error) {
    console.error('❌ [CompetitorsCache] Error retrieving competitors from cache:', error);
    return null;
  }
}
