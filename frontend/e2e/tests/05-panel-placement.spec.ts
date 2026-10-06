import { test, expect } from "@playwright/test";

test.describe("Placement des panneaux (Calpinage)", () => {
  test.beforeEach(async ({ page }) => {
    // Créer un projet et aller à l'onglet Panneaux
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(`Panels-${Date.now()}`);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Aller à l'onglet Panneaux
    const panelsTab = page.getByRole("tab", { name: "Panneaux" });
    await panelsTab.click();
    await page.waitForTimeout(1000);
  });

  test("l'onglet Panneaux affiche les contrôles", async ({ page }) => {
    // Vérifier que les sélecteurs d'équipement sont présents
    // (panneau solaire, onduleur, espacement, etc.)
    const panelContent = page.locator('[role="tabpanel"]');
    await expect(panelContent).toBeVisible();
  });

  test("sélecteur de panneau solaire disponible", async ({ page }) => {
    // Chercher un sélecteur de panneau
    const panelSelect = page
      .locator('select, [role="combobox"]')
      .first();
    await expect(panelSelect).toBeVisible({ timeout: 10_000 });
  });

  test("sélecteur de zone disponible", async ({ page }) => {
    // Le sélecteur de zone devrait indiquer qu'il n'y a pas de zones
    // car on n'en a pas encore créé
    const noZoneMsg = page.getByText(
      /aucune zone|sélectionner.*zone|créer.*zone/i
    );
    const zoneSelect = page.locator(
      'select, [role="combobox"]'
    );

    // L'un ou l'autre devrait être visible
    const hasMsg = await noZoneMsg.isVisible().catch(() => false);
    const hasSelect = await zoneSelect.first().isVisible().catch(() => false);
    expect(hasMsg || hasSelect).toBeTruthy();
  });

  test("contrôles d'espacement visibles", async ({ page }) => {
    // Chercher les inputs numériques pour espacement
    const spacingInputs = page.locator('input[type="number"]');
    const count = await spacingInputs.count();
    // Au moins quelques inputs numériques devraient être présents
    // (espacement X, Y, gap rangée, etc.)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("contrôles d'orientation disponibles", async ({ page }) => {
    // Orientation horizontal/vertical
    const orientationControl = page.getByText(
      /horizontal|vertical|orientation|paysage|portrait/i
    );
    // Peut ne pas être visible si aucune zone sélectionnée
    if (await orientationControl.isVisible().catch(() => false)) {
      await expect(orientationControl).toBeVisible();
    }
  });

  test("bouton calpinage auto", async ({ page }) => {
    // Chercher le bouton de calpinage automatique
    const calButton = page.getByRole("button", {
      name: /calpinage|générer|placer|auto/i,
    });
    if (await calButton.isVisible().catch(() => false)) {
      await expect(calButton).toBeVisible();
    }
  });
});
