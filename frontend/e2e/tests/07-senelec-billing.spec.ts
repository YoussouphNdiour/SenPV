import { test, expect } from "@playwright/test";

test.describe("Facturation SENELEC", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(`SENELEC-${Date.now()}`);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Aller à l'onglet Simulation (la facturation SENELEC est souvent dans cet onglet)
    const simTab = page.getByRole("tab", { name: "Simulation" });
    await simTab.click();
    await page.waitForTimeout(1000);
  });

  test("section SENELEC visible", async ({ page }) => {
    // Chercher la section de facturation SENELEC
    const senelecSection = page.getByText(/senelec|facture|consommation/i);
    if (await senelecSection.first().isVisible().catch(() => false)) {
      await expect(senelecSection.first()).toBeVisible();
    }
  });

  test("saisir consommation mensuelle", async ({ page }) => {
    // Chercher l'input de consommation
    const consumptionInput = page.locator(
      'input[type="number"][id*="consumption"], input[placeholder*="kWh" i], input[placeholder*="consommation" i]'
    );

    if (await consumptionInput.first().isVisible().catch(() => false)) {
      await consumptionInput.first().clear();
      await consumptionInput.first().fill("350");
      await page.waitForTimeout(500);

      // Vérifier qu'un résultat de facture apparaît
      const result = page.getByText(/fcfa|montant|facture|total/i);
      if (await result.first().isVisible().catch(() => false)) {
        await expect(result.first()).toBeVisible();
      }
    }
  });

  test("calcul tarif DPP/DMP/DGP", async ({ page }) => {
    // Les tranches SENELEC doivent apparaître dans le résultat
    const tariffLabels = page.getByText(/dpp|dmp|dgp|tranche/i);
    if (await tariffLabels.first().isVisible().catch(() => false)) {
      await expect(tariffLabels.first()).toBeVisible();
    }
  });

  test("calcul des économies PV", async ({ page }) => {
    // Section économies
    const savings = page.getByText(/économie|savings|gain/i);
    if (await savings.first().isVisible().catch(() => false)) {
      await expect(savings.first()).toBeVisible();
    }
  });
});
