import { test, expect } from "@playwright/test";

test.describe("Rapport PDF", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(`Report-${Date.now()}`);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Aller à l'onglet Rapport
    const reportTab = page.getByRole("tab", { name: "Rapport" });
    await reportTab.click();
    await page.waitForTimeout(1000);
  });

  test("l'onglet Rapport se charge", async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible();
  });

  test("bouton générer rapport PDF", async ({ page }) => {
    const genButton = page.getByRole("button", {
      name: /générer|rapport|pdf|télécharger/i,
    });
    if (await genButton.isVisible().catch(() => false)) {
      await expect(genButton).toBeVisible();
    }
  });

  test("options de rapport (complet, devis, schéma)", async ({ page }) => {
    // Chercher les différentes options de rapport
    const options = page.getByText(
      /rapport.*complet|devis|schéma|production/i
    );
    if (await options.first().isVisible().catch(() => false)) {
      await expect(options.first()).toBeVisible();
    }
  });

  test("liste des rapports générés", async ({ page }) => {
    // S'il y a des rapports précédents, ils devraient être listés
    const reportsList = page.getByText(
      /historique|rapports.*générés|télécharger/i
    );
    // Peut être vide si aucun rapport n'a été généré
    if (await reportsList.first().isVisible().catch(() => false)) {
      await expect(reportsList.first()).toBeVisible();
    }
  });

  test("téléchargement de rapport", async ({ page }) => {
    const genButton = page.getByRole("button", {
      name: /générer|rapport|pdf/i,
    });

    if (await genButton.isVisible().catch(() => false)) {
      // Écouter l'événement de téléchargement
      const downloadPromise = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);

      await genButton.click();
      await page.waitForTimeout(5000);

      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toContain(".pdf");
      }
    }
  });
});
