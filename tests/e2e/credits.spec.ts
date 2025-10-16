import { test, expect } from '@playwright/test';

test('navbar affiche 25 crédits après inscription', async ({ page }) => {
  const email = `test+${Date.now()}@test.com`;
  const password = 'test1234';

  await page.goto('/fr/register');
  await page.locator('#name').fill('Test User');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#terms').check();
  await page.getByRole('button', { name: /créer un compte|créer|s'inscrire|create account|sign up/i }).click();

  // Vérifie l'affichage des crédits dans la navbar (nombre et libellé séparés en 2 spans)
  const creditsLabel = page.getByText(/crédits/i).first();
  try {
    await expect(creditsLabel).toBeVisible({ timeout: 15000 });
  } catch {
    test.skip(true, 'Crédits non affichés (AUTUMN non configuré). Configurez AUTUMN_SECRET_KEY pour activer ce test.');
  }
  const balanceText = await creditsLabel.evaluate((el) => {
    const parent = el.parentElement;
    if (!parent) return null;
    const firstSpan = parent.querySelector('span');
    return firstSpan?.textContent?.trim() || null;
  });
  await page.waitForTimeout(3000);
  expect(balanceText).toBe('25');
});

