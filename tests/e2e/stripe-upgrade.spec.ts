import { test, expect, Page } from '@playwright/test';

type LocaleType = 'fr' | 'en' | 'de' | 'fr-CH' | 'de-CH';

function cleanPrice(raw: string): number {
  const trimmed = raw.trim();
  // Supprime symbole €, espaces normaux et insécables, remplace la virgule par un point
  const normalized = trimmed.replace(/[€\s\u00A0\u202F]/g, '').replace(',', '.');
  const match = normalized.match(/\d+(?:\.\d{2})?/);
  if (!match) {
    throw new Error(`Invalid price string: "${raw}"`);
  }
  return Number(match[0]);
}

function cleanCredits(raw: string): number {
  const normalized = raw.trim().replace(/[\u00A0\u202F]/g, ' ');
  const match = normalized.match(/\d+/);
  if (!match) throw new Error(`Invalid credits string: "${raw}"`);
  return Number(match[0]);
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

// Helpers pour interagir avec Stripe Checkout en tant que page hébergée (redirection)
async function completeStripeCheckoutIfPresent(page: Page) {
  // Attendre la redirection vers Stripe Checkout
  try {
    await expect.poll(async () => page.url(), { timeout: 100000, intervals: [500, 1000, 3000, 5000] })
      .toContain('checkout.stripe.com');
  } catch {
    // Pas de redirection effective (environnement sans Stripe). On quitte sans erreur.
    return false;
  }
  
  await page.waitForTimeout(1000);
  // Remplir les champs visibles directement sur la page Checkout (sans iframe)
  // Les placeholders/libellés sont inspirés de la doc/démo Checkout.
  // S’assurer que le moyen de paiement "Carte" est sélectionné (accordéon)
  const cardAccordion = page.locator('[data-testid="card-accordion-item"]').first();
  if (await cardAccordion.count()) {
    // Ouvrir l'accordéon si nécessaire (simple clic idempotent)
    await cardAccordion.click();
  }

  const nameField = page.getByLabel(/Name on card|Name|Nom du titulaire|Nom complet/i).or(page.locator('input[name="name"]'));
  await expect(nameField, 'Champ "Nom du titulaire" introuvable sur Checkout').toBeVisible({ timeout: 30000 });
  await nameField.fill('Zoro');

  const cardField = page.locator('[placeholder="1234 1234 1234 1234"]').first()
    .or(page.locator('[placeholder="1234 1234 1234"]').first());
  await expect(cardField, 'Champ carte "1234 1234 1234 1234" introuvable sur Checkout').toBeVisible({ timeout: 30000 });
  await cardField.fill('4242 4242 4242 4242');
  // Variantes de placeholder d’expiration (FR/EN)
  const expField = page.locator('[placeholder="MM / AA"]').first()
    .or(page.locator('[placeholder="MM / YY"]').first())
    .or(page.locator('[placeholder="MM/AA"]').first())
    .or(page.locator('[placeholder="MM/YY"]').first());
  await expect(expField, 'Champ expiration (MM/AA ou MM/YY) introuvable sur Checkout').toBeVisible({ timeout: 30000 });
  await expField.fill('01/35');
  const cvcField = page.locator('[placeholder="CVC"]').first();
  await expect(cvcField, 'Champ CVC introuvable sur Checkout').toBeVisible({ timeout: 30000 });
  await cvcField.fill('123');

  // Adresse de facturation améliorée
  await page.getByLabel('Pays ou région').selectOption('FR');
  await page.getByRole('button', { name: 'Saisir l\'adresse manuellement' }).click();
  await page.getByRole('textbox', { name: 'Ligne d\'adresse n°1' }).fill('Avenue des Champs-Elysées 11');
  await page.getByRole('textbox', { name: 'Code postal' }).fill('75008');
  await page.getByRole('textbox', { name: 'Ville' }).fill('Paris');

  // Bouton payer: préférer le bouton ARIA "Payer et s'abonner", puis fallback testId, puis conteneur texte
  const payBtnByRole = page.getByRole('button', { name: /S'abonner/i }).first();
  await page.waitForTimeout(12000);
  await payBtnByRole.click();
  await expect.poll(async () => page.url(), { timeout: 150000, intervals: [500, 1000, 2500, 5000] })
    .not.toContain('checkout.stripe.com');
  return true;
}


test('Upgrade de plan: Start puis Watch via Stripe', async ({ page }) => {
  test.setTimeout(200000); // 200 secondes pour permettre le poll de 150s
  await registerAndLogin(page, 'fr');

  // Naviguer dashboard
  await page.goto('/fr/dashboard');
  await expect(page).toHaveURL(/\/fr\/dashboard/);

  // Carte Start: structure spécifique
  const startCard = page
    .locator('div.bg-white.rounded-\\[20px\\].shadow-sm.border.p-6.flex.flex-col')
    .filter({ has: page.getByRole('heading', { name: /^Start$/i }) })
    .first();
  await expect(startCard).toBeVisible();
  // Vérifier header et badge (Plan actuel) si présent
  // Capturer le prix (ex: "12,34 €" ou "12 €") affiché dans la StartCard
  const priceEl = startCard.locator('text=/\\d+[\\s\\u00A0]?(?:[.,]\\d{2})?\\s*€/').first();
  await expect(priceEl).toBeVisible({ timeout: 10000 });
  // const priceElText = (await priceEl.textContent())?.trim() ?? null;
  const startPriceText = (await priceEl.innerText()).trim();
  const startPrice = cleanPrice(startPriceText);
  expect(Number.isFinite(startPrice)).toBeTruthy();
  await expect(startCard.getByRole('heading', { name: /^Start$/i })).toBeVisible();
  // Bouton Commencer dans la carte
  await expect(startCard.getByRole('button', { name: /Commencer/i })).toBeVisible();
  const startButton = startCard.getByRole('button', { name: /Commencer/i }).first();
  await startButton.click();

  // Dans tous les cas: si redirection Checkout a eu lieu, compléter le paiement
  await completeStripeCheckoutIfPresent(page);
  // S'assurer retour sur dashboard si on a été redirigé
  await page.waitForURL('**/dashboard**', { timeout: 60000 });

  // Vérifications Start: bouton "Commencer" non présent + badge (Plan actuel)
  await expect(startCard.getByRole('button', { name: /Commencer/i })).toHaveCount(0);
  const startCurrent = startCard.getByText(/\(Plan actuel\)/i).first();
  await expect(startCurrent).toBeVisible({ timeout: 30000 });

  // Extraire les crédits de la StartCard et de la navbar, puis comparer
  const startCreditsText = (await startCard.getByText(/\d+[\s\u00A0\u202F]*crédits/i).first().innerText()).trim();
  const startCredits = cleanCredits(startCreditsText);
  const nav = page.locator('nav').first();
  await expect(nav).toBeVisible({ timeout: 10000 });
  const navbarCreditsText = (
    await nav.getByText(/\d+[\s\u00A0\u202F]*crédits/i).first().innerText()
  ).trim();
  const navbarCredits = cleanCredits(navbarCreditsText);
  expect(startCredits).toBe(navbarCredits);

  // Carte Watch: structure spécifique différente (ring-2 ring-orange-500 relative)
  const watchCard = page
    .locator('div.bg-white.rounded-\\[20px\\].shadow-sm.border.p-6.flex.flex-col.ring-2.ring-orange-500.relative')
    .filter({ has: page.getByRole('heading', { name: /^Watch$/i }) })
    .first();
  await expect(watchCard).toBeVisible({ timeout: 30000 });
  await expect(watchCard.getByRole('heading', { name: /^Watch$/i })).toBeVisible();
  // Bouton Augmenter / Upgrade dans la carte Watch
  const watchButton = watchCard.getByRole('button', { name: /Commencer/i }).first();

  // Extraire les prix Start et Watch (texte puis conversion via cleanPrice)
  const watchPriceEl = watchCard.locator('text=/\\d+[\\s\\u00A0\\u202F]?(?:[.,]\\d{2})?\\s*€/').first();
  await expect(watchPriceEl).toBeVisible({ timeout: 10000 });
  const watchPriceText = (await watchPriceEl.innerText()).trim();
  const watchPrice = cleanPrice(watchPriceText);

  // La valeur startPrice a déjà été extraite plus haut; on la réutilise ici
  console.log('DEBUG prices: start -> watch', /* startPrice already defined above */);


  // Ouvrir la modale d'upgrade
  await watchButton.click();
  const confirmDialog = page.getByRole('dialog', { name: /Confirmer le changement de/i });
  await expect(confirmDialog).toBeVisible({ timeout: 30000 });

  // Extraire le prix de différence dans la modale et le comparer
  const differenceEl = confirmDialog.getByText(/\d+[\s\u00A0\u202F]?(?:[.,]\d{2})?\s*€/).first();
  await expect(differenceEl).toBeVisible({ timeout: 30000 });
  const differencePriceText = (await differenceEl.innerText()).trim();
  const differencePrice = cleanPrice(differencePriceText);
  // Comparer watch - start avec differencePrice (tolérance flottants)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - startPrice provient du bloc précédent dans le test
  const delta = Math.abs((watchPrice - startPrice) - differencePrice);
  expect(delta).toBeLessThan(0.01);

  // Confirmer
  await confirmDialog.getByRole('button', { name: 'Confirmer' }).click();
  await page.waitForTimeout(10000);

  // Vérifier les badges Plan actuel
  await expect(watchCard.getByText(/\(Plan actuel\)/i)).toBeVisible({ timeout: 150000 });
  await expect(startCard.getByText(/\(Plan actuel\)/i)).toHaveCount(0);

  // Extraire les crédits de la WatchCard et de la navbar, puis comparer
  const watchCreditsText = (await watchCard.getByText(/\d+[\s\u00A0\u202F]*crédits/i).first().innerText()).trim();
  const watchCredits = cleanCredits(watchCreditsText);
  
  await expect(nav).toBeVisible({ timeout: 10000 });
  const UpdatedNavbarCreditsText = (
    await nav.getByText(/\d+[\s\u00A0\u202F]*crédits/i).first().innerText()
  ).trim();
  const UpdatedNavbarCredits = cleanCredits(UpdatedNavbarCreditsText);
  expect(watchCredits).toBe(UpdatedNavbarCredits);
});

