import { test as setup, expect } from "@playwright/test";

// Where the authenticated session is persisted. Gitignored (playwright/.auth/).
// Every feature test reuses this via `storageState` in playwright.config.ts, so
// no test depends on the login UI (test-plan.md §7 excludes the auth mechanism).
const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_USER_EMAIL and E2E_USER_PASSWORD (see .env) before running E2E tests.");
  }

  await page.goto("/auth/signin");

  // The form is a React island (client:load). Filling before hydration leaves the
  // controlled inputs' React state empty, so submit fails "Email is required".
  // Wait for hydration, then assert the typed value actually stuck before submit.
  await page.waitForLoadState("networkidle");

  const emailBox = page.getByRole("textbox", { name: "Email" });
  const passwordBox = page.getByRole("textbox", { name: "Password" });
  await emailBox.fill(email);
  await passwordBox.fill(password);
  await expect(emailBox).toHaveValue(email);
  await expect(passwordBox).toHaveValue(password);

  await page.getByRole("button", { name: "Sign in" }).click();

  // Successful sign-in redirects to /dashboard (src/pages/api/auth/signin.ts).
  // Waiting for that URL (not a timeout) proves auth actually succeeded.
  await page.waitForURL("**/dashboard");

  // Sanity-check a protected page renders before we trust the saved session.
  await page.goto("/sets");
  await expect(page.getByRole("heading", { name: "My Sets" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
