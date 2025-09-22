import { generateObject } from 'ai';
import { z } from 'zod';
import { Company } from './types';
import FirecrawlApp from '@mendable/firecrawl-js';
import { getConfiguredProviders, getProviderModel } from './provider-config';
import { getLanguageInstruction } from './locale-utils';

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

// Enhanced unified schema combining CompanyInfoSchema + CompanyProfileSchema
const EnhancedCompanySchema = z.object({
  // Core company info (original CompanyInfoSchema)
  name: z.string()
    .min(1, "Company name cannot be empty")
    .refine(name => name.trim().length > 0, "Company name cannot be just whitespace")
    .refine(name => name === name.trim(), "Company name should not have leading/trailing whitespace"),
  description: z.string(),
  keywords: z.array(z.string()),
  industry: z.string(),
  mainProducts: z.array(z.string()),
  competitors: z.array(z.string()).optional(),
  
  // Enhanced business profile (from CompanyProfileSchema)
  businessType: z.string().describe('Specific type of business (e.g., "Premium electric bicycle manufacturer")'),
  marketSegment: z.string().describe('Market segment (premium, mid-tier, budget, enterprise, SMB, etc.)'),
  targetCustomers: z.string().describe('Target customer profile/ICP'),
  primaryMarkets: z.array(z.string()).describe('Main geographic markets/countries'),
  technologies: z.array(z.string()).describe('Key technologies used or related to business'),
  businessModel: z.string().describe('Business model (B2B, B2C, SaaS, marketplace, etc.)'),
  
  // Competitor search optimization
  competitorSearchKeywords: z.array(z.string()).describe('Keywords for finding competitors (8-12 specific terms)'),
  alternativeSearchTerms: z.array(z.string()).describe('Alternative terms users might search for'),
  
  // Analysis metadata
  confidenceScore: z.number().min(0).max(1).describe('Confidence in analysis accuracy (0-1)'),
  estimatedNAICE: z.string().optional().describe('Estimated NACE/NAICS industry code')
});

export async function scrapeCompanyInfo(url: string, maxAge?: number, locale?: string): Promise<Company> {
  try {
    console.log(`🔍 [Scraper] Starting scrape for URL: ${url}`);
    
    // Ensure URL has protocol
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    console.log(`🔍 [Scraper] Normalized URL: ${normalizedUrl}`);
    
    // Default to 1 week cache if not specified
    const cacheAge = maxAge ? Math.floor(maxAge / 1000) : 604800; // 1 week in seconds
    
    // Check Firecrawl API key
    if (!process.env.FIRECRAWL_API_KEY) {
      console.error('❌ [Scraper] FIRECRAWL_API_KEY not configured');
      throw new Error('FIRECRAWL_API_KEY not configured');
    }
    
    console.log(`🔍 [Scraper] Using cache age: ${cacheAge} seconds`);
    
    // Optimized Firecrawl scraping with enhanced parameters
    // Combines the best settings from both scrapeCompanyInfo and scrapeCompanyWithFirecrawl
    console.log(`🔍 [Scraper] Calling Firecrawl API...`);
    const response = await firecrawl.scrapeUrl(normalizedUrl, {
      formats: ['markdown'],
      maxAge: cacheAge,
      onlyMainContent: true, // Focus on main content to reduce complexity
      waitFor: 3000, // Wait 3 seconds for page load (robust setting)
      timeout: 20000, // 20 seconds timeout (increased from default)
      includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p'], // Focused tags for better extraction
      excludeTags: ['script', 'style', 'nav', 'footer', 'aside', 'iframe', 'video'] // Comprehensive exclusions
    });
    
    console.log(`🔍 [Scraper] Firecrawl response received:`, {
      success: (response as any)?.success,
      error: (response as any)?.error,
      hasMarkdown: ('markdown' in (response as any)) && !!(response as any).markdown,
      markdownLength: ('markdown' in (response as any)) && (response as any).markdown ? (response as any).markdown.length : 0
    });
    if (!(response as any)?.success) {
      // Handle specific timeout errors more gracefully
      if (response.error && response.error.includes('timed out')) {
        console.warn(`⚠️ [Scraper] Timeout scraping ${normalizedUrl}, retrying with basic mode...`);
        
        // Retry with minimal, fast settings (fallback mode)
        const retryResponse = await firecrawl.scrapeUrl(normalizedUrl, {
          formats: ['markdown'],
          maxAge: cacheAge,
          onlyMainContent: true,
          waitFor: 1000, // Reduced wait time
          timeout: 10000 // Reduced timeout
        });
        
        if (!retryResponse.success) {
          throw new Error(`Scraping failed after retry: ${retryResponse.error}`);
        }
        
        const rr: any = retryResponse as any;
        return processScrapedData(rr.markdown || '', rr.metadata, normalizedUrl, locale);
      }
      
      throw new Error((response as any)?.error);
    }
    const r: any = response as any;
    return processScrapedData(r.markdown || '', r.metadata, normalizedUrl, locale);
  } catch (error) {
    console.error('Error scraping company info:', error);
    throw error;
  }
}

/**
 * Deep crawl using Firecrawl /crawl to gather multiple pages for better business understanding
 */
export async function crawlCompanyInfo(url: string, maxAge?: number, locale?: string): Promise<Company> {
  try {
    console.log(`🕷️ [Crawler] Starting crawl for URL: ${url}`);
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    const cacheAge = maxAge ? Math.floor(maxAge / 1000) : 604800;
    if (!process.env.FIRECRAWL_API_KEY) {
      console.error('❌ [Crawler] FIRECRAWL_API_KEY not configured');
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    // Crawl parameters tuned for business comprehension
    const crawlOptions: any = {
      maxDepth: 2,
      limit: 20,
      allowExternalLinks: false,
      // Keep options minimal to satisfy v1 API; advanced filters removed
    };

    console.log('🕷️ [Crawler] Calling Firecrawl crawlUrl with options:', crawlOptions);
    const result: any = await (firecrawl as any).crawlUrl(normalizedUrl, crawlOptions);
    if (!result) {
      throw new Error('Crawl returned empty result');
    }

    // Some SDK versions return a job id and require polling
    let pages: any[] = [];
    if (result?.success && (result as any).data && Array.isArray((result as any).data)) {
      // Direct pages array
      pages = ((result as any).data as any[]).filter(Boolean);
    } else if (Array.isArray((result as any).pages)) {
      pages = ((result as any).pages as any[]).filter(Boolean);
    } else {
      const jobId = (result as any).jobId || (result as any).id || (result as any).data?.id;
      if (!jobId && result?.error) {
        throw new Error(result.error);
      }
      if (jobId) {
        console.log(`🕷️ [Crawler] Received job id: ${jobId}. Polling status...`);
        const startedAt = Date.now();
        const timeoutMs = 45000;
        while (Date.now() - startedAt < timeoutMs) {
          await new Promise(r => setTimeout(r, 1000));
          let statusResp: any = null;
          try {
            // Try both method names for compatibility
            const checker = (firecrawl as any).checkCrawlStatus || (firecrawl as any).getCrawlStatus;
            if (checker) {
              statusResp = await checker.call(firecrawl, jobId);
            }
          } catch (e) {
            console.warn('🕷️ [Crawler] Status polling error (non-fatal):', e);
          }

          const statusObj: any = statusResp || {};
          const isCompleted = statusObj?.status?.toLowerCase?.() === 'completed' || statusObj?.completed === true;
          const hasData = Array.isArray(statusObj?.data) || Array.isArray(statusObj?.pages);
          if (isCompleted || hasData) {
            pages = (statusObj?.pages || statusObj?.data || []).filter(Boolean);
            break;
          }
        }
      }
    }

    console.log(`🕷️ [Crawler] Pages crawled: ${pages.length}`);
    if (!pages || pages.length === 0) {
      console.warn('🕷️ [Crawler] No pages returned from crawl. Falling back to single-page scrape.');
      return scrapeCompanyInfo(url, maxAge, locale);
    }

    // Concatenate top pages content (prioritize about/products/services)
    const prioritize = (path: string) => {
      const p = path.toLowerCase();
      if (p.includes('about') || p.includes('a-propos') || p.includes('company')) return 3;
      if (p.includes('product') || p.includes('products') || p.includes('services') || p.includes('solutions')) return 3;
      if (p.includes('technology') || p.includes('innovation')) return 2;
      if (p.includes('blog') || p.includes('news')) return 1;
      return 0;
    };

    const sorted = pages
      .map(p => ({
        path: p.path || p.url || '',
        markdown: p.markdown || p.content || '',
        metadata: p.metadata || {},
        score: prioritize((p.path || p.url || ''))
      }))
      .sort((a, b) => b.score - a.score);

    const combinedMarkdown = sorted
      .slice(0, 20)
      .map(p => `\n\n# Source: ${p.path}\n\n${p.markdown || ''}`)
      .join('\n');

    // Merge some metadata (take homepage-like first if present)
    const homepageMeta = sorted.find(p => {
      const path = (p.path || '').toLowerCase();
      return path === '/' || path.endsWith('.com') || path.endsWith('.fr') || path.includes('index');
    })?.metadata || sorted[0]?.metadata || {};

    return processScrapedData(combinedMarkdown, homepageMeta, normalizedUrl, locale);
  } catch (error) {
    console.error('Error crawling company info:', error);
    // Fallback to single page scrape
    return scrapeCompanyInfo(url, maxAge, locale);
  }
}

/**
 * Process scraped data and extract structured information
 */
async function processScrapedData(markdown: string, metadata: any, url: string, locale?: string): Promise<any> {
  try {
    console.log(`🔍 [Processor] Processing scraped data for URL: ${url}`);
    // Log le markdown complet pour inspection
    console.log(`🔍 [Processor] Combined Markdown:\n${markdown}`);
    console.log(`🔍 [Processor] Metadata:`, metadata);
    
    const html = markdown;
    
    // Use AI to extract structured information - try providers in order of preference
    const configuredProviders = getConfiguredProviders();
    console.log(`🔍 [Processor] Available providers:`, configuredProviders.map(p => p.name));
    
    if (configuredProviders.length === 0) {
      console.error('❌ [Processor] No AI providers configured and enabled for content extraction');
      throw new Error('No AI providers configured and enabled for content extraction');
    }
    
    // Try providers in order of preference (fastest first)
    const providerOrder = ['openai', 'anthropic', 'google', 'perplexity'];
    let selectedProvider = null;
    let selectedModel = null;
    
    for (const providerId of providerOrder) {
      const provider = configuredProviders.find(p => p.id === providerId);
      if (provider) {
        console.log(`🔍 [Processor] Trying provider: ${provider.name}`);
        
        // Try to find a fast model first, then fallback to default
        const fastModel = provider.models.find(m => 
          m.name.toLowerCase().includes('mini') || 
          m.name.toLowerCase().includes('flash') ||
          m.name.toLowerCase().includes('haiku')
        );
        
        const modelId = fastModel?.id || provider.defaultModel;
        const model = getProviderModel(provider.id, modelId);
        
        if (model) {
          selectedProvider = provider;
          selectedModel = model;
          console.log(`✅ [Processor] Selected provider: ${provider.name} with model: ${model}`);
          break;
        } else {
          console.warn(`⚠️ [Processor] Provider ${provider.name} available but no suitable model found`);
        }
      }
    }
    
    if (!selectedProvider || !selectedModel) {
      console.error('❌ [Processor] No working provider/model combination found');
      throw new Error('No working provider/model combination found');
    }
    
    // Get language instruction for the prompt based on locale
    const languageInstruction = getLanguageInstruction(locale || 'en');
    
    console.log('SELECTED MODEL (scrapeCompanyInfo.generateObject):', typeof selectedModel === 'string' ? selectedModel : selectedModel);
    const { object } = await generateObject({
      model: selectedModel,
      schema: EnhancedCompanySchema,
      prompt: `Analyze this company website and extract comprehensive business information for competitor research:

      URL: ${url}
      Content: ${html}
      
      IMPORTANT LANGUAGE INSTRUCTION: 
      🌐 ALL analysis results MUST be written in ${languageInstruction} (locale: ${locale || 'en'}).
      🌐 This includes descriptions, keywords, business types, market segments, technologies, etc.
      🌐 Only the company name should remain in its original form (exact extraction).
      
      CORE COMPANY INFORMATION:
      1. Extract the COMPLETE and EXACT company name as it appears officially
      2. Write a clear, concise description of what the company does
      3. Identify relevant keywords for the business
      4. Classify the PRIMARY industry category
      5. List ACTUAL PRODUCTS/SERVICES (not categories)
      6. Extract competitor names mentioned on the site
      
      ENHANCED BUSINESS PROFILE:
      7. **Business Type**: Be very specific (e.g., "Premium electric bicycle manufacturer" not "bike company")
      8. **Market Segment**: Determine positioning (premium/luxury, mid-tier, budget, enterprise, SMB, etc.)
      9. **Target Customers**: Identify the ideal customer profile/demographic
      10. **Geographic Markets**: List primary countries/regions of operation
      11. **Technologies**: Extract relevant tech stack, methodologies, or industry technologies
      12. **Business Model**: Identify the model (B2B, B2C, SaaS, marketplace, subscription, etc.)
      
      COMPETITOR SEARCH OPTIMIZATION:
      13. **Competitor Search Keywords**: Generate 8-12 specific keywords for finding direct competitors
      14. **Alternative Search Terms**: Include synonyms and related terms for broader discovery
      
      ANALYSIS QUALITY:
      15. **Confidence Score**: Rate your confidence in the analysis (0.0-1.0)
      16. **NAICS Code**: Estimate the most appropriate industry classification code if possible
      
      INDUSTRY EXAMPLES:
      - Coolers/drinkware/outdoor equipment → "outdoor gear"
      - Web scraping/crawling/data extraction → "web scraping"
      - AI/ML models or services → "AI"
      - Hosting/deployment/cloud → "deployment"
      - E-commerce platform/store builder → "e-commerce platform"
      - Direct consumer products (clothing, etc.) → "direct-to-consumer brand"
      - Fashion/apparel/clothing → "apparel & fashion"
      - Software tools/APIs → "developer tools"
      - Marketplace/aggregator → "marketplace"
      - B2B software → "B2B SaaS"
      
      CRITICAL REQUIREMENTS:
      ✅ Company name must be EXACT (preserve ALL characters, numbers, punctuation)
      ✅ Products should be specific items, not categories
      ✅ Competitors should be full company names, not initials
      ✅ Focus on what company MAKES/SELLS, not what goes in products
      ✅ All content must be in ${languageInstruction} (locale: ${locale || 'en'})
      ✅ High accuracy - base analysis on actual website content, not assumptions
      
      EXAMPLES of correct extraction:
      - "ABC123 Solutions" → "ABC123 Solutions" (NOT "ABC Solutions")
      - "Smith & Associates LLC" → "Smith & Associates LLC" (NOT "Smith Associates")
      - "Tech-Pro Industries" → "Tech-Pro Industries" (NOT "TechPro Industries")`
    });

    // Extract favicon URL - try multiple sources
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    
    // Try to get a high-quality favicon from various sources
    const faviconUrl = metadata?.favicon || 
                      `https://www.google.com/s2/favicons?domain=${domain}&sz=128` ||
                      `${urlObj.origin}/favicon.ico`;
    
    return {
      id: crypto.randomUUID(),
      url: url,
      name: object.name,
      description: object.description,
      industry: object.industry,
      logo: metadata?.ogImage || undefined,
      favicon: faviconUrl,
      scraped: true,
      scrapedData: {
        title: object.name,
        description: object.description,
        keywords: object.keywords,
        mainContent: html || '',
        mainProducts: object.mainProducts,
        competitors: object.competitors,
        ogImage: metadata?.ogImage || undefined,
        favicon: faviconUrl,
        // Additional metadata from enhanced scraping
        ogTitle: metadata?.ogTitle,
        ogDescription: metadata?.ogDescription,
        metaKeywords: metadata?.keywords,
        rawMetadata: metadata
      },
      // Enhanced business profile data (eliminating need for company-profiler)
      businessProfile: {
        businessType: object.businessType,
        marketSegment: object.marketSegment,
        targetCustomers: object.targetCustomers,
        primaryMarkets: object.primaryMarkets,
        technologies: object.technologies,
        businessModel: object.businessModel,
        competitorSearchKeywords: object.competitorSearchKeywords,
        alternativeSearchTerms: object.alternativeSearchTerms,
        confidenceScore: object.confidenceScore,
        estimatedNAICE: object.estimatedNAICE
      },
    };
  } catch (error) {
    console.error('Error processing scraped data:', error);
    
    // Fallback: extract company name from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const companyName = domain.split('.')[0];
    const formattedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

    return {
      id: crypto.randomUUID(),
      url: url,
      name: formattedName,
      description: `Information about ${formattedName}`,
      industry: 'technology',
      scraped: false,
    };
  }
} 