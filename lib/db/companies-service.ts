/**
 * Companies service - Company persistence and management
 * V2 with deduplication logic
 */

import { db } from '@/lib/db';
import {
  companies,
  companyLocales,
  companyUrls,
  scrapeSnapshots,
  type Company as DBCompany,
  type CompanyLocale,
  type NewCompany,
  type NewCompanyLocale,
  type NewScrapeSnapshot,
} from '@/lib/db/schema/companies';
import { canonicalizeUrl, extractBaseDomain } from './url-utils';
import { 
  extractBrandNameFromDomain, 
  normalizeCompanyName, 
  isSameDomainBase 
} from './companies-deduplication';
import { eq, or, and, desc, like } from 'drizzle-orm';
import type { Company } from '@/lib/types';
import { logger } from '@/lib/logger';

/**
 * Normalise une URL pour l'insertion dans company_urls
 * Évite les doublons comme https://gibson.com et https://www.gibson.com/
 */
export function normalizeUrlForStorage(url: string): string {
  try {
    // S'assurer que l'URL a un protocole
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsed = new URL(normalizedUrl);
    
    // Reconstruire l'URL normalisée sans trailing slash et avec protocole https
    const normalized = `https://${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}`;
    
    return normalized;
  } catch {
    // Si le parsing échoue, retourner l'URL nettoyée
    return url.trim().toLowerCase().replace(/\/$/, '');
  }
}

export async function getOrCreateCompanyByUrl({
  url,
  locale,
  preferredName,
}: {
  url: string;
  locale?: string;
  workspaceId?: string;
  preferredName?: string;
}): Promise<{ company: DBCompany; isNew: boolean }> {
  const canonical = canonicalizeUrl(url);

  // 1. Chercher par domaine canonique exact
  const [existing] = await db
    .select()
    .from(companies)
    .where(eq(companies.canonicalDomain, canonical))
    .limit(1);

  if (existing) {
    return { company: existing, isNew: false };
  }

  // 2. Chercher si cette URL est déjà dans company_urls
  const normalizedUrl = normalizeUrlForStorage(url);
  const [urlMatch] = await db
    .select({ company: companies })
    .from(companyUrls)
    .innerJoin(companies, eq(companyUrls.companyId, companies.id))
    .where(eq(companyUrls.url, normalizedUrl))
    .limit(1);

  if (urlMatch) {
    return { company: urlMatch.company, isNew: false };
  }

  // 3. NOUVEAU : Chercher par nom de marque similaire AVANT création
  const brandName = preferredName || extractBrandNameFromDomain(url);
  const normalizedBrand = normalizeCompanyName(brandName);
  
  // Chercher des companies existantes avec un nom similaire
  const potentialMatches = await db
    .select()
    .from(companies)
    .where(like(companies.name, `%${normalizedBrand}%`))
    .limit(10);

  // Vérifier si une correspond vraiment (même base de domaine)
  for (const match of potentialMatches) {
    if (isSameDomainBase(url, match.url) || 
        normalizeCompanyName(match.name) === normalizedBrand) {
      
      // Trouvé une correspondance ! Ajouter cette URL comme variante
      const normalizedUrl = normalizeUrlForStorage(url);
      await db.insert(companyUrls).values({
        companyId: match.id,
        url: normalizedUrl,
      }).onConflictDoNothing();
      
      // Mettre à jour canonical_domain si c'est une version plus générique
      const currentBase = extractBaseDomain(match.canonicalDomain);
      const newBase = extractBaseDomain(canonical);
      
      if (newBase.split('.').length < currentBase.split('.').length || 
          canonical.endsWith('.com')) {
        await db
          .update(companies)
          .set({ 
            canonicalDomain: canonical,
            url: url,
            updatedAt: new Date()
          })
          .where(eq(companies.id, match.id));
        
        return { 
          company: { ...match, canonicalDomain: canonical, url }, 
          isNew: false 
        };
      }
      
      return { company: match, isNew: false };
    }
  }

  // 4. Aucune correspondance trouvée, créer une nouvelle company
  // MAIS d'abord vérifier que le nom n'existe pas déjà (contrainte UNIQUE)
  const [existingByName] = await db
    .select()
    .from(companies)
    .where(eq(companies.name, brandName))
    .limit(1);

  if (existingByName) {
    // Le nom existe déjà, ajouter cette URL comme variante
    const normalizedUrl = normalizeUrlForStorage(url);
    await db.insert(companyUrls).values({
      companyId: existingByName.id,
      url: normalizedUrl,
    }).onConflictDoNothing();
    
    return { company: existingByName, isNew: false };
  }

  // Créer nouvelle company avec nom unique
  const [newCompany] = await db
    .insert(companies)
    .values({
      name: brandName,
      url,
      canonicalDomain: canonical,
      enrichmentStatus: 'stub',
    })
    .returning();

  await db.insert(companyUrls).values({
    companyId: newCompany.id,
    url: normalizeUrlForStorage(url),
  });

  return { company: newCompany, isNew: true };
}

export async function upsertCompanyFromScrape(
  scrapedCompany: Company,
  locale: string,
  originalUrl?: string
): Promise<string> {
  const canonical = canonicalizeUrl(scrapedCompany.url);

  // NOUVEAU : Chercher si données locale existent déjà
  const { company: existingCompany } = await getOrCreateCompanyByUrl({
    url: scrapedCompany.url,
    locale,
    preferredName: scrapedCompany.name
  });

  // Si la company existe ET la locale existe, retourner l'ID sans écraser
  if (existingCompany && existingCompany.enrichmentStatus !== 'stub') {
    const [existingLocale] = await db
      .select()
      .from(companyLocales)
      .where(
        and(
          eq(companyLocales.companyId, existingCompany.id),
          eq(companyLocales.locale, locale)
        )
      )
      .limit(1);

    if (existingLocale) {
      console.log(`✅ Données locale ${locale} pour ${scrapedCompany.name} déjà en cache DB`);
      return existingCompany.id;
    }
  }

  const companyData: Partial<NewCompany> = {
    name: scrapedCompany.name,
    url: scrapedCompany.url,
    canonicalDomain: canonical,
    logo: scrapedCompany.logo,
    favicon: scrapedCompany.favicon,
    enrichmentStatus: 'partial',
    lastRefreshedAt: new Date(),
  };

  if (scrapedCompany.businessProfile) {
    companyData.businessType = scrapedCompany.businessProfile.businessType;
    companyData.marketSegment = scrapedCompany.businessProfile.marketSegment;
    companyData.targetCustomers = scrapedCompany.businessProfile.targetCustomers;
    companyData.primaryMarkets = scrapedCompany.businessProfile.primaryMarkets;
    companyData.technologies = scrapedCompany.businessProfile.technologies;
    companyData.businessModel = scrapedCompany.businessProfile.businessModel;
    companyData.confidenceScore = scrapedCompany.businessProfile.confidenceScore.toString();
  }

  const [company] = await db
    .insert(companies)
    .values(companyData as NewCompany)
    .onConflictDoUpdate({
      target: companies.canonicalDomain,
      set: {
        name: companyData.name,
        logo: companyData.logo,
        favicon: companyData.favicon,
        businessType: companyData.businessType,
        marketSegment: companyData.marketSegment,
        targetCustomers: companyData.targetCustomers,
        primaryMarkets: companyData.primaryMarkets,
        technologies: companyData.technologies,
        businessModel: companyData.businessModel,
        confidenceScore: companyData.confidenceScore,
        enrichmentStatus: companyData.enrichmentStatus,
        lastRefreshedAt: companyData.lastRefreshedAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  // NOUVEAU : Ajouter l'URL originale dans company_urls si différente du canonical
  if (originalUrl && originalUrl !== canonical) {
    const normalizedOriginalUrl = normalizeUrlForStorage(originalUrl);
    await db
      .insert(companyUrls)
      .values({
        companyId: company.id,
        url: normalizedOriginalUrl,
      })
      .onConflictDoNothing();
  }

  if (scrapedCompany.url !== canonical) {
    const normalizedScrapedUrl = normalizeUrlForStorage(scrapedCompany.url);
    await db
      .insert(companyUrls)
      .values({
        companyId: company.id,
        url: normalizedScrapedUrl,
      })
      .onConflictDoNothing();
  }

  if (scrapedCompany.scrapedData) {
    const localeData: NewCompanyLocale = {
      companyId: company.id,
      locale,
      title: scrapedCompany.scrapedData.title,
      description: scrapedCompany.scrapedData.description,
      keywords: scrapedCompany.scrapedData.keywords,
      mainContent: scrapedCompany.scrapedData.mainContent,
      mainProducts: scrapedCompany.scrapedData.mainProducts || [],
      ogImage: scrapedCompany.scrapedData.ogImage,
      favicon: scrapedCompany.scrapedData.favicon,
      ogTitle: scrapedCompany.scrapedData.ogTitle,
      ogDescription: scrapedCompany.scrapedData.ogDescription,
      metaKeywords: scrapedCompany.scrapedData.metaKeywords || [],
      rawMetadata: (scrapedCompany.scrapedData.rawMetadata || {}) as unknown as string,
    };

    await db
      .insert(companyLocales)
      .values(localeData)
      .onConflictDoUpdate({
        target: [companyLocales.companyId, companyLocales.locale],
        set: {
          title: localeData.title,
          description: localeData.description,
          keywords: localeData.keywords,
          mainContent: localeData.mainContent,
          mainProducts: localeData.mainProducts,
          ogImage: localeData.ogImage,
          favicon: localeData.favicon,
          ogTitle: localeData.ogTitle,
          ogDescription: localeData.ogDescription,
          metaKeywords: localeData.metaKeywords,
          rawMetadata: localeData.rawMetadata,
          updatedAt: new Date(),
        },
      });
  }

  const snapshotData: NewScrapeSnapshot = {
    companyId: company.id,
    locale,
    sourceUrl: originalUrl || scrapedCompany.url,
    raw: scrapedCompany as unknown as string,
    fetchedAt: new Date(),
  };

  await db.insert(scrapeSnapshots).values(snapshotData);

  return company.id;
}

export async function getCompanyById(
  id: string,
  locale?: string
): Promise<(DBCompany & { localeData?: CompanyLocale }) | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);

  if (!company) {
    return null;
  }

  if (locale) {
    const [localeData] = await db
      .select()
      .from(companyLocales)
      .where(
        and(
          eq(companyLocales.companyId, id),
          eq(companyLocales.locale, locale)
        )
      )
      .limit(1);

    return { ...company, localeData };
  }

  return company;
}

export async function getCompanyLocales(companyId: string): Promise<string[]> {
  const locales = await db
    .select({ locale: companyLocales.locale })
    .from(companyLocales)
    .where(eq(companyLocales.companyId, companyId));

  return locales.map((l: { locale: string }) => l.locale);
}

export async function searchCompanies(
  query: string,
  limit = 10
): Promise<DBCompany[]> {
  const searchTerm = `%${query.toLowerCase()}%`;

  const results = await db
    .select()
    .from(companies)
    .where(
      or(
        eq(companies.name, searchTerm),
        eq(companies.canonicalDomain, searchTerm)
      )
    )
    .limit(limit);

  return results;
}

export async function getLatestSnapshot(
  companyId: string,
  locale?: string
) {
  const conditions = [eq(scrapeSnapshots.companyId, companyId)];
  if (locale) {
    conditions.push(eq(scrapeSnapshots.locale, locale));
  }

  const [snapshot] = await db
    .select()
    .from(scrapeSnapshots)
    .where(and(...conditions))
    .orderBy(desc(scrapeSnapshots.fetchedAt))
    .limit(1);

  return snapshot || null;
}

/**
 * Cherche une company existante sans la créer
 * Retourne null si la company n'existe pas
 */
export async function findExistingCompanyByUrl(url: string): Promise<DBCompany | null> {
  const canonical = canonicalizeUrl(url);

  // 1. Chercher si cette URL est déjà dans company_urls (priorité haute)
  const normalizedUrl = normalizeUrlForStorage(url);
  const [urlMatch] = await db
    .select({ company: companies })
    .from(companyUrls)
    .innerJoin(companies, eq(companyUrls.companyId, companies.id))
    .where(eq(companyUrls.url, normalizedUrl))
    .limit(1);

  if (urlMatch) {
    logger.debug(`✅ [findExistingCompanyByUrl] URL trouvée dans company_urls: ${url}`);
    return urlMatch.company;
  }

  // 2. Chercher par domaine canonique exact
  const [existing] = await db
    .select()
    .from(companies)
    .where(eq(companies.canonicalDomain, canonical))
    .limit(1);

  if (existing) {
    logger.debug(`✅ [findExistingCompanyByUrl] Domaine canonique trouvé: ${canonical}`);
    return existing;
  }

  // 3. Chercher par nom de marque (logique principale pour les domaines différents de la même marque)
  const brandName = extractBrandNameFromDomain(url);
  const normalizedBrand = normalizeCompanyName(brandName);
  
  logger.debug(`🔍 [findExistingCompanyByUrl] Recherche par nom de marque:`, {
    url,
    canonical,
    brandName,
    normalizedBrand
  });
  
  // Chercher des companies existantes avec le même nom normalisé
  const potentialMatches = await db
    .select()
    .from(companies)
    .where(eq(companies.name, brandName)) // Recherche exacte par nom
    .limit(10);

  logger.debug(`🔍 [findExistingCompanyByUrl] Companies avec nom "${brandName}":`, {
    count: potentialMatches.length,
    matches: potentialMatches.map(m => ({ id: m.id, name: m.name, url: m.url, canonicalDomain: m.canonicalDomain }))
  });

  // Vérifier si une correspond vraiment (même base de domaine)
  for (const match of potentialMatches) {
    const sameBase = isSameDomainBase(url, match.url);
    
    logger.debug(`🎯 [findExistingCompanyByUrl] Test matching:`, {
      matchName: match.name,
      matchUrl: match.url,
      matchCanonicalDomain: match.canonicalDomain,
      sameBase,
      wouldMatch: sameBase
    });
    
    if (sameBase) {
      logger.info(`✅ [findExistingCompanyByUrl] Match trouvé par nom de marque: ${match.name} pour ${url}`);
      return match;
    }
  }

  // 4. Fallback: chercher avec LIKE pour les variations de nom
  const likeMatches = await db
    .select()
    .from(companies)
    .where(like(companies.name, `%${normalizedBrand}%`))
    .limit(10);

  logger.debug(`🔍 [findExistingCompanyByUrl] Companies avec LIKE "${normalizedBrand}":`, {
    count: likeMatches.length,
    matches: likeMatches.map(m => ({ id: m.id, name: m.name, url: m.url, canonicalDomain: m.canonicalDomain }))
  });

  for (const match of likeMatches) {
    const sameBase = isSameDomainBase(url, match.url);
    const sameName = normalizeCompanyName(match.name) === normalizedBrand;
    
    logger.debug(`🎯 [findExistingCompanyByUrl] Test LIKE matching:`, {
      matchName: match.name,
      matchUrl: match.url,
      sameBase,
      sameName,
      wouldMatch: sameBase || sameName
    });
    
    if (sameBase || sameName) {
      logger.info(`✅ [findExistingCompanyByUrl] Match trouvé par LIKE: ${match.name} pour ${url}`);
      return match;
    }
  }

  logger.debug(`❌ [findExistingCompanyByUrl] Aucun match trouvé pour ${url}`);
  return null;
}

/**
 * Récupère les données d'une company depuis la BDD pour éviter un scrape inutile
 * Retourne null si les données n'existent pas ou sont incomplètes
 */
export async function getCompanyFromCache(
  url: string,
  locale: string
): Promise<Company | null> {
  // Chercher une company existante SANS la créer
  const dbCompany = await findExistingCompanyByUrl(url);
  
  // Si la company n'existe pas, pas de cache
  if (!dbCompany) {
    return null;
  }
  
  // Si c'est un stub, pas de cache
  if (dbCompany.enrichmentStatus === 'stub') {
    return null;
  }

  // Chercher les données locale
  const companyWithLocale = await getCompanyById(dbCompany.id, locale);
  
  if (!companyWithLocale || !companyWithLocale.localeData) {
    return null;
  }

  // Convertir en format app avec URL originale
  return dbCompanyToAppCompany(dbCompany, companyWithLocale.localeData, url);
}

export function dbCompanyToAppCompany(
  dbCompany: DBCompany,
  localeData?: CompanyLocale,
  originalUrl?: string
): Company {
  const company: Company = {
    id: dbCompany.id,
    name: dbCompany.name,
    url: dbCompany.url,
    originalUrl: originalUrl || dbCompany.url, // URL originale ou fallback
    logo: dbCompany.logo || undefined,
    favicon: dbCompany.favicon || undefined,
    scraped: dbCompany.enrichmentStatus !== 'stub',
    // NOUVEAU: Description au niveau racine pour CompanyCard
    description: localeData?.description || undefined,
  };

  if (localeData) {
    company.scrapedData = {
      title: localeData.title || '',
      description: localeData.description || '',
      keywords: localeData.keywords || [],
      mainContent: localeData.mainContent || '',
      mainProducts: localeData.mainProducts || [],
      ogImage: localeData.ogImage || undefined,
      favicon: localeData.favicon || undefined,
      ogTitle: localeData.ogTitle || undefined,
      ogDescription: localeData.ogDescription || undefined,
      metaKeywords: localeData.metaKeywords || [],
      rawMetadata: (localeData.rawMetadata || {}) as unknown as Record<string, unknown>,
    };
  }

  if (dbCompany.businessType) {
    company.businessProfile = {
      businessType: dbCompany.businessType,
      marketSegment: dbCompany.marketSegment || '',
      targetCustomers: dbCompany.targetCustomers || '',
      primaryMarkets: dbCompany.primaryMarkets || [],
      technologies: dbCompany.technologies || [],
      businessModel: dbCompany.businessModel || '',
      confidenceScore: parseFloat(dbCompany.confidenceScore || '0'),
    };
  }

  return company;
}
