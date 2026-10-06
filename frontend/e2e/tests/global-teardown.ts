import { test as teardown } from "@playwright/test";

teardown("nettoyage", async () => {
  // Pas de nettoyage global nécessaire pour l'instant.
  // Les projets de test sont créés/supprimés dans chaque suite.
});
