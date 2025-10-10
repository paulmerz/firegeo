import { test, expect } from '@playwright/test';

test('register validations, puis logout/login/logout', async ({ page }) => {
  const email = `test+${Date.now()}@test.com`;
  const password = 'test1234';

  // Accéder à la page register
  await page.goto('/fr/register');

  // A) Email mal formé -> refus
  await page.locator('#name').fill('Test User');
  await page.locator('#email').fill('not-an-email');
  await page.locator('#password').fill('PasswordValide123!');
  // Ne pas cocher les CGU pour ce cas, on vérifie surtout l'email
  const submit = page.getByRole('button', { name: /créer un compte|créer|s'inscrire|create account|sign up/i });
  await submit.click();
  // Reste sur register et message/état d'erreur visible
  await expect(page).toHaveURL(/\/register/);
  // Tolérant: différents messages possibles selon l'implémentation
  const emailError = page.getByText(/email invalide|email non valide|adresse e-?mail|invalid email/i).first();
  // soit un message d'erreur, soit le champ est marqué aria-invalid
  await expect(
    emailError.or(page.locator('#email[aria-invalid="true"]').first())
  ).toBeVisible({ timeout: 5000 });

  // B) Mot de passe mal formé -> refus
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('123'); // trop court/faible
  await submit.click();
  await expect(page).toHaveURL(/\/register/);
  const pwdError = page.getByText(/mot de passe.*(trop court|faible|min|au moins)|password.*(short|weak|min)/i).first();
  await expect(
    pwdError.or(page.locator('#password[aria-invalid="true"]').first())
  ).toBeVisible({ timeout: 5000 });

  // C) CGU non acceptées -> refus
  // Mot de passe valide cette fois
  await page.locator('#password').fill(password);
  // S'assurer que la case n'est pas cochée
  const terms = page.locator('#terms');
  if (await terms.isChecked()) {
    await terms.uncheck();
  }
  await submit.click();
  await expect(page).toHaveURL(/\/register/);
  const termsError = page.getByText(/accepter les conditions|cgu|terms|conditions générales/i).first();
  await expect(
    termsError.or(page.locator('#terms[aria-invalid="true"]').first())
  ).toBeVisible({ timeout: 5000 });

  // 1) Register valide
  await terms.check();
  await submit.click();

  // Indicateur de session: bouton Déconnexion visible (navbar)
  await expect(page.getByRole('button', { name: /déconnexion|logout/i })).toBeVisible({ timeout: 20000 });

  // 2) Logout
  await page.getByRole('button', { name: /déconnexion|logout/i }).click();
  await page.waitForURL('**/login', { timeout: 20000 });

  // 3) Login avec les mêmes identifiants
  await page.goto('/fr/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /se connecter|connexion|login/i }).click();

  // Session à nouveau active
  await expect(page.getByRole('button', { name: /déconnexion|logout/i })).toBeVisible({ timeout: 20000 });

  // 4) Logout final
  await page.getByRole('button', { name: /déconnexion|logout/i }).click();
  await page.waitForURL('**/login', { timeout: 20000 });
  await expect(page).toHaveURL(/\/login/);
});

