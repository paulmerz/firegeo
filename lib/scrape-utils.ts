import { Company } from './types';
import FirecrawlApp from '@mendable/firecrawl-js';
import { getLanguageInstruction } from './locale-utils';
import { z } from 'zod';

// Type pour la réponse Firecrawl
interface FirecrawlResponse {
  markdown?: string;
  json?: unknown;
  error?: string;
  metadata?: {
    title?: string;
    description?: string;
    [key: string]: unknown;
  };
}

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

// Schéma Zod pour Firecrawl v2 - basé sur l'interface Company
// Note: Ce schéma est optimisé pour l'extraction de données business
// et ne correspond pas exactement à l'interface Company complète
const FirecrawlCompanySchema = z.object({
  // Core company info
  name: z.string().describe("Nom exact de l'entreprise tel qu'il apparaît officiellement"),
  description: z.string().describe("Description claire et concise de ce que fait l'entreprise"),
  keywords: z.array(z.string()).describe("Mots-clés pertinents pour le business"),
  industry: z.string().describe("Catégorie d'industrie principale"),
  mainProducts: z.array(z.string()).describe("Produits/services principaux (éléments spécifiques, pas des catégories)"),
  competitors: z.array(z.string()).optional().describe("Noms des concurrents mentionnés sur le site"),
  
  // Business profile
  businessType: z.string().describe("Type spécifique de business (ex: 'Fabricant de vélos électriques premium')"),
  marketSegment: z.string().describe("Segment de marché (premium, milieu de gamme, budget, entreprise, PME, etc.)"),
  targetCustomers: z.string().describe("Profil des clients cibles/ICP"),
  primaryMarkets: z.array(z.string()).describe("Marchés géographiques principaux/pays"),
  technologies: z.array(z.string()).describe("Technologies clés utilisées ou liées au business"),
  businessModel: z.string().describe("Modèle économique (B2B, B2C, SaaS, marketplace, abonnement, etc.)"),
  
  // Competitor search optimization
  competitorSearchKeywords: z.array(z.string()).describe("Mots-clés pour trouver des concurrents (8-12 termes spécifiques)"),
  alternativeSearchTerms: z.array(z.string()).describe("Termes alternatifs que les utilisateurs pourraient rechercher"),
  
  // Analysis metadata
  confidenceScore: z.number().min(0).max(1).describe("Score de confiance dans l'analyse (0-1)"),
  estimatedNAICE: z.string().optional().describe("Code de classification industrielle NACE/NAICS estimé")
});

// Type inféré du schéma Zod pour la validation
type FirecrawlCompanyData = z.infer<typeof FirecrawlCompanySchema>;

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
    
    // Get language instruction for the prompt based on locale
    const languageInstruction = getLanguageInstruction(locale || 'en');
    
    // Firecrawl v2 scraping with JSON extraction - retry jusqu'à 3 fois pour obtenir du JSON
    console.log(`🔍 [Scraper] Calling Firecrawl v2 API with JSON extraction...`);
    
    const maxRetries = 3;
    let lastError: string | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [Scraper] Attempt ${attempt}/${maxRetries} for JSON extraction...`);
        
        const response = await firecrawl.scrape(normalizedUrl, {
          formats: [
            'markdown',
            {
              type: 'json',
              schema: FirecrawlCompanySchema,
              prompt: `Analyse ce site web d'entreprise et extrais des informations complètes pour la recherche de concurrents.

IMPORTANT - INSTRUCTION LANGUE:
🌐 TOUS les résultats d'analyse DOIVENT être écrits en ${languageInstruction} (locale: ${locale || 'en'}).
🌐 Cela inclut les descriptions, mots-clés, types de business, segments de marché, technologies, etc.
🌐 Seul le nom de l'entreprise doit rester dans sa forme originale (extraction exacte).

INFORMATIONS CORE DE L'ENTREPRISE:
1. Extrait le nom COMPLET et EXACT de l'entreprise tel qu'il apparaît officiellement
2. Écris une description claire et concise de ce que fait l'entreprise
3. Identifie les mots-clés pertinents pour le business
4. Classifie la catégorie d'industrie PRINCIPALE
5. Liste les PRODUITS/SERVICES RÉELS (pas des catégories)
6. Extrait les noms de concurrents mentionnés sur le site

PROFIL BUSINESS AMÉLIORÉ:
7. **Type de Business**: Sois très spécifique (ex: "Fabricant de vélos électriques premium" pas "entreprise de vélos")
8. **Segment de Marché**: Détermine le positionnement (premium/luxe, milieu de gamme, budget, entreprise, PME, etc.)
9. **Clients Cibles**: Identifie le profil client idéal/démographique
10. **Marchés Géographiques**: Liste les pays/régions principaux d'opération
11. **Technologies**: Extrait la stack technique pertinente, méthodologies ou technologies industrielles
12. **Modèle Économique**: Identifie le modèle (B2B, B2C, SaaS, marketplace, abonnement, etc.)

OPTIMISATION RECHERCHE CONCURRENTS:
13. **Mots-clés Recherche Concurrents**: Génère 8-12 mots-clés spécifiques pour trouver des concurrents directs
14. **Termes de Recherche Alternatifs**: Inclus synonymes et termes liés pour découverte élargie

QUALITÉ D'ANALYSE:
15. **Score de Confiance**: Évalue ta confiance dans l'analyse (0.0-1.0)
16. **Code NAICS**: Estime le code de classification industrielle le plus approprié si possible

EXEMPLES D'INDUSTRIES:
- Glacières/équipement outdoor → "équipement outdoor"
- Web scraping/crawling/extraction données → "web scraping"
- IA/ML modèles ou services → "IA"
- Hébergement/déploiement/cloud → "déploiement"
- Plateforme e-commerce/constructeur boutique → "plateforme e-commerce"
- Produits consommateurs directs (vêtements, etc.) → "marque directe au consommateur"
- Mode/vêtements → "mode & vêtements"
- Outils logiciels/APIs → "outils développeur"
- Marketplace/agrégateur → "marketplace"
- Logiciel B2B → "B2B SaaS"

EXIGENCES CRITIQUES:
✅ Le nom de l'entreprise doit être EXACT (préserve TOUS les caractères, chiffres, ponctuation)
✅ Les produits doivent être des éléments spécifiques, pas des catégories
✅ Les concurrents doivent être des noms d'entreprises complets, pas des initiales
✅ Focus sur ce que l'entreprise FABRIQUE/VEND, pas ce qui va dans les produits
✅ Tout le contenu doit être en ${languageInstruction} (locale: ${locale || 'en'})
✅ Haute précision - base l'analyse sur le contenu réel du site, pas des suppositions`
            } as Record<string, unknown> // Type assertion nécessaire car Firecrawl v2 accepte des schémas Zod mais les types ne sont pas encore à jour
          ],
          maxAge: cacheAge,
          onlyMainContent: true,
          waitFor: attempt === 1 ? 3000 : 5000, // Plus de temps pour les retries
          timeout: attempt === 1 ? 30000 : 45000, // Plus de timeout pour les retries
          includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p'],
          excludeTags: ['script', 'style', 'aside', 'iframe', 'video']
        });
        
        console.log(`🔍 [Scraper] Firecrawl response received (attempt ${attempt}):`, {
          hasMarkdown: 'markdown' in response && !!(response as FirecrawlResponse).markdown,
          hasJson: 'json' in response && !!(response as FirecrawlResponse).json,
          markdownLength: (response as FirecrawlResponse).markdown ? (response as FirecrawlResponse).markdown!.length : 0,
          hasError: 'error' in response && !!(response as FirecrawlResponse).error
        });
        
        // Check for errors in the response
        const hasError = 'error' in response && !!(response as FirecrawlResponse).error;
        if (hasError) {
          const errorMessage = (response as FirecrawlResponse).error;
          lastError = errorMessage;
          console.warn(`⚠️ [Scraper] Error in attempt ${attempt}: ${errorMessage}`);
          
          // Si c'est le dernier essai, on lance l'erreur
          if (attempt === maxRetries) {
            throw new Error(`Scraping failed after ${maxRetries} attempts: ${errorMessage}`);
          }
          
          // Attendre avant le prochain essai
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        
        // Vérifier si on a du JSON
        if ((response as FirecrawlResponse).json) {
          console.log(`✅ [Scraper] JSON extraction successful on attempt ${attempt}`);
          const markdownContent = (response as FirecrawlResponse).markdown || '';
          return processJsonExtraction((response as FirecrawlResponse).json!, response.metadata, normalizedUrl, locale, markdownContent);
        } else {
          console.warn(`⚠️ [Scraper] No JSON data in response for attempt ${attempt}`);
          lastError = 'No JSON data returned';
          
          // Si c'est le dernier essai, on lance l'erreur
          if (attempt === maxRetries) {
            throw new Error(`No JSON data returned after ${maxRetries} attempts`);
          }
          
          // Attendre avant le prochain essai
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ [Scraper] Exception in attempt ${attempt}: ${lastError}`);
        
        // Si c'est le dernier essai, on lance l'erreur
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Attendre avant le prochain essai
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
    
    // Cette ligne ne devrait jamais être atteinte, mais au cas où
    throw new Error(`Scraping failed after ${maxRetries} attempts. Last error: ${lastError}`);
  } catch (error) {
    console.error('Error scraping company info:', error);
    throw error;
  }
}

interface FirecrawlPage {
  path?: string;
  url?: string;
  markdown?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

interface FirecrawlCrawlResult {
  success?: boolean;
  data?: FirecrawlPage[];
  pages?: FirecrawlPage[];
  jobId?: string;
  id?: string;
  error?: string;
  completed?: boolean;
  status?: string;
}

interface FirecrawlCrawlOptions {
  maxDepth?: number;
  limit?: number;
  allowExternalLinks?: boolean;
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
    if (!process.env.FIRECRAWL_API_KEY) {
      console.error('❌ [Crawler] FIRECRAWL_API_KEY not configured');
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    // Crawl parameters tuned for business comprehension
    const crawlOptions: FirecrawlCrawlOptions = {
      maxDepth: 2,
      limit: 20,
      allowExternalLinks: false,
      // Keep options minimal to satisfy v1 API; advanced filters removed
    };

    console.log('🕷️ [Crawler] Calling Firecrawl crawlUrl with options:', crawlOptions);
    const result: FirecrawlCrawlResult = await (firecrawl as unknown as { crawlUrl: (url: string, options: unknown) => Promise<FirecrawlCrawlResult> }).crawlUrl(normalizedUrl, crawlOptions);
    if (!result) {
      throw new Error('Crawl returned empty result');
    }

    // Some SDK versions return a job id and require polling
    let pages: FirecrawlPage[] = [];
    if (result?.success && result.data && Array.isArray(result.data)) {
      // Direct pages array
      pages = result.data.filter(Boolean);
    } else if (Array.isArray(result.pages)) {
      pages = result.pages.filter(Boolean);
    } else {
      const jobId = result.jobId || result.id || (result as { data?: { id?: string } }).data?.id;
      if (!jobId && result?.error) {
        throw new Error(result.error);
      }
      if (jobId) {
        console.log(`🕷️ [Crawler] Received job id: ${jobId}. Polling status...`);
        const startedAt = Date.now();
        const timeoutMs = 45000;
        while (Date.now() - startedAt < timeoutMs) {
          await new Promise(r => setTimeout(r, 1000));
          let statusResp: FirecrawlCrawlResult | null = null;
          try {
            // Try both method names for compatibility
            const checker = (firecrawl as unknown as { checkCrawlStatus?: (id: string) => Promise<FirecrawlCrawlResult>; getCrawlStatus?: (id: string) => Promise<FirecrawlCrawlResult> }).checkCrawlStatus || (firecrawl as unknown as { checkCrawlStatus?: (id: string) => Promise<FirecrawlCrawlResult>; getCrawlStatus?: (id: string) => Promise<FirecrawlCrawlResult> }).getCrawlStatus;
            if (typeof checker === 'function') {
              statusResp = await checker.call(firecrawl, jobId) as FirecrawlCrawlResult;
            }
          } catch (e) {
            console.warn('🕷️ [Crawler] Status polling error (non-fatal):', e);
          }

          const statusObj: FirecrawlCrawlResult = statusResp || {};
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

      return processScrapedDataFallback(combinedMarkdown, homepageMeta, normalizedUrl, locale);
  } catch (error) {
    console.error('Error crawling company info:', error);
    // Fallback to single page scrape
    return scrapeCompanyInfo(url, maxAge, locale);
  }
}

/**
 * Process JSON extraction from Firecrawl - plus rapide et économique !
 * Utilise la validation Zod pour s'assurer de la conformité des données
 */
function processJsonExtraction(jsonData: FirecrawlCompanyData, metadata: Record<string, unknown> | undefined, url: string, locale?: string, markdownContent?: string): Company {
  try {
    console.log(`🔍 [Processor] Processing JSON extraction for URL: ${url}`);
    console.log(`🔍 [Processor] Raw JSON data:`, jsonData);
    
    // Les données sont déjà typées comme FirecrawlCompanyData
    // Pas besoin de validation Zod supplémentaire ici
    const validatedData = jsonData;
    console.log(`✅ [Processor] JSON data is properly typed`);
    
    // Extract favicon URL - try multiple sources
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    
    const faviconUrl = metadata?.favicon as string ||
                      `https://www.google.com/s2/favicons?domain=${domain}&sz=128` ||
                      `${urlObj.origin}/favicon.ico`;
    
    return {
      id: crypto.randomUUID(),
      url: url,
      originalUrl: url,
      name: validatedData.name,
      description: validatedData.description,
      industry: validatedData.industry,
      logo: metadata?.ogImage as string || undefined,
      favicon: faviconUrl,
      scraped: true,
      scrapedData: {
        title: validatedData.name,
        description: validatedData.description,
        keywords: validatedData.keywords,
        mainContent: markdownContent || '', // Utilise le contenu markdown si disponible
        mainProducts: validatedData.mainProducts,
        competitors: validatedData.competitors || [],
        ogImage: metadata?.ogImage as string || undefined,
        favicon: faviconUrl,
        ogTitle: metadata?.ogTitle as string,
        ogDescription: metadata?.ogDescription as string,
        metaKeywords: metadata?.keywords as string[],
        rawMetadata: metadata
      },
      businessProfile: {
        businessType: validatedData.businessType,
        marketSegment: validatedData.marketSegment,
        targetCustomers: validatedData.targetCustomers,
        primaryMarkets: validatedData.primaryMarkets,
        technologies: validatedData.technologies,
        businessModel: validatedData.businessModel,
        confidenceScore: validatedData.confidenceScore,
      },
    };
  } catch (error) {
    console.error('Error processing JSON extraction:', error);
    
    // En cas d'erreur, on peut essayer de récupérer les données de base
    console.warn('⚠️ [Processor] Processing failed, attempting fallback extraction');
    return processJsonExtractionFallback(jsonData as unknown, metadata, url, locale, markdownContent);
  }
}

/**
 * Fallback pour l'extraction JSON en cas d'échec de validation Zod
 */
function processJsonExtractionFallback(jsonData: unknown, metadata: Record<string, unknown> | undefined, url: string, locale?: string, markdownContent?: string): Company {
  try {
    console.log(`🔍 [Processor] Processing JSON extraction fallback for URL: ${url}`);
    
    // Extraction basique sans validation stricte
    const data = jsonData as Record<string, unknown>;
    
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const faviconUrl = metadata?.favicon as string ||
                      `https://www.google.com/s2/favicons?domain=${domain}&sz=128` ||
                      `${urlObj.origin}/favicon.ico`;
    
    return {
      id: crypto.randomUUID(),
      url: url,
      originalUrl: url,
      name: (data.name as string) || 'Unknown Company',
      description: (data.description as string) || '',
      industry: (data.industry as string) || 'technology',
      logo: metadata?.ogImage as string || undefined,
      favicon: faviconUrl,
      scraped: true,
      scrapedData: {
        title: (data.name as string) || 'Unknown Company',
        description: (data.description as string) || '',
        keywords: (data.keywords as string[]) || [],
        mainContent: markdownContent || '',
        mainProducts: (data.mainProducts as string[]) || [],
        competitors: (data.competitors as string[]) || [],
        ogImage: metadata?.ogImage as string || undefined,
        favicon: faviconUrl,
        ogTitle: metadata?.ogTitle as string,
        ogDescription: metadata?.ogDescription as string,
        metaKeywords: metadata?.keywords as string[],
        rawMetadata: metadata
      },
      businessProfile: {
        businessType: (data.businessType as string) || 'Unknown',
        marketSegment: (data.marketSegment as string) || 'Unknown',
        targetCustomers: (data.targetCustomers as string) || 'Unknown',
        primaryMarkets: (data.primaryMarkets as string[]) || ['Unknown'],
        technologies: (data.technologies as string[]) || [],
        businessModel: (data.businessModel as string) || 'Unknown',
        confidenceScore: (data.confidenceScore as number) || 0.3,
      },
    };
  } catch (error) {
    console.error('Error in JSON extraction fallback:', error);
    throw error;
  }
}

/**
 * Process scraped data and extract structured information (fallback method)
 */
async function processScrapedDataFallback(markdown: string, metadata: Record<string, unknown> | undefined, url: string): Promise<Company> {
  try {
    console.log(`🔍 [Processor] Processing scraped data fallback for URL: ${url}`);
    
    // Simple fallback: extract basic info from metadata and URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const companyName = metadata?.title as string || 
                       metadata?.ogTitle as string || 
                       domain.split('.')[0];
    const formattedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
    
    const faviconUrl = metadata?.favicon as string ||
                      `https://www.google.com/s2/favicons?domain=${domain}&sz=128` ||
                      `${urlObj.origin}/favicon.ico`;
    
    return {
      id: crypto.randomUUID(),
      url: url,
      originalUrl: url,
      name: formattedName,
      description: metadata?.description as string || 
                  metadata?.ogDescription as string || 
                  `Information about ${formattedName}`,
      industry: 'technology',
      logo: metadata?.ogImage as string || undefined,
      favicon: faviconUrl,
      scraped: true,
      scrapedData: {
        title: formattedName,
        description: metadata?.description as string || '',
        keywords: [],
        mainContent: markdown || '',
        mainProducts: [],
        competitors: [],
        ogImage: metadata?.ogImage as string || undefined,
        favicon: faviconUrl,
        ogTitle: metadata?.ogTitle as string,
        ogDescription: metadata?.ogDescription as string,
        metaKeywords: metadata?.keywords as string[],
        rawMetadata: metadata
      },
      businessProfile: {
        businessType: 'Technology company',
        marketSegment: 'Unknown',
        targetCustomers: 'Unknown',
        primaryMarkets: ['Unknown'],
        technologies: [],
        businessModel: 'Unknown',
        confidenceScore: 0.3, // Low confidence for fallback
      },
    };
  } catch (error) {
    console.error('Error processing scraped data fallback:', error);
    
    // Ultimate fallback: extract company name from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const companyName = domain.split('.')[0];
    const formattedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

    return {
      id: crypto.randomUUID(),
      url: url,
      originalUrl: url,
      name: formattedName,
      description: `Information about ${formattedName}`,
      industry: 'technology',
      scraped: false,
    };
  }
}