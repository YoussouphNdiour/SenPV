import { test as setup, expect } from "@playwright/test";
import { TEST_PARTICULAR, registerViaUI, loginViaUI } from "../fixtures/auth.fixture";

/**
 * Global setup: crée un utilisateur de test et sauvegarde la session.
 * Les autres tests réutilisent le storageState pour éviter de se reconnecter.
 */
setup("créer utilisateur et sauvegarder session", async ({ page }) => {
  // Tenter inscription (peut échouer si l'utilisateur existe déjà)
  try {
    await registerViaUI(page, TEST_PARTICULAR);
    await expect(page).toHaveURL(/.*dashboard/);
  } catch {
    // L'utilisateur existe déjà, on fait juste login
    await loginViaUI(page, TEST_PARTICULAR.email, TEST_PARTICULAR.password);
    await expect(page).toHaveURL(/.*dashboard/);
  }

  // Sauvegarder la session pour les autres tests
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
