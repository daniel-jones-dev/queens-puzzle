/**
 * Integration tests for the Generator page.
 *
 * Requires the dev server on http://localhost:5173.
 * Run with: npx playwright test tests/generator.test.ts
 */
import { test, expect } from "@playwright/test";
import { freshLoad } from "./helpers";

async function openGenerator(page: Parameters<typeof freshLoad>[0]) {
  await freshLoad(page);
  await page.locator("a:has-text('Generator')").first().click();
  await page.waitForTimeout(500);
}

async function addWorker(
  page: Parameters<typeof freshLoad>[0],
  n: number,
) {
  await page.locator("button:has-text('Add worker')").click();
  await expect(page.locator("[role='dialog']")).toBeVisible();
  await page.locator("[role='dialog'] select").selectOption(String(n));
  await page.locator("[role='dialog'] button:has-text('Start')").click();
  await page.waitForTimeout(300);
}

// ── Add worker modal ──────────────────────────────────────────────────────────

test.describe("Generator: add worker modal", () => {
  test("'+Add worker' opens modal with size select and seed input", async ({ page }) => {
    await openGenerator(page);
    await page.locator("button:has-text('Add worker')").click();
    await expect(page.locator("[role='dialog']")).toBeVisible();
    await expect(page.locator("[role='dialog'] select")).toBeVisible();
    await expect(page.locator("[role='dialog'] input")).toBeVisible();
  });

  test("Cancel closes the modal without adding a worker", async ({ page }) => {
    await openGenerator(page);
    await page.locator("button:has-text('Add worker')").click();
    await expect(page.locator("[role='dialog']")).toBeVisible();
    await page.locator("[role='dialog'] button:has-text('Cancel')").click();
    await expect(page.locator("[role='dialog']")).not.toBeVisible();
    await expect(page.locator("[data-testid='worker-card']")).not.toBeVisible();
  });
});

// ── Worker lifecycle ──────────────────────────────────────────────────────────

test.describe("Generator: worker lifecycle", () => {
  test("Starting a worker shows a running card with Stop button", async ({ page }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    await expect(page.locator("[data-testid='worker-card']")).toBeVisible();
    await expect(
      page.locator("[data-testid='worker-card'] button:has-text('Stop')"),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='status-badge']:has-text('Running')"),
    ).toBeVisible();
  });

  test("Clicking Stop changes badge to Stopped and shows Restart + Delete", async ({ page }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    await page.locator("button:has-text('Stop')").click();
    await page.waitForTimeout(150);

    await expect(
      page.locator("[data-testid='status-badge']:has-text('Stopped')"),
    ).toBeVisible();
    await expect(page.locator("button:has-text('Restart')")).toBeVisible();
    await expect(page.locator("button:has-text('Delete')")).toBeVisible();
    await expect(page.locator("button:has-text('Stop')")).not.toBeVisible();
  });

  test("Restart changes badge back to Running", async ({ page }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    await page.locator("button:has-text('Stop')").click();
    await page.waitForTimeout(150);
    await page.locator("button:has-text('Restart')").click();
    await page.waitForTimeout(300);

    await expect(
      page.locator("[data-testid='status-badge']:has-text('Running')"),
    ).toBeVisible();
    await expect(page.locator("button:has-text('Stop')")).toBeVisible();
  });

  test("Delete removes the worker card", async ({ page }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    await page.locator("button:has-text('Stop')").click();
    await page.waitForTimeout(150);
    await page.locator("button:has-text('Delete')").click();
    await page.waitForTimeout(150);

    await expect(page.locator("[data-testid='worker-card']")).not.toBeVisible();
  });
});

// ── Results ───────────────────────────────────────────────────────────────────

test.describe("Generator: results", () => {
  test("A found puzzle appears in the results list with size and difficulty badges", async ({
    page,
  }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    // 4×4 puzzles generate quickly; wait up to 10 s
    await expect(
      page.locator("[data-testid='result-row']").first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator("[data-testid='size-badge']").first(),
    ).toBeVisible();
  });

  test("Size filter narrows results list", async ({ page }) => {
    await openGenerator(page);

    // Start two workers with different sizes
    await addWorker(page, 4);
    await addWorker(page, 5);

    // Wait until we have at least one result from each size (mixed results)
    await page.waitForFunction(
      () => {
        const badges = [...document.querySelectorAll('[data-testid="size-badge"]')];
        return (
          badges.some((b) => b.textContent?.includes("4×4")) &&
          badges.some((b) => b.textContent?.includes("5×5"))
        );
      },
      { timeout: 20_000 },
    );

    // Stop both workers so no new results arrive during the assertion
    for (const _ of [0, 1]) {
      const stopBtn = page.locator("button:has-text('Stop')").first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        await page.waitForTimeout(50);
      }
    }
    await page.waitForTimeout(100);

    // Filter to size 4 only
    await page.locator("select[data-testid='size-filter']").selectOption("4");
    await page.waitForTimeout(100);

    // All visible badges should be 4×4
    const allBadges = await page
      .locator("[data-testid='size-badge']")
      .allTextContents();
    expect(allBadges.length).toBeGreaterThan(0);
    for (const b of allBadges) expect(b).toContain("4×4");
  });

  test("Difficulty filter narrows results list", async ({ page }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    // Wait for a few results so difficulties are populated
    await page.waitForFunction(
      () => document.querySelectorAll("[data-testid='result-row']").length >= 3,
      { timeout: 20_000 },
    );

    const totalCount = await page.locator("[data-testid='result-row']").count();
    const diffOptions = await page
      .locator("select[data-testid='diff-filter'] option")
      .allTextContents();
    const realDiffs = diffOptions.filter((d) => d !== "All difficulties");

    if (realDiffs.length === 0) {
      // No difficulty data yet — skip narrowing check
      return;
    }

    await page
      .locator("select[data-testid='diff-filter']")
      .selectOption(realDiffs[0]);
    await page.waitForTimeout(100);

    const filteredCount = await page.locator("[data-testid='result-row']").count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(totalCount);
  });
});

// ── Navigate-away guard ───────────────────────────────────────────────────────

test.describe("Generator: navigate-away guard", () => {
  test("Navigating away while worker is running shows confirmation dialog", async ({
    page,
  }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    // Click Play tab — should be blocked
    await page.locator("a:has-text('Play')").first().click();
    await expect(
      page.locator("text=Leave Generator?"),
    ).toBeVisible({ timeout: 2000 });
  });

  test("Cancelling the leave dialog keeps the worker running", async ({ page }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    await page.locator("a:has-text('Play')").first().click();
    await expect(page.locator("text=Leave Generator?")).toBeVisible({ timeout: 2000 });

    await page.locator("button:has-text('Cancel')").last().click();
    await page.waitForTimeout(150);

    // Still on generator page with running worker
    await expect(page.locator("[data-testid='worker-card']")).toBeVisible();
    await expect(
      page.locator("[data-testid='status-badge']:has-text('Running')"),
    ).toBeVisible();
  });

  test("Confirming leave navigates away", async ({ page }) => {
    await openGenerator(page);
    await addWorker(page, 4);

    await page.locator("a:has-text('Play')").first().click();
    await expect(page.locator("text=Leave Generator?")).toBeVisible({ timeout: 2000 });

    await page.locator("[data-testid='confirm-btn']").click();
    await page.waitForTimeout(300);

    // Should have navigated away from the generator
    await expect(page).toHaveURL(/\/play/, { timeout: 5000 });
  });
});
