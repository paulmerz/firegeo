import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Autumn } from 'autumn-js';
import { scrapeCompanyInfo, crawlCompanyInfo } from '@/lib/scrape-utils';
import { getLocaleFromRequest } from '@/lib/locale-utils';
import { 
  handleApiError, 
  AuthenticationError, 
  ValidationError,
  InsufficientCreditsError,
  ExternalServiceError 
} from '@/lib/api-errors';
import { FEATURE_ID_CREDITS } from '@/config/constants';
import { logger } from '@/lib/logger';
import { apiUsageTracker } from '@/lib/api-usage-tracker';

function getAutumn() {
  const secret = process.env.AUTUMN_SECRET_KEY;
  if (!secret) {
    throw new Error('Autumn secret key or publishable key is required');
  }
  return new Autumn({ secretKey: secret });
}

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

function buildComparison(single: any, deep: any) {
  const field = (obj: any, path: string[]) => path.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
  const pick = (obj: any) => ({
    name: obj?.name,
    url: obj?.url,
    industry: obj?.industry,
    description: obj?.description,
    keywords: field(obj, ['scrapedData','keywords']),
    mainProducts: field(obj, ['scrapedData','mainProducts']),
    businessType: field(obj, ['businessProfile','businessType']),
    marketSegment: field(obj, ['businessProfile','marketSegment']),
    primaryMarkets: field(obj, ['businessProfile','primaryMarkets']),
    technologies: field(obj, ['businessProfile','technologies']),
    businessModel: field(obj, ['businessProfile','businessModel']),
  });
  const s = pick(single || {});
  const d = pick(deep || {});
  const diff: Record<string, { single: any; deep: any; improved?: boolean }> = {};
  for (const key of Object.keys(s)) {
    if (JSON.stringify((s as any)[key]) !== JSON.stringify((d as any)[key])) {
      diff[key] = { single: (s as any)[key], deep: (d as any)[key], improved: !!(d as any)[key] && !(s as any)[key] };
    }
  }
  return diff;
}