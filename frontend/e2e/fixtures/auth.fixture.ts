import { test as base, type Page } from "@playwright/test";

const API_URL = process.env.API_URL || "http://localhost:8000";

export interface TestUser {
  name: string;
  email: string;
  password: string;
  role: "particular" | "installer";
  companyName?: string;
  phone?: string;
}

export const TEST_PARTICULAR: TestUser = {
  name: "Test Particulier",
  email: `test-particulier-${Date.now()}@senpv-test.com`,
  password: "TestPass123!",
  role: "particular",
};

export const TEST_INSTALLER: TestUser = {
  name: "Test Installateur",
  email: `test-installer-${Date.now()}@senpv-test.com`,
  password: "TestPass123!",
  role: "installer",
  companyName: "SolarTech Sénégal",
  phone: "+221771234567",
};

/**
 * Register a user via the API directly (faster than UI).
 */
export async function registerViaAPI(user: TestUser): Promise<void> {
  const body: Record<string, string> = {
    name: user.name,
    email: user.email,
    password: user.password,
    role: user.role,
  };
  if (user.companyName) body.company_name = user.companyName;
  if (user.phone) body.phone = user.phone;

  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Get a JWT token via the API.
 */
export async function getTokenViaAPI(
  email: string,
  password: string
): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Login via UI (fills form, clicks submit, waits for redirect).
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

/**
 * Register via UI (fills form, clicks submit, waits for redirect).
 */
export async function registerViaUI(
  page: Page,
  user: TestUser
): Promise<void> {
  await page.goto("/auth/register");
  await page.locator("#name").fill(user.name);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.locator("#confirmPassword").fill(user.password);

  await page.locator(`input[name="role"][value="${user.role}"]`).check();

  if (user.role === "installer") {
    await page.locator("#companyName").fill(user.companyName!);
    await page.locator("#phone").fill(user.phone!);
  }

  await page.getByRole("button", { name: "Inscription" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

/** Extended test fixture with auth helpers */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    const user = TEST_PARTICULAR;
    try {
      await registerViaAPI(user);
    } catch {
      // user may already exist
    }
    await loginViaUI(page, user.email, user.password);
    await use(page);
  },
});

export { expect } from "@playwright/test";
