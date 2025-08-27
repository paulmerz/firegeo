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
    // Ensure URL has protocol
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    // Default to 1 week cache if not specified
    const cacheAge = maxAge ? Math.floor(maxAge / 1000) : 604800; // 1 week in seconds
    
    // Optimized Firecrawl scraping with enhanced parameters
    // Combines the best settings from both scrapeCompanyInfo and scrapeCompanyWithFirecrawl
    const response = await firecrawl.scrapeUrl(normalizedUrl, {
      formats: ['markdown'],
      maxAge: cacheAge,
      onlyMainContent: true, // Focus on main content to reduce complexity
      waitFor: 3000, // Wait 3 seconds for page load (robust setting)
      timeout: 20000, // 20 seconds timeout (increased from default)
      includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p'], // Focused tags for better extraction
      excludeTags: ['script', 'style', 'nav', 'footer', 'aside', 'iframe', 'video'] // Comprehensive exclusions
    });
    if (!response.success) {
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
        
        return processScrapedData(retryResponse.markdown || '', retryResponse.metadata, normalizedUrl, locale);
      }
      
      throw new Error(response.error);
    }
    return processScrapedData(response.markdown || '', response.metadata, normalizedUrl, locale);
  } catch (error) {
    console.error('Error scraping company info:', error);
    throw error;
  }
}

/**
 * Process scraped data and extract structured information
 */
async function processScrapedData(markdown: string, metadata: any, url: string, locale?: string): Promise<any> {
  try {
    const html = markdown;
    
    // Use AI to extract structured information - use first available provider
    const configuredProviders = getConfiguredProviders();
    if (configuredProviders.length === 0) {
      throw new Error('No AI providers configured and enabled for content extraction');
    }
    
    // Use the first available provider with a fast model
    const provider = configuredProviders[0];
    const model = getProviderModel(provider.id, provider.models.find(m => m.name.toLowerCase().includes('mini') || m.name.toLowerCase().includes('flash'))?.id || provider.defaultModel);
    if (!model) {
      throw new Error(`${provider.name} model not available`);
    }
    
    // Get language instruction for the prompt based on locale
    const languageInstruction = getLanguageInstruction(locale || 'en');
    
    const { object } = await generateObject({
      model,
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