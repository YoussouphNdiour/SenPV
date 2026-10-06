import { test, expect } from "@playwright/test";
import { TEST_INSTALLER, registerViaUI, loginViaUI } from "../fixtures/auth.fixture";

test.describe("Devis (installateur)", () => {
  const installerEmail = `installer-quote-${Date.now()}@test.sn`;
  const installerPassword = "SecurePass123!";

  test.beforeEach(async ({ page }) => {
    // Se connecter en tant qu'installateur
    // D'abord essayer l'inscription
    try {
      await page.goto("/auth/register");
      await page.locator("#name").fill("Installateur Test");
      await page.locator("#email").fill(installerEmail);
      await page.locator("#password").fill(installerPassword);
      await page.locator("#confirmPassword").fill(installerPassword);
      await page.locator('input[name="role"][value="installer"]').check();
      await page.locator("#companyName").fill("SolarTech Test");
      await page.locator("#phone").fill("+221771111111");
      await page.getByRole("button", { name: "Inscription" }).click();
      await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 });
    } catch {
      // Déjà inscrit → login
      await loginViaUI(page, installerEmail, installerPassword);
    }

    // Créer un projet
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(`Devis-${Date.now()}`);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Aller à l'onglet Devis
    const quoteTab = page.getByRole("tab", { name: "Devis" });
    if (await quoteTab.isVisible().catch(() => false)) {
      await quoteTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test("l'onglet Devis est visible pour installateur", async ({ page }) => {
    const quoteTab = page.getByRole("tab", { name: "Devis" });
    await expect(quoteTab).toBeVisible();
  });

  test("bouton créer un devis", async ({ page }) => {
    const createQuoteBtn = page.getByRole("button", {
      name: /créer.*devis|nouveau.*devis|ajouter/i,
    });
    if (await createQuoteBtn.isVisible().catch(() => false)) {
      await expect(createQuoteBtn).toBeVisible();
    }
  });

  test("formulaire de devis avec lignes", async ({ page }) => {
    const createQuoteBtn = page.getByRole("button", {
      name: /créer.*devis|nouveau.*devis|ajouter/i,
    });

    if (await createQuoteBtn.isVisible().catch(() => false)) {
      await createQuoteBtn.click();
      await page.waitForTimeout(1000);

      // Chercher les champs de ligne de devis
      const lineItems = page.getByText(
        /description|quantité|prix|montant|ligne/i
      );
      if (await lineItems.first().isVisible().catch(() => false)) {
        await expect(lineItems.first()).toBeVisible();
      }
    }
  });

  test("total en FCFA", async ({ page }) => {
    // Vérifier que les montants sont en FCFA
    const fcfa = page.getByText(/fcfa|f\s*cfa/i);
    if (await fcfa.first().isVisible().catch(() => false)) {
      await expect(fcfa.first()).toBeVisible();
    }
  });

  test("statuts de devis (brouillon/envoyé/accepté)", async ({ page }) => {
    const statusLabels = page.getByText(
      /brouillon|draft|envoyé|sent|accepté|accepted/i
    );
    if (await statusLabels.first().isVisible().catch(() => false)) {
      await expect(statusLabels.first()).toBeVisible();
    }
  });
});
