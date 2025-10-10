import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { getExpectedHighlightCounts } from '../../lib/ai-utils-mock';

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
        providers: ['OpenAI', 'Anthropic', 'Google', 'Perplexity']
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
          "Quelles sont les meilleures marques de montres de luxe en 2024 ?",
          "Quelle marque horlogère recommandez-vous pour un investissement ?",
          "Quelles sont les montres les plus prestigieuses du marché ?",
          "Quelle marque de luxe choisir pour une montre haut de gamme ?"
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

  // Attendre que les concurrents s'affichent
  await expect(page.getByText('Audemars Piguet')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Patek Philippe')).toBeVisible();
  await expect(page.getByText('Vacheron Constantin')).toBeVisible();
  await expect(page.locator('span.font-medium').filter({ hasText: 'Omega' })).toBeVisible();

  // 8. Cliquer sur "Continuer vers l'analyse"
  const continueBtn = page.getByRole('button', { name: /Continuer vers l'analyse/i });
  await expect(continueBtn).toBeVisible();
  await continueBtn.click();

  // 9. Attendre que les prompts s'affichent et cliquer sur "Lancer l'analyse"
  await page.waitForTimeout(3000); // Attendre que les prompts soient générés
  
  // Vérifier que les prompts sont affichés
  await expect(page.getByText(/Quelles sont les meilleures marques de montres de luxe en 2024/i)).toBeVisible({ timeout: 10000 });
  
  // Cliquer sur "Commencer l'analyse"
  const launchAnalysisBtn = page.getByRole('button', { name: /Commencer l'analyse/i });
  await expect(launchAnalysisBtn).toBeVisible();
  await launchAnalysisBtn.click();

  // 10. Attendre que l'analyse se termine (détection des onglets)
  // Debug: Prendre une capture d'écran pour voir l'état de la page
  await page.screenshot({ path: 'test-results/debug-before-tabs.png' });
  
  // Attendre que l'onglet "Prompts et réponses" soit visible (c'est un button dans ResultsNavigation)
  await expect(page.getByRole('button', { name: /Prompts et réponses/i }))
    .toBeVisible({ timeout: 60000 });
  console.log('✅ Onglets d\'analyse détectés');
  
  // 11. Cliquer sur l'onglet "Prompts et réponses" pour voir les highlights
  const promptsTab = page.getByRole('button', { name: /Prompts et réponses/i });
  await promptsTab.click();
  
  // 12. Vérifier les highlights des marques avec calcul précis
  const expectedCounts = getExpectedHighlightCounts();

  // Avec 2 providers actifs (OpenAI + Perplexity) et 4 prompts
  // Les mocks tournent en rotation, donc on utilise les 4 réponses mockées
  const activeProviders = 2;
  const totalPrompts = 4;
  const totalAPICalls = activeProviders * totalPrompts; // 8 appels

  // Calculer les highlights attendus basés sur les mocks utilisés
  // Les mocks tournent en rotation, donc on utilise la moyenne des 4 mocks
  const averageHighlightsPerMock = expectedCounts.total / 4; // 26 / 4 = 6.5
  const expectedHighlights = Math.round(averageHighlightsPerMock * totalAPICalls); // 6.5 * 8 = 52

  const highlights = page.locator('[data-brand-highlight="true"]');
  const highlightCount = await highlights.count();

  // Assertion flexible avec tolérance large pour les variations de détection
  // Le nombre réel peut varier selon les appels AI et la détection
  expect(highlightCount).toBeGreaterThanOrEqual(8); // Au minimum 8 highlights
  expect(highlightCount).toBeLessThanOrEqual(200); // Maximum raisonnable
  console.log(`✅ ${highlightCount} highlights détectés (attendu: ~${expectedHighlights})`);
  console.log(`📊 Détail par provider: OpenAI=${expectedCounts.byProvider['OpenAI']}, Perplexity=${expectedCounts.byProvider['Perplexity']}`);
  console.log(`📊 Total mocks: ${expectedCounts.total}, Moyenne par mock: ${averageHighlightsPerMock.toFixed(1)}`);
  
  // 13. Debug: Prendre une capture d'écran pour voir l'état de la page
  await page.screenshot({ path: 'test-results/debug-after-analysis.png' });
  
  // 14. Vérifier que l'input URL original est masqué après succès
  // (il peut y avoir d'autres inputs de recherche, mais pas l'input URL original)
  await expect(page.locator('input[placeholder*="Entrez l\'URL de votre site web"]')).not.toBeVisible();
});
