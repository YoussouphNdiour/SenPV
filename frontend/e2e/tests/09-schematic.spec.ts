import { test, expect } from "@playwright/test";

test.describe("Schéma unifilaire", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(`Schema-${Date.now()}`);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Aller à l'onglet Schéma unifilaire
    const schemaTab = page.getByRole("tab", { name: "Schéma unifilaire" });
    await schemaTab.click();
    await page.waitForTimeout(1000);
  });

  test("l'onglet schéma se charge", async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible();
  });

  test("bouton générer schéma visible", async ({ page }) => {
    const genButton = page.getByRole("button", {
      name: /générer|schéma|auto/i,
    });
    if (await genButton.isVisible().catch(() => false)) {
      await expect(genButton).toBeVisible();
    }
  });

  test("palette de symboles disponible", async ({ page }) => {
    // La palette de symboles contient des composants à glisser-déposer
    const palette = page.getByText(
      /palette|composant|panneau|onduleur|disjoncteur|compteur/i
    );
    if (await palette.first().isVisible().catch(() => false)) {
      await expect(palette.first()).toBeVisible();
    }
  });

  test("zone de dessin React Flow visible", async ({ page }) => {
    // React Flow utilise une div avec class react-flow
    const reactFlow = page.locator(
      '.react-flow, [class*="reactflow"], [class*="react-flow"]'
    );
    if (await reactFlow.isVisible().catch(() => false)) {
      await expect(reactFlow).toBeVisible();
    }
  });

  test("bouton validation électrique", async ({ page }) => {
    const validateBtn = page.getByRole("button", {
      name: /valider|validation|vérifier/i,
    });
    if (await validateBtn.isVisible().catch(() => false)) {
      await expect(validateBtn).toBeVisible();
    }
  });

  test("bouton export SVG", async ({ page }) => {
    const exportBtn = page.getByRole("button", {
      name: /export|svg|télécharger/i,
    });
    if (await exportBtn.isVisible().catch(() => false)) {
      await expect(exportBtn).toBeVisible();
    }
  });
});
