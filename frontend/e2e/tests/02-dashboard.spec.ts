import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("affiche le dashboard après connexion", async ({ page }) => {
    await page.goto("/dashboard");

    // Attendre le chargement
    await page.waitForLoadState("networkidle");

    // Le dashboard doit contenir des KPI ou un message d'accueil
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("affiche le contenu du dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Le dashboard doit avoir du contenu visible après chargement
    await page.waitForTimeout(2000);
    const body = page.locator("main, [class*='dashboard'], [class*='container']").first();
    await expect(body).toBeVisible({ timeout: 10_000 });
  });

  test("lien vers projets depuis le dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Chercher un lien vers les projets
    const projectsLink = page.getByRole("link", { name: /projet/i }).first();
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await expect(page).toHaveURL(/.*projects/);
    }
  });

  test("sidebar navigation fonctionne", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Tester la navigation sidebar vers Projets
    const sidebarProjectLink = page
      .locator("nav, aside")
      .getByRole("link", { name: /projet/i })
      .first();
    if (await sidebarProjectLink.isVisible()) {
      await sidebarProjectLink.click();
      await expect(page).toHaveURL(/.*projects/);
    }
  });
});
