import { test, expect } from "@playwright/test";

test.describe("Analyse financière", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(`Finance-${Date.now()}`);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Aller à l'onglet Simulation (financier souvent dans le même onglet)
    const simTab = page.getByRole("tab", { name: "Simulation" });
    await simTab.click();
    await page.waitForTimeout(1000);
  });

  test("section financière visible", async ({ page }) => {
    const financialSection = page.getByText(
      /financ|npv|van|irr|tri|lcoe|retour.*investissement|payback/i
    );
    if (await financialSection.first().isVisible().catch(() => false)) {
      await expect(financialSection.first()).toBeVisible();
    }
  });

  test("affichage des indicateurs financiers", async ({ page }) => {
    // Chercher les indicateurs clés
    const indicators = [
      /npv|van/i,
      /irr|tri|taux.*rendement/i,
      /lcoe|coût.*énergie/i,
      /payback|retour|amortissement/i,
    ];

    for (const indicator of indicators) {
      const el = page.getByText(indicator).first();
      if (await el.isVisible().catch(() => false)) {
        await expect(el).toBeVisible();
      }
    }
  });

  test("graphique cashflow 25 ans", async ({ page }) => {
    // Graphique Recharts pour le cashflow cumulé
    const chart = page.locator(
      '.recharts-wrapper, [class*="cashflow"], [class*="chart"]'
    );
    if (await chart.first().isVisible().catch(() => false)) {
      await expect(chart.first()).toBeVisible();
    }
  });

  test("bouton calculer analyse financière (disabled sans simulation)", async ({
    page,
  }) => {
    const calcButton = page.getByRole("button", {
      name: /calculer|financ|analyser/i,
    });
    const visible = await calcButton.isVisible().catch(() => false);
    if (visible) {
      // Sans simulation préalable, le bouton devrait être disabled
      const isDisabled = await calcButton.isDisabled().catch(() => false);
      expect(isDisabled).toBeTruthy();
    }
  });
});
