import { test as base, expect, Page } from '@playwright/test';
import type { MockMode } from '@/lib/types';
import { getExpectedHighlightCount, getExpectedCompetitorHighlightCount, getExpectedTargetHighlightCount } from '../../lib/ai-utils-mock';

const test = base.extend<{ mockMode: MockMode }>({
  mockMode: ['raw', { scope: 'test', option: true }],
  context: async ({ context, mockMode }, use) => {
    await context.setExtraHTTPHeaders({ 'x-mock-mode': mockMode });
    await use(context);
  }
});
import path from 'path';

type LocaleType = 'fr' | 'en' | 'de' | 'fr-CH' | 'de-CH';

// Helper pour charger les fixtures mockées
async function loadMockFixtures() {
  const companyData = await import('../fixtures/brand-monitor/company.json', { with: { type: 'json' } });
  return {
    company: companyData.default || companyData,
  };
}

async function registerAndLogin(page: Page, locale: LocaleType) {
  const email = `test+${Date.now()}@test.com`;
  const password = 'test1234';

  await page.goto(`/${locale}/register`);
  await page.locator('#name').fill('Test User');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#terms').check();
  await page.getByRole('button', { name: /créer un compte|créer|s'inscrire|create account|sign up/i }).click();
  await expect(page.getByRole('button', { name: /déconnexion|logout/i })).toBeVisible({ timeout: 20000 });
  return { email, password };
}

async function getNavbarCredits(page: Page): Promise<number> {
  const creditsLabel = page.getByText(/crédits/i).first();
  try {
    await expect(creditsLabel).toBeVisible({ timeout: 20000 });
  } catch {
    test.skip(true, 'Crédits non affichés (AUTUMN non configuré). Configurez AUTUMN_SECRET_KEY pour activer cette vérification.');
  }
  const balanceText = await creditsLabel.evaluate((el) => {
    const parent = el.parentElement;
    if (!parent) return null;
    const firstSpan = parent.querySelector('span');
    return firstSpan?.textContent?.trim() || null;
  });
  const value = balanceText ? parseInt(balanceText, 10) : NaN;
  return value;
}

test('brand-monitor avec mocks AI', async ({ page }) => {
  // Le mode mock est activé via MOCK_AI_FUNCTIONS=true dans .env.local
  // Ajoutez cette ligne dans votre fichier .env.local :
  // MOCK_AI_FUNCTIONS=true

  // Charger les fixtures mockées
  const mockData = await loadMockFixtures();
  
  // Se connecter
  await registerAndLogin(page, 'fr');
  
  // Intercepter les routes API avec les données mockées
  // Forcer mockMode=raw pour l'endpoint SSE d'analyse
  await page.route('**/api/brand-monitor/analyze**', async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('mockMode', 'raw');
    await route.continue({ url: url.toString() });
  });

  await page.route('**/api/brand-monitor/scrape', async route => {
    console.log('🔍 Intercepting /api/brand-monitor/scrape');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        company: mockData.company
      })
    });
  });

  // Intercepter le débit de crédits (simuler succès)
  await page.route('**/api/credits', async route => {
    const requestBody = route.request().postDataJSON();
    console.log('💰 Intercepting /api/credits with reason:', requestBody?.reason);
    if (requestBody?.reason === 'scrape_success') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 99,
          success: true
        })
      });
    } else if (requestBody?.reason === 'prompts_analysis') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 95, // Débit de 4 crédits pour les prompts
          success: true
        })
      });
    } else if (requestBody?.reason === 'prompts_display') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 98, // Débit de 1 crédit pour la génération des prompts
          success: true
        })
      });
    } else {
      await route.continue();
    }
  });

  // Intercepter la vérification des providers
  await page.route('**/api/brand-monitor/check-providers', async route => {
    console.log('🔧 Intercepting /api/brand-monitor/check-providers');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: ['OpenAI', 'Perplexity']
      })
    });
  });

  // Intercepter l'identification des concurrents
  await page.route('**/api/competitors/ai-search', async route => {
    console.log('🏢 Intercepting /api/competitors/ai-search');
    const competitorsData = await import('../fixtures/brand-monitor/competitors.json', { with: { type: 'json' } });
    const competitors = competitorsData.default || competitorsData;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        competitors: competitors.map((comp: any) => ({
          name: comp.name,
          url: comp.url
        })),
        rawResults: competitors,
        method: 'perplexity-ai-search',
        model: 'sonar-pro',
        stats: {
          candidatesFound: competitors.length,
          finalCompetitors: competitors.length,
          processingTimeMs: 1000
        }
      })
    });
  });

  // Intercepter la génération des prompts
  await page.route('**/api/generate-prompts', async route => {
    console.log('📝 Intercepting /api/generate-prompts');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        prompts: [
          // ranking (explicit token)
          "Top 10 des marques de montres de luxe (classement 2024) KEYWORD_RANKING",
          // comparison (explicit token)
          "Compare Rolex vs Patek Philippe: avantages et inconvénients KEYWORD_COMPARISON",
          // alternatives (explicit token)
          "Alternatives à Rolex: quelles marques similaires considérer ? KEYWORD_ALTERNATIVES",
          // recommendations (explicit token)
          "Which brand would you recommend for a long-term investment? KEYWORD_RECOMMENDATIONS"
        ],
        success: true
      })
    });
  });

  // Pas d'interception SSE - laisser le backend gérer l'analyse avec les mocks AI

  // Naviguer vers brand-monitor
  await page.goto('/fr/brand-monitor');
  await expect(page).toHaveURL(/\/fr\/brand-monitor/);

  // 1. Vérifier que l'input URL est présent et fonctionnel
  const urlInput = page.locator('input[type="text"]').first();
  await expect(urlInput).toBeVisible();
  await expect(urlInput).toHaveAttribute('placeholder', /Entrez l'URL de votre site web/i);

  // 2. Tester validation URL invalide
  await urlInput.fill('not_a_url');
  await urlInput.press('Enter');
  await expect(page.getByText(/Veuillez entrer une URL valide/i)).toBeVisible({ timeout: 10000 });

  // 3. Tester avec URL mockée valide
  await urlInput.fill('https://mockedData.com');
  
  // Vérifier que le bouton d'analyse est activé
  const analyzeBtn = page.getByRole('button', { name: /Analyser le site web/i });
  await expect(analyzeBtn).toBeEnabled();

  // 4. Soumettre l'URL et vérifier le flux
  await page.waitForTimeout(2000);
  await analyzeBtn.click();

  // 5. Vérifier que la CompanyCard s'affiche avec les données Rolex mockées
  await expect(page.getByRole('heading', { name: 'Rolex' })).toBeVisible({ timeout: 10000 });
  
  // Vérifier les détails de l'entreprise mockée (seulement ceux affichés)
  await expect(page.getByText('Horlogerie de luxe')).toBeVisible();
  await expect(page.getByText(/Rolex est une marque suisse de montres de luxe fondée en 1905/i)).toBeVisible();
  
  // Vérifier l'URL mockée dans le badge
  await expect(page.getByText('mockedData.com')).toBeVisible();
  
  // Vérifier les keywords scrapées (badges spécifiques)
  await expect(page.locator('span.bg-gray-100').filter({ hasText: 'montres de luxe' })).toBeVisible();
  await expect(page.locator('span.bg-gray-100').filter({ hasText: 'horlogerie suisse' })).toBeVisible();

  // 6. Vérifier le bouton "Identifier les Concurrents" est présent
  await expect(page.getByRole('button', { name: /Identifier les Concurrents/i })).toBeVisible();

  // 7. Cliquer sur "Identifier les Concurrents" et vérifier l'affichage
  const identifyBtn = page.getByRole('button', { name: /Identifier les Concurrents/i });
  await identifyBtn.click();

  // Attendre que les concurrents s'affichent (échantillon des nouveaux concurrents)
  await expect(page.getByText('Caterham Cars')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Grand Seiko')).toBeVisible();
  await expect(page.getByText('Yves Saint Laurent')).toBeVisible();

  // 8. Cliquer sur "Continuer vers l'analyse"
  const continueBtn = page.getByRole('button', { name: /Continuer vers l'analyse/i });
  await expect(continueBtn).toBeVisible();
  await continueBtn.click();
  
  // Vérifier qu'au moins un prompt (token) est affiché
  await expect(page.getByText(/KEYWORD_RANKING/i)).toBeVisible({ timeout: 10000 });
  
  // Cliquer sur "Commencer l'analyse"
  const launchAnalysisBtn = page.getByRole('button', { name: /Commencer l'analyse/i });
  await expect(launchAnalysisBtn).toBeVisible();
  await launchAnalysisBtn.click();

  // 10. Attendre que l'analyse se termine (détection des onglets)
  // Debug: Prendre une capture d'écran pour voir l'état de la page
  await page.screenshot({ path: 'test-results/debug-before-tabs.png' });
  
  // Attendre que l'onglet "Prompts et réponses" soit visible (c'est un button dans ResultsNavigation)
  await expect(page.getByRole('button', { name: /Prompts et réponses/i }))
    .toBeVisible({ timeout: 120000 });
  console.log('✅ Onglets d\'analyse détectés');
  
  // 11. Cliquer sur l'onglet "Prompts et réponses" pour voir les highlights
  const promptsTab = page.getByRole('button', { name: /Prompts et réponses/i });
  await promptsTab.click();

  
  // 12. Vérifier les highlights des marques générés dynamiquement par l'IA
  const allHighlights = page.locator('[data-brand-highlight="true"]');
  const highlightCount = await allHighlights.count();

  // Récupérer les nombres attendus
  const expectedTotal = getExpectedHighlightCount();
  const expectedGrey = getExpectedCompetitorHighlightCount();
  const expectedOrange = getExpectedTargetHighlightCount();

  console.log(`📊 Highlights: total attendu=${expectedTotal}, détecté=${highlightCount}`);

  // Compter par classes
  const greyHighlights = page.locator('[data-brand-highlight="true"].bg-gray-200');
  const orangeHighlights = page.locator('[data-brand-highlight="true"].bg-orange-100');
  const greyCount = await greyHighlights.count();
  const orangeCount = await orangeHighlights.count();

  // Vérification fine attendus/interdits par prompt
  function norm(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function multiset(arr: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const s of arr) m.set(s, (m.get(s) || 0) + 1);
    return m;
  }

  const expectedBrandsData = await import('../fixtures/brand-monitor/expected-brands.json', { with: { type: 'json' } });
  const expectedBrands = expectedBrandsData.default || expectedBrandsData;

  // Charger les scores attendus (mentions, pourcentage)
  const expectedScoresData = await import('../fixtures/brand-monitor/expected-scores.json', { with: { type: 'json' } });
  const expectedScores = (expectedScoresData as any).default || expectedScoresData;

  // Récupérer tous les textes surlignés
  const highlightedTexts = (await allHighlights.allTextContents()).map(norm);
  const highlightedMulti = multiset(highlightedTexts);

  // Construire les listes attendues et interdites pour les 4 prompts
  const expectedPositives = [
    ...expectedBrands.expectedPositiveByPrompt.ranking,
    ...expectedBrands.expectedPositiveByPrompt.comparison,
    ...expectedBrands.expectedPositiveByPrompt.alternatives,
    ...expectedBrands.expectedPositiveByPrompt.recommendations
  ].map(norm);

  const forbidden = [
    ...expectedBrands.forbiddenByPrompt.ranking,
    ...expectedBrands.forbiddenByPrompt.comparison,
    ...expectedBrands.forbiddenByPrompt.alternatives,
    ...expectedBrands.forbiddenByPrompt.recommendations
  ].map(norm);

  // Vérifier que chaque attendu est présent au moins une fois
  for (const s of expectedPositives) {
    const c = highlightedMulti.get(s) || 0;
    expect(c, `Manquant (non surligné): ${s}`).toBeGreaterThan(0);
  }

  // Vérifier qu'aucun interdit n'est surligné
  for (const s of forbidden) {
    const c = highlightedMulti.get(s) || 0;
    expect(c, `Faux positif détecté: ${s}`).toBe(0);
  }

  
  // Afficher tous les highlights détectés pour debug
  const allNodes = await allHighlights.all();
  console.log(`🔍 Détail des ${allNodes.length} highlights trouvés:`);
  for (let i = 0; i < Math.min(allNodes.length, 20); i++) {
    const text = await allNodes[i].textContent();
    const className = await allNodes[i].getAttribute('class');
    console.log(`  ${i + 1}. "${text}" (class: ${className})`);
  }
  if (allNodes.length > 20) {
    console.log(`  ... et ${allNodes.length - 20} autres`);
  }
  expect(greyCount).toBe(expectedGrey);
  expect(orangeCount).toBe(expectedOrange);
  expect(highlightCount).toBe(expectedTotal);

  // Cliquer sur l'onglet "Prompts et réponses" pour voir les highlights
  const scoreTab = page.getByRole('button', { name: /Score de visibilité/i });
  await scoreTab.click();
  
  // Vérifier que le pourcentage attendu est visible dans l'UI
  const pct = expectedScores.expectedScores.percentage;
  await expect(page.getByText(new RegExp(`\\b${pct}\\s*%\\b`, 'i'))).toBeVisible();
  
  // Vérifier chaque ligne de marque avec 25%
  const brands = [
    expectedScores.targetBrand,
    ...expectedScores.expectedCompetitors
  ];
  for (const brandName of brands) {
    // Chercher la marque et le pourcentage dans des éléments adjacents
    // Utiliser .first() pour éviter les violations de mode strict quand il y a plusieurs éléments
    const brandElement = page.getByText(brandName).first();
    const percentageElement = page.getByText(`${pct}%`).first();
    
    // Vérifier que les deux éléments sont visibles
    await expect(brandElement).toBeVisible();
    await expect(percentageElement).toBeVisible();
  }

  // Vérifier l’indicateur de rang #1
  await expect(page.getByText(/#1\s*Rang/i)).toBeVisible();

  // Vérifier que le nombre d'occurrences de la marque cible correspond aux mentions attendues
  expect(orangeCount).toBe(expectedScores.expectedScores.mentions);
  
  // 13. Debug: Prendre une capture d'écran pour voir l'état de la page
  await page.screenshot({ path: 'test-results/debug-after-analysis.png' });
  
  // 14. Vérifier que l'input URL original est masqué après succès
  // (il peut y avoir d'autres inputs de recherche, mais pas l'input URL original)
  await expect(page.locator('input[placeholder*="Entrez l\'URL de votre site web"]')).not.toBeVisible();
});
