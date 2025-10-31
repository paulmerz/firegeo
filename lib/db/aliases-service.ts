/**
 * Aliases service - Brand alias management (simplified)
 */

import { db } from '@/lib/db';
import {
  brandAliases,
  type NewBrandAlias,
} from '@/lib/db/schema/companies';
import { eq, inArray, sql } from 'drizzle-orm';

// --- In-memory read-through cache (no Redis) ---
// Version key per company computed from count + max(created_at)
const aliasCache = new Map<string, string[]>(); // key: `${companyId}:${versionKey}`
const companyVersionCache = new Map<string, string>(); // key: companyId -> versionKey

async function getCompanyAliasesVersion(companyId: string): Promise<string> {
  // Compute version as: `${count}-${maxCreatedAtISO}`
  const rows = await db.execute(sql<{
    count: number;
    max_created_at: Date | null;
  }>`
    SELECT COUNT(*)::int as count, MAX(created_at) as max_created_at
    FROM brand_aliases
    WHERE company_id = ${companyId}
  `);

  const row = Array.isArray(rows) ? (rows[0] as any) : (rows.rows?.[0] as any);
  const count = row?.count ?? 0;
  const maxCreatedAt = row?.max_created_at ? new Date(row.max_created_at) : null;
  const stamp = maxCreatedAt ? maxCreatedAt.getTime() : 0;
  return `${count}-${stamp}`;
}

function makeAliasCacheKey(companyId: string, versionKey: string): string {
  return `${companyId}:${versionKey}`;
}

export function clearAliasesMemoryCache(): void {
  aliasCache.clear();
  companyVersionCache.clear();
}

/**
 * Ajoute des variations pour une company donnée
 */
export async function upsertBrandAliases(
  companyId: string,
  aliases: string[]
): Promise<void> {
  if (aliases.length === 0) return;

  // Supprimer les alias existants pour cette company
  await db.delete(brandAliases).where(eq(brandAliases.companyId, companyId));

  // Insérer les nouveaux alias
  const aliasData: NewBrandAlias[] = aliases.map((alias) => ({
    companyId,
    alias,
  }));

  await db.insert(brandAliases).values(aliasData);

  // Invalidate memory cache for this company
  companyVersionCache.delete(companyId);
  // Alias value cache uses versioned keys; no need to delete all keys explicitly
}

/**
 * Récupère toutes les variations d'une company
 */
export async function getAliasesForCompany(
  companyId: string
): Promise<string[]> {
  // Resolve version key
  const versionKey = companyVersionCache.has(companyId)
    ? companyVersionCache.get(companyId)!
    : await getCompanyAliasesVersion(companyId);
  companyVersionCache.set(companyId, versionKey);

  const cacheKey = makeAliasCacheKey(companyId, versionKey);
  const cached = aliasCache.get(cacheKey);
  if (cached) return cached;

  const aliases = await db
    .select({ alias: brandAliases.alias })
    .from(brandAliases)
    .where(eq(brandAliases.companyId, companyId));

  const list = aliases.map(a => a.alias);
  aliasCache.set(cacheKey, list);
  return list;
}

/**
 * Récupère les variations de plusieurs companies
 */
export async function getBulkAliases(
  companyIds: string[]
): Promise<Record<string, string[]>> {
  if (companyIds.length === 0) return {};

  // Strategy: attempt to serve from per-company cache; fetch misses individually
  const result: Record<string, string[]> = {};

  // First resolve versions (may need DB)
  const versions = await Promise.all(
    companyIds.map(async (id) => {
      if (companyVersionCache.has(id)) return [id, companyVersionCache.get(id)!] as const;
      const v = await getCompanyAliasesVersion(id);
      companyVersionCache.set(id, v);
      return [id, v] as const;
    })
  );

  const misses: string[] = [];
  for (const [id, v] of versions) {
    const key = makeAliasCacheKey(id, v);
    const cached = aliasCache.get(key);
    if (cached) {
      result[id] = cached;
    } else {
      misses.push(id);
    }
  }

  if (misses.length > 0) {
    const rows = await db
      .select({
        companyId: brandAliases.companyId,
        alias: brandAliases.alias,
      })
      .from(brandAliases)
      .where(inArray(brandAliases.companyId, misses));

    const grouped: Record<string, string[]> = {};
    for (const r of rows) {
      if (!grouped[r.companyId]) grouped[r.companyId] = [];
      grouped[r.companyId].push(r.alias);
    }

    // Write to cache with versioned keys
    for (const [id, v] of versions) {
      if (!misses.includes(id)) continue;
      const list = grouped[id] || [];
      const key = makeAliasCacheKey(id, v);
      aliasCache.set(key, list);
      result[id] = list;
    }
  }

  return result;
}

/**
 * Supprime tous les alias d'une company
 */
export async function deleteAliasesForCompany(
  companyId: string
): Promise<void> {
  await db.delete(brandAliases).where(eq(brandAliases.companyId, companyId));

  // Invalidate memory cache for this company
  companyVersionCache.delete(companyId);
}