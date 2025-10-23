/**
 * Aliases service - Brand alias management (simplified)
 */

import { db } from '@/lib/db';
import {
  brandAliases,
  type NewBrandAlias,
} from '@/lib/db/schema/companies';
import { eq, inArray } from 'drizzle-orm';

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
}

/**
 * Récupère toutes les variations d'une company
 */
export async function getAliasesForCompany(
  companyId: string
): Promise<string[]> {
  const aliases = await db
    .select({ alias: brandAliases.alias })
    .from(brandAliases)
    .where(eq(brandAliases.companyId, companyId));

  return aliases.map(a => a.alias);
}

/**
 * Récupère les variations de plusieurs companies
 */
export async function getBulkAliases(
  companyIds: string[]
): Promise<Record<string, string[]>> {
  if (companyIds.length === 0) return {};

  const aliases = await db
    .select({
      companyId: brandAliases.companyId,
      alias: brandAliases.alias,
    })
    .from(brandAliases)
    .where(inArray(brandAliases.companyId, companyIds));

  // Grouper par companyId
  const result: Record<string, string[]> = {};
  for (const alias of aliases) {
    if (!result[alias.companyId]) {
      result[alias.companyId] = [];
    }
    result[alias.companyId].push(alias.alias);
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
}