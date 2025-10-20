/**
 * Aliases service - Brand alias variation management
 */

import { db } from '@/lib/db';
import {
  brandAliasSets,
  brandAliases,
  type BrandAlias,
  type NewBrandAliasSet,
  type NewBrandAlias,
} from '@/lib/db/schema/companies';
import { eq, and, or } from 'drizzle-orm';
import type { BrandVariation } from '@/lib/types';

export async function upsertAliasSet({
  companyId,
  original,
  variations,
  confidence,
  scope,
  workspaceId,
  userId,
}: {
  companyId: string;
  original: string;
  variations: string[];
  confidence?: number;
  scope: 'global' | 'workspace';
  workspaceId?: string | null;
  userId?: string | null;
}): Promise<void> {
  const setData: NewBrandAliasSet = {
    companyId,
    original,
    confidence: confidence?.toString() || '1.00',
    scope,
    workspaceId: scope === 'workspace' ? workspaceId || null : null,
    createdByUserId: userId,
    updatedByUserId: userId,
  };

  const [aliasSet] = await db
    .insert(brandAliasSets)
    .values(setData)
    .onConflictDoUpdate({
      target: [
        brandAliasSets.companyId,
        brandAliasSets.original,
        brandAliasSets.scope,
        brandAliasSets.workspaceId,
      ],
      set: {
        confidence: setData.confidence,
        updatedByUserId: userId,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db.delete(brandAliases).where(eq(brandAliases.aliasSetId, aliasSet.id));

  if (variations.length > 0) {
    const aliasData: NewBrandAlias[] = variations.map((alias) => ({
      aliasSetId: aliasSet.id,
      alias,
    }));

    await db.insert(brandAliases).values(aliasData);
  }
}

export async function getAliasesForWorkspace({
  companyId,
  workspaceId,
}: {
  companyId: string;
  workspaceId?: string | null;
}): Promise<Record<string, BrandVariation>> {
  const conditions = [eq(brandAliasSets.companyId, companyId)];

  if (workspaceId) {
    conditions.push(
      or(
        eq(brandAliasSets.scope, 'global'),
        and(
          eq(brandAliasSets.scope, 'workspace'),
          eq(brandAliasSets.workspaceId, workspaceId)
        )
      )
    );
  } else {
    conditions.push(eq(brandAliasSets.scope, 'global'));
  }

  const sets = await db
    .select()
    .from(brandAliasSets)
    .where(and(...conditions));

  const result: Record<string, BrandVariation> = {};

  for (const set of sets) {
    const aliases = await db
      .select()
      .from(brandAliases)
      .where(eq(brandAliases.aliasSetId, set.id));

    const variationList = aliases.map((a: BrandAlias) => a.alias);

    if (result[set.original]) {
      result[set.original].variations.push(...variationList);
      result[set.original].variations = Array.from(
        new Set(result[set.original].variations)
      );
    } else {
      result[set.original] = {
        original: set.original,
        variations: variationList,
        confidence: parseFloat(set.confidence || '1.00'),
      };
    }
  }

  return result;
}

export async function getAllAliasesForCompany(
  companyId: string,
  workspaceId?: string | null
): Promise<string[]> {
  const aliasVariations = await getAliasesForWorkspace({
    companyId,
    workspaceId,
  });

  const allAliases: string[] = [];
  for (const variation of Object.values(aliasVariations)) {
    allAliases.push(variation.original);
    allAliases.push(...variation.variations);
  }

  return Array.from(new Set(allAliases));
}

export async function deleteAliasSet(
  setId: string
): Promise<void> {
  await db.delete(brandAliasSets).where(eq(brandAliasSets.id, setId));
}

export async function searchAliases(
  query: string,
  limit = 10
): Promise<BrandAlias[]> {
  const searchTerm = `%${query.toLowerCase()}%`;
  
  const results = await db
    .select()
    .from(brandAliases)
    .where(eq(brandAliases.alias, searchTerm))
    .limit(limit);

  return results;
}
