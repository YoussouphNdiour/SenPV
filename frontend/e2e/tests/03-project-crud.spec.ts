import { test, expect } from "@playwright/test";
import { DEFAULT_SITE, MATAM_SITE } from "../fixtures/sites-senegal";

test.describe("Projets CRUD", () => {
  test("créer un nouveau projet avec données Dakar", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    // Ouvrir le dialog de création
    await page.getByRole("button", { name: "Nouveau projet" }).click();

    // Remplir le formulaire
    await page.locator("#project-name").fill(`Test Dakar - ${DEFAULT_SITE.site}`);
    await page
      .locator("#project-address")
      .fill(`${DEFAULT_SITE.site}, ${DEFAULT_SITE.zone}, Sénégal`);

    // Si champ notes visible
    const notes = page.locator("#project-notes");
    if (await notes.isVisible()) {
      await notes.fill(
        `Forage solaire ${DEFAULT_SITE.puissanceKw}kW - Zone ${DEFAULT_SITE.zone}`
      );
    }

    // Soumettre
    await page.getByRole("button", { name: "Créer un projet" }).click();

    // Redirigé vers la page du projet
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });
  });

  test("créer un projet Matam et vérifier les détails", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(`Matam - ${MATAM_SITE.site}`);
    await page
      .locator("#project-address")
      .fill(`${MATAM_SITE.site}, Matam, Sénégal`);

    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Vérifier que le nom est affiché dans le heading
    await expect(
      page.getByRole("heading", { name: new RegExp(MATAM_SITE.site) })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("lister les projets", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    // Le titre "Projets" doit être visible
    await expect(page.getByRole("heading", { name: "Projets" })).toBeVisible();

    // Le bouton "Nouveau projet" doit être là
    await expect(
      page.getByRole("button", { name: "Nouveau projet" })
    ).toBeVisible();
  });

  test("rechercher un projet", async ({ page }) => {
    // D'abord créer un projet avec un nom unique
    const uniqueName = `Recherche-${Date.now()}`;
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(uniqueName);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Retour à la liste
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    // Chercher le projet
    const searchInput = page.getByPlaceholder("Rechercher...");
    if (await searchInput.isVisible()) {
      await searchInput.fill(uniqueName);
      await page.waitForTimeout(500); // debounce

      // Le projet doit apparaître
      await expect(page.getByText(uniqueName)).toBeVisible();
    }
  });

  test("supprimer un projet", async ({ page }) => {
    // Créer un projet à supprimer
    const deleteName = `ASupprimer-${Date.now()}`;
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(deleteName);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Accepter le dialog de confirmation
    page.on("dialog", (dialog) => dialog.accept());

    // Chercher le bouton supprimer (icône Trash)
    const deleteBtn = page.getByRole("button", { name: /supprimer/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      // Redirigé vers la liste
      await expect(page).toHaveURL(/.*projects$/, { timeout: 10_000 });
    }
  });

  test("naviguer entre les onglets du projet", async ({ page }) => {
    // Créer un projet
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.locator("#project-name").fill(`Onglets-${Date.now()}`);
    await page.locator("#project-address").fill("Dakar, Sénégal");
    await page.getByRole("button", { name: "Créer un projet" }).click();
    await expect(page).toHaveURL(/.*projects\//, { timeout: 15_000 });

    // Tester les onglets
    const tabs = [
      "Carte & Toit",
      "Panneaux",
      "Vue 3D",
      "Simulation",
      "Schéma unifilaire",
      "Rapport",
    ];

    for (const tab of tabs) {
      const tabButton = page.getByRole("tab", { name: tab });
      if (await tabButton.isVisible()) {
        await tabButton.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
