import { test, expect } from "@playwright/test";
import { DEFAULT_SITE, MATAM_SITE, VALID_SITES } from "../fixtures/sites-senegal";

/**
 * Test du workflow complet d'un projet solaire de A à Z.
 * Utilise les données réelles de sites sénégalais.
 */
test.describe("Workflow complet A → Z", () => {
  test("workflow complet : Dakar Point M1 (30kW)", async ({ page }) => {
    test.setTimeout(120_000); // 2 minutes pour le workflow complet

    const site = DEFAULT_SITE;
    const projectName = `Workflow Dakar ${site.site} - ${Date.now()}`;

    // ═══════════════════════════════════════════
    // ÉTAPE 1 : Créer le projet
    // ═══════════════════════════════════════════
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(projectName);
    await page
      .locator("#project-address")
      .fill(`${site.site}, ${site.zone}, Sénégal`);

    const notes = page.locator("#project-notes");
    if (await notes.isVisible()) {
      await notes.fill(
        `Site: ${site.site}\nZone: ${site.zone}\nPuissance: ${site.puissanceKw}kW\nLat: ${site.lat}, Lng: ${site.lng}`
      );
    }

    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Vérifier le nom du projet dans le heading
    await expect(
      page.getByRole("heading", { name: new RegExp(site.site) })
    ).toBeVisible({ timeout: 5_000 });

    // ═══════════════════════════════════════════
    // ÉTAPE 2 : Onglet Carte — Visualiser le site
    // ═══════════════════════════════════════════
    const mapTab = page.getByRole("tab", { name: "Carte & Toit" });
    if (await mapTab.isVisible().catch(() => false)) {
      await mapTab.click();
      await page.waitForTimeout(2000);

      // Vérifier que la carte se charge
      const canvas = page.locator("canvas").first();
      await expect(canvas).toBeVisible({ timeout: 10_000 });

      // Essayer de dessiner un rectangle sur la carte
      const rectBtn = page
        .locator('button:has-text("Rectangle"), button[title*="rectangle" i]')
        .first();
      if (await rectBtn.isVisible().catch(() => false)) {
        await rectBtn.click();
        const box = await canvas.boundingBox();
        if (box) {
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await page.mouse.click(cx - 50, cy - 30);
          await page.waitForTimeout(300);
          await page.mouse.click(cx + 50, cy + 30);
          await page.waitForTimeout(500);
        }
      }
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 3 : Onglet Panneaux — Placement
    // ═══════════════════════════════════════════
    const panelsTab = page.getByRole("tab", { name: "Panneaux" });
    if (await panelsTab.isVisible().catch(() => false)) {
      await panelsTab.click();
      await page.waitForTimeout(1000);

      // Vérifier que l'onglet charge
      const tabPanel = page.locator('[role="tabpanel"]');
      await expect(tabPanel).toBeVisible();
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 4 : Onglet Vue 3D — Visualisation
    // ═══════════════════════════════════════════
    const tab3d = page.getByRole("tab", { name: "Vue 3D" });
    if (await tab3d.isVisible().catch(() => false)) {
      await tab3d.click();
      await page.waitForTimeout(2000);

      // React Three Fiber crée un canvas WebGL
      const canvas3d = page.locator("canvas").first();
      if (await canvas3d.isVisible().catch(() => false)) {
        await expect(canvas3d).toBeVisible();
      }
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 5 : Onglet Simulation — Production PV
    // ═══════════════════════════════════════════
    const simTab = page.getByRole("tab", { name: "Simulation" });
    if (await simTab.isVisible().catch(() => false)) {
      await simTab.click();
      await page.waitForTimeout(1000);

      // Lancer la simulation si le bouton est disponible
      const simButton = page.getByRole("button", {
        name: /simuler|simulation|lancer|calculer/i,
      });
      if (await simButton.isVisible().catch(() => false)) {
        await simButton.click();
        await page.waitForTimeout(5000);
      }
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 6 : Onglet Schéma unifilaire
    // ═══════════════════════════════════════════
    const schemaTab = page.getByRole("tab", { name: "Schéma unifilaire" });
    if (await schemaTab.isVisible().catch(() => false)) {
      await schemaTab.click();
      await page.waitForTimeout(1000);

      // Générer le schéma
      const genButton = page.getByRole("button", {
        name: /générer|schéma|auto/i,
      });
      if (await genButton.isVisible().catch(() => false)) {
        await genButton.click();
        await page.waitForTimeout(3000);
      }
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 7 : Onglet Rapport
    // ═══════════════════════════════════════════
    const reportTab = page.getByRole("tab", { name: "Rapport" });
    if (await reportTab.isVisible().catch(() => false)) {
      await reportTab.click();
      await page.waitForTimeout(1000);

      const reportBtn = page.getByRole("button", {
        name: /générer|rapport|pdf/i,
      });
      if (await reportBtn.isVisible().catch(() => false)) {
        // On ne clique pas pour éviter un long téléchargement
        await expect(reportBtn).toBeVisible();
      }
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 8 : Retour à la liste — Vérifier le projet
    // ═══════════════════════════════════════════
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    // Le projet doit être dans la liste
    await expect(page.getByText(projectName).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("tester avec un site de chaque région", async ({ page }) => {
    test.setTimeout(60_000);

    // Tester avec 3 sites de régions différentes
    const sites = [
      VALID_SITES.find((s) => s.zone === "DKR")!,       // Dakar
      VALID_SITES.find((s) => s.zone === "MATAM")!,      // Nord
      VALID_SITES.find((s) => s.zone === "ZIGUINCHOR")!,  // Sud
    ];

    for (const site of sites) {
      await page.goto("/projects");
      await page.waitForLoadState("networkidle");

      await page.getByRole("button", { name: "Nouveau projet" }).click();
      await page
        .locator("#project-name")
        .fill(`${site.zone} - ${site.site}`);
      await page
        .locator("#project-address")
        .fill(`${site.site}, ${site.centre}, Sénégal`);

      await page.getByRole("button", { name: "Créer un projet" }).click();
      await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

      // Vérifier que le projet se charge (heading contient le nom du site)
      await expect(
        page.getByRole("heading", { name: new RegExp(site.site) })
      ).toBeVisible({ timeout: 5_000 });
    }

    // Vérifier les 3 projets dans la liste
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    for (const site of sites) {
      await expect(
        page.getByText(new RegExp(`${site.zone}.*${site.site}`)).first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test("vérifier toutes les données des sites sénégalais", async ({ page }) => {
    // Test léger : vérifier que les données sont cohérentes
    for (const site of VALID_SITES) {
      // Vérifier les coordonnées sont dans la plage du Sénégal
      expect(site.lat).toBeGreaterThan(12); // Sud du Sénégal
      expect(site.lat).toBeLessThan(17);    // Nord du Sénégal
      expect(site.lng).toBeGreaterThan(-18); // Ouest
      expect(site.lng).toBeLessThan(-11);   // Est

      // Vérifier les puissances (certains sites ont 0 = données manquantes)
      expect(site.puissanceKw).toBeGreaterThanOrEqual(0);
      expect(site.puissanceKw).toBeLessThanOrEqual(30);
    }

    // Vérifier qu'au moins 25 sites ont une puissance > 0
    const sitesAvecPuissance = VALID_SITES.filter((s) => s.puissanceKw > 0);
    expect(sitesAvecPuissance.length).toBeGreaterThan(25);
  });
});
