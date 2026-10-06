import { test, expect } from "@playwright/test";

test.describe("Authentification", () => {
  const timestamp = Date.now();

  test("inscription particulier → redirige vers dashboard", async ({
    page,
  }) => {
    await page.goto("/auth/register");

    await expect(page.getByText("Créez votre compte SenPV")).toBeVisible();

    await page.locator("#name").fill("Jean Diop");
    await page.locator("#email").fill(`jean-${timestamp}@test.sn`);
    await page.locator("#password").fill("SecurePass123!");
    await page.locator("#confirmPassword").fill("SecurePass123!");
    await page.locator('input[name="role"][value="particular"]').check();

    await page.getByRole("button", { name: "Inscription" }).click();

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 });
  });

  test("inscription installateur avec entreprise", async ({ page }) => {
    await page.goto("/auth/register");

    await page.locator("#name").fill("Moussa Fall");
    await page.locator("#email").fill(`moussa-${timestamp}@test.sn`);
    await page.locator("#password").fill("SecurePass123!");
    await page.locator("#confirmPassword").fill("SecurePass123!");
    await page.locator('input[name="role"][value="installer"]').check();

    // Les champs installateur apparaissent
    await expect(page.locator("#companyName")).toBeVisible();
    await page.locator("#companyName").fill("SolarTech Sénégal");
    await page.locator("#phone").fill("+221771234567");

    await page.getByRole("button", { name: "Inscription" }).click();

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 });
  });

  test("erreur si mots de passe différents", async ({ page }) => {
    await page.goto("/auth/register");

    await page.locator("#name").fill("Test User");
    await page.locator("#email").fill(`mismatch-${timestamp}@test.sn`);
    await page.locator("#password").fill("Password123!");
    await page.locator("#confirmPassword").fill("DifferentPass!");
    await page.locator('input[name="role"][value="particular"]').check();

    await page.getByRole("button", { name: "Inscription" }).click();

    await expect(
      page.getByText("Les mots de passe ne correspondent pas")
    ).toBeVisible();
  });

  test("connexion avec identifiants valides", async ({ page }) => {
    // D'abord créer le compte
    await page.goto("/auth/register");
    await page.locator("#name").fill("Login Test");
    await page.locator("#email").fill(`login-${timestamp}@test.sn`);
    await page.locator("#password").fill("SecurePass123!");
    await page.locator("#confirmPassword").fill("SecurePass123!");
    await page.locator('input[name="role"][value="particular"]').check();
    await page.getByRole("button", { name: "Inscription" }).click();
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 });

    // Se déconnecter (aller à login)
    await page.goto("/auth/login");

    // Se reconnecter
    await page.locator("#email").fill(`login-${timestamp}@test.sn`);
    await page.locator("#password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Connexion" }).click();

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 });
  });

  test("erreur connexion avec mauvais mot de passe", async ({ page }) => {
    await page.goto("/auth/login");

    await page.locator("#email").fill("inexistant@test.sn");
    await page.locator("#password").fill("MauvaisPass!");
    await page.getByRole("button", { name: "Connexion" }).click();

    await expect(
      page.getByText("Email ou mot de passe incorrect")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("lien inscription ↔ connexion fonctionne", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Inscription" }).click();
    await expect(page).toHaveURL(/.*register/);

    await page.getByRole("link", { name: "Connexion" }).click();
    await expect(page).toHaveURL(/.*login/);
  });
});
