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
      
      const startTime = Date.now();
      const company = useDeepCrawl
        ? await crawlCompanyInfo(normalizedUrl, maxAge, locale)
        : await scrapeCompanyInfo(normalizedUrl, maxAge, locale);
      const duration = Date.now() - startTime;
      
      // Update tracking with duration
      apiUsageTracker.updateCall(callId, { duration });
      
      logger.info(`✅ [Scrape API] Company info scraped successfully:`, {
        name: company.name,
        url: company.url,
        industry: company.industry
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
    path.reduce((acc: any, k) => (acc ? acc[k] : undefined), obj);

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