import { test, expect } from "@playwright/test";

/**
 * SEED TEST — the exemplar every generated E2E test is modeled on.
 *
 * "What you show is what you get": if this seed uses getByRole, generated tests
 * do too; if it waited on a timeout, they'd inherit that. It deliberately
 * demonstrates the four conventions this project requires (see
 * .claude/skills/10x-e2e/references/seed-test-pattern.md):
 *
 *   1. Role-based locators — getByRole / getByLabel, never CSS/XPath.
 *   2. Wait for state, not time — waitForURL / toBeVisible, never waitForTimeout.
 *   3. Unique test data — Date.now() suffix so parallel runs and re-runs collide-free.
 *   4. Full self-contained cycle — setup, action, assertion, cleanup in one test.
 *
 * It exercises a real persistence path (CSV import → /api/sets → DB → SSR list),
 * the same class of boundary-crossing concern the test-plan persistence guardrail
 * cares about. Auth is reused from storageState, so the test never touches login.
 */

// A minimal valid set: header + one in-range row (src/lib/csv.ts).
const CSV = "name,latitude,longitude\nWarsaw,52.2297,21.0122\n";

test("imported set persists after page reload", async ({ page }) => {
  // Unique name so re-runs and parallel workers never collide (anti-pattern #5).
  const setName = `Seed Set ${Date.now()}`;
  const setLink = page.getByRole("link", { name: new RegExp(setName) });

  // --- setup + action: import a one-card set via the real CSV flow ---
  await page.goto("/sets");
  // The import form is a React island (client:load); wait for hydration so its
  // onChange/onSubmit handlers are wired before we interact (otherwise the file
  // never reaches React state and submit silently no-ops).
  await page.waitForLoadState("networkidle");

  const nameBox = page.getByRole("textbox", { name: "Set name" });
  await page.getByLabel(/CSV file/).setInputFiles({
    name: "seed.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });
  // The form pre-fills the name from the filename ("seed.csv" → "seed"); asserting
  // that proves hydration ran AND React registered the file before we proceed.
  await expect(nameBox).toHaveValue("seed", { timeout: 15_000 });
  // Override it with our unique id.
  await nameBox.fill(setName);
  await page.getByRole("button", { name: "Import set" }).click();

  // Import redirects back to /sets; wait for that state, not a fixed delay.
  await page.waitForURL("**/sets");
  await expect(setLink).toBeVisible();

  // --- assertion: the set survives a full SSR reload (the persistence claim) ---
  await page.reload();
  await expect(setLink).toBeVisible();

  // --- cleanup: delete the set so the next run starts clean ---
  // Deletion goes through window.confirm (FR-006); Playwright dismisses dialogs
  // by default, which would cancel the delete — so we accept it explicitly.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Delete ${setName}` }).click();
  await expect(setLink).toHaveCount(0);
});
