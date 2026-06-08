import { test, expect } from "@playwright/test";

/**
 * RISK: test-plan.md R6 — "Study state lost across tab-close or device switch —
 * mid-session progress or per-item history not persisted losslessly."
 *
 * This protects the full browser-level loop the risk crosses: answering a card
 * POSTs an attempt (StudySession island → /api/study/sessions/:id/attempts →
 * study_history), and on a real SSR reload the server re-reads that history and
 * resumes the session PAST the answered card. If the attempt didn't persist, the
 * reload restarts the session and the answered card is presented again.
 *
 * Observable outcome (reorder-invariant): after answering one card and reloading,
 * the resumed card is the *other* one — an answered card is never re-presented.
 *
 * Real vs mocked: everything real (auth via storageState, routing, the attempts
 * API, Supabase). Persistence IS the risk, so nothing here is mocked.
 *
 * Modeled on seed.spec.ts: getByRole locators, wait-for-state (waitForResponse /
 * waitForURL / toBeVisible), unique test data, full setup→action→assert→cleanup.
 */

// Two ASCII-named cards (lessons.md: keep test CSV ASCII to avoid encoding noise).
const CSV = "name,latitude,longitude\nWarsaw,52.2297,21.0122\nBerlin,52.52,13.405\n";
const CARD_NAMES = ["Warsaw", "Berlin"];

test("study progress persists after page reload", async ({ page }) => {
  const setName = `R6 Set ${Date.now()}`;
  const setLink = page.getByRole("link", { name: new RegExp(setName) });

  // --- setup: import a fresh 2-card set so the test owns its data ---
  await page.goto("/sets");
  await page.waitForLoadState("networkidle");
  const nameBox = page.getByRole("textbox", { name: "Set name" });
  await page.getByLabel(/CSV file/).setInputFiles({
    name: "r6.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });
  await expect(nameBox).toHaveValue("r6", { timeout: 15_000 }); // hydration + file registered
  await nameBox.fill(setName);
  await page.getByRole("button", { name: "Import set" }).click();
  await page.waitForURL("**/sets");
  await expect(setLink).toBeVisible();

  // --- action: open the set and answer the first card ---
  await setLink.click();
  await page.waitForURL("**/study/**");
  await page.waitForLoadState("networkidle");

  const cardHeading = page.getByRole("heading", { level: 2 });
  await expect(cardHeading).toBeVisible();
  const firstCard = (await cardHeading.textContent())?.trim() ?? "";
  expect(CARD_NAMES).toContain(firstCard);
  const otherCard = firstCard === CARD_NAMES[0] ? CARD_NAMES[1] : CARD_NAMES[0];

  // Answering = clicking the map (a role="presentation" canvas-like widget, so a
  // testid is the right handle here). The click only works once the island has
  // hydrated; retry the click until the reveal panel ("Next card"/"Finish")
  // appears, and wait for the attempt POST to actually persist before reloading.
  const attemptPersisted = page.waitForResponse(
    (r) => /\/api\/study\/sessions\/.+\/attempts/.test(r.url()) && r.request().method() === "POST" && r.ok(),
    { timeout: 20_000 },
  );
  const map = page.getByTestId("interactive-map");
  const nextButton = page.getByRole("button", { name: /Next card|Finish/ });
  await expect(async () => {
    await map.click();
    await expect(nextButton).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await attemptPersisted;

  // --- assertion: a real SSR reload resumes PAST the answered card ---
  await page.reload();
  // The card heading is server-rendered from study_history, so it reflects the
  // resumed position even before hydration. If the attempt was lost, `firstCard`
  // would reappear here and this assertion fails — exactly when R6 materializes.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(otherCard);

  // --- cleanup: delete the set (cascades its study history) ---
  await page.goto("/sets");
  await page.waitForLoadState("networkidle");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Delete ${setName}` }).click();
  await expect(setLink).toHaveCount(0);
});
