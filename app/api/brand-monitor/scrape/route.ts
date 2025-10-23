import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { scrapeCompanyInfo, crawlCompanyInfo } from '@/lib/scrape-utils';
import { getLocaleFromRequest } from '@/lib/locale-utils';
import { 
  handleApiError, 
  AuthenticationError, 
  ValidationError
} from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { apiUsageTracker } from '@/lib/api-usage-tracker';

export async function POST(request: NextRequest) {
  try {
    logger.info('🔍 [Scrape API] Starting scrape request');
    
    // Get the session
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      logger.error('❌ [Scrape API] No authenticated user');
      throw new AuthenticationError('Please log in to use this feature');
    }
    
    logger.debug(`🔍 [Scrape API] Authenticated user: ${sessionResponse.user.id}`);

    // No longer checking/deducting credits here. Debit now happens when the URL input is rendered.

    const { url, maxAge, useDeepCrawl, compareBoth } = await request.json();
    logger.debug(`🔍 [Scrape API] Request data:`, { url, maxAge, useDeepCrawl, compareBoth });

    if (!url) {
      logger.error('❌ [Scrape API] No URL provided');
      throw new ValidationError('Invalid request', {
        url: 'URL is required'
      });
    }
    
    // Ensure URL has protocol
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    logger.debug(`🔍 [Scrape API] Normalized URL: ${normalizedUrl}`);

    // No debit here anymore; handled earlier to avoid charging on network errors

    // Extract locale from request
    const locale = getLocaleFromRequest(request);
    logger.debug(`🔍 [Scrape API] Locale: ${locale}`);
    
    if (compareBoth) {
      logger.info('🧪 [Scrape API] Comparing single-page vs deep crawl...');
      
      // Track both scraping operations
      const singleCallId = apiUsageTracker.trackCall({
        provider: 'firecrawl',
        model: 'scrape',
        operation: 'scrape',
        success: true,
        metadata: { type: 'single-page', url: normalizedUrl }
      });
      
      const deepCallId = apiUsageTracker.trackCall({
        provider: 'firecrawl',
        model: 'crawl',
        operation: 'scrape',
        success: true,
        metadata: { type: 'deep-crawl', url: normalizedUrl }
      });
      
      const startTime = Date.now();
      const [single, deep] = await Promise.all([
        scrapeCompanyInfo(normalizedUrl, maxAge, locale),
        crawlCompanyInfo(normalizedUrl, maxAge, locale)
      ]);
      const duration = Date.now() - startTime;
      
      // Update tracking with duration
      apiUsageTracker.updateCall(singleCallId, { duration: duration / 2 });
      apiUsageTracker.updateCall(deepCallId, { duration: duration / 2 });
      
      const diff = buildComparison(single, deep);
      logger.debug('🧪 [Scrape API] Comparison diff:', diff);
      return NextResponse.json({ single, deep, diff });
    } else {
      logger.info(`🔍 [Scrape API] Starting company ${useDeepCrawl ? 'deep crawl' : 'single-page scrape'}...`);
      
      // Track scraping operation
      const callId = apiUsageTracker.trackCall({
        provider: 'firecrawl',
        model: useDeepCrawl ? 'crawl' : 'scrape',
        operation: 'scrape',
        success: true,
        metadata: { 
          type: useDeepCrawl ? 'deep-crawl' : 'single-page', 
          url: normalizedUrl 
        }
      });
      
      // NOUVEAU : Vérifier cache BDD avant scraping
      const { getCompanyFromCache, upsertCompanyFromScrape } = await import('@/lib/db/companies-service');
      const cachedCompany = await getCompanyFromCache(normalizedUrl, locale);
      
      let company;
      let duration = 0;
      
      if (cachedCompany) {
        // Données en cache, pas besoin de scraper !
        logger.info(`✅ [Scrape API] Données servies depuis cache BDD pour ${normalizedUrl} (locale: ${locale})`);
        company = {
          id: cachedCompany.id,
          name: cachedCompany.name,
          url: cachedCompany.url,
          originalUrl: normalizedUrl,
          description: cachedCompany.description,
          industry: cachedCompany.businessProfile?.businessType || cachedCompany.businessProfile?.marketSegment,
          logo: cachedCompany.logo || undefined,
          favicon: cachedCompany.favicon || undefined,
          scraped: true,
          scrapedData: cachedCompany.scrapedData,
          businessProfile: cachedCompany.businessProfile,
        };
        apiUsageTracker.updateCall(callId, { duration: 0 });
      } else {
        // Pas de cache, scraper normalement
        const startTime = Date.now();
        company = useDeepCrawl
          ? await crawlCompanyInfo(normalizedUrl, maxAge, locale)
          : await scrapeCompanyInfo(normalizedUrl, maxAge, locale);
        duration = Date.now() - startTime;
        
        // Update tracking with duration
        apiUsageTracker.updateCall(callId, { duration });
        
        // Save company to database
        
        const savedCompanyId = await upsertCompanyFromScrape(company, locale, normalizedUrl);
        company.id = savedCompanyId;
        // Ajouter l'URL originale pour l'affichage
        company.originalUrl = normalizedUrl;
      }
      
      logger.info(`✅ [Scrape API] Company info scraped successfully:`, {
        name: company.name,
        url: company.url,
        industry: (company as CompanyData).industry || 'Unknown',
        id: company.id
      });
      
      return NextResponse.json({ company });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

interface CompanyData {
  name?: string;
  url?: string;
  industry?: string;
  description?: string;
  scrapedData?: {
    keywords?: string[];
    mainProducts?: string[];
  };
  businessProfile?: {
    businessType?: string;
    marketSegment?: string;
    primaryMarkets?: string[];
    technologies?: string[];
    businessModel?: string;
  };
}

function buildComparison(single: CompanyData | null, deep: CompanyData | null) {
  const field = (obj: CompanyData | null, path: string[]): unknown =>
    path.reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj);

  const pick = (obj: CompanyData | null) => ({
    name: obj?.name,
    url: obj?.url,
    industry: obj?.industry,
    description: obj?.description,
    keywords: field(obj, ['scrapedData', 'keywords']),
    mainProducts: field(obj, ['scrapedData', 'mainProducts']),
    businessType: field(obj, ['businessProfile', 'businessType']),
    marketSegment: field(obj, ['businessProfile', 'marketSegment']),
    primaryMarkets: field(obj, ['businessProfile', 'primaryMarkets']),
    technologies: field(obj, ['businessProfile', 'technologies']),
    businessModel: field(obj, ['businessProfile', 'businessModel']),
  });

  const s = pick(single);
  const d = pick(deep);

  const diff: Record<string, { single: unknown; deep: unknown; improved?: boolean }> = {};
  for (const key of Object.keys(s) as Array<keyof typeof s>) {
    const sValue = s[key];
    const dValue = d[key];
    if (JSON.stringify(sValue) !== JSON.stringify(dValue)) {
      diff[key] = { single: sValue, deep: dValue, improved: !!dValue && !sValue };
    }
  }
  return diff;
}