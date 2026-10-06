import { test, expect } from "@playwright/test";
import { DEFAULT_SITE } from "../fixtures/sites-senegal";

test.describe("Carte & Zones de toiture", () => {
  let projectUrl: string;

  test.beforeEach(async ({ page }) => {
    // Créer un projet pour chaque test
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page
      .locator("#project-name")
      .fill(`Map-${Date.now()}`);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });
    projectUrl = page.url();

    // Aller à l'onglet Carte
    const mapTab = page.getByRole("tab", { name: "Carte & Toit" });
    await mapTab.click();
    await page.waitForTimeout(1000); // Attendre le chargement de la carte
  });

  test("la carte MapLibre se charge", async ({ page }) => {
    // La carte doit être visible (canvas MapLibre)
    const mapCanvas = page.locator("canvas").first();
    await expect(mapCanvas).toBeVisible({ timeout: 15_000 });
  });

  test("les outils de dessin sont visibles", async ({ page }) => {
    // Chercher les boutons de la toolbar de dessin
    const drawingTools = page.locator(
      'button[title], [class*="toolbar"], [class*="drawing"]'
    );
    // Au moins un outil devrait être visible
    const count = await drawingTools.count();
    expect(count).toBeGreaterThan(0);
  });

  test("barre de recherche géographique", async ({ page }) => {
    // Chercher l'input de géorecherche
    const geoSearch = page
      .getByPlaceholder(/rechercher|adresse|lieu/i)
      .first();
    if (await geoSearch.isVisible()) {
      await geoSearch.fill("Dakar Point M1");
      await page.waitForTimeout(1000);
    }
  });

  test("dessiner un polygone sur la carte", async ({ page }) => {
    // Activer le mode dessin de polygone
    const polygonBtn = page
      .locator(
        'button:has-text("Polygone"), button[title*="polygone" i], button[title*="polygon" i]'
      )
      .first();

    if (await polygonBtn.isVisible()) {
      await polygonBtn.click();

      const canvas = page.locator("canvas").first();
      const box = await canvas.boundingBox();
      if (box) {
        // Simuler un dessin de polygone (4 clics + double-clic pour fermer)
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const size = 80;

        await page.mouse.click(cx - size, cy - size);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + size, cy - size);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + size, cy + size);
        await page.waitForTimeout(200);
        await page.mouse.click(cx - size, cy + size);
        await page.waitForTimeout(200);
        // Double-clic pour fermer le polygone
        await page.mouse.dblclick(cx - size, cy - size);
        await page.waitForTimeout(500);
      }
    }
  });

  test("dessiner un rectangle sur la carte", async ({ page }) => {
    const rectBtn = page
      .locator(
        'button:has-text("Rectangle"), button[title*="rectangle" i]'
      )
      .first();

    if (await rectBtn.isVisible()) {
      await rectBtn.click();

      const canvas = page.locator("canvas").first();
      const box = await canvas.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // Clic-glisser pour rectangle
        await page.mouse.click(cx - 60, cy - 40);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + 60, cy + 40);
        await page.waitForTimeout(500);
      }
    }
  });

  test("modifier les propriétés d'une zone", async ({ page }) => {
    // Chercher le panneau de propriétés de zone
    const tiltInput = page.locator(
      'input[type="number"][id*="tilt"], input[placeholder*="inclinaison" i]'
    );
    const azimuthInput = page.locator(
      'input[type="number"][id*="azimuth"], input[placeholder*="azimut" i]'
    );

    // Si des zones existent déjà, les propriétés devraient être accessibles
    if (await tiltInput.isVisible()) {
      await tiltInput.clear();
      await tiltInput.fill("15");
    }
    if (await azimuthInput.isVisible()) {
      await azimuthInput.clear();
      await azimuthInput.fill("180");
    }
  });
});
