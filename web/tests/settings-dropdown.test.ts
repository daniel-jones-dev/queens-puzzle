/**
 * Regression tests: the Settings dropdown must open downward (below the button)
 * on both Play and Solve pages.
 */
import { test, expect } from "@playwright/test";
import { freshLoad } from "./helpers";

const DEFAULT_PUZZLE_JSON = JSON.stringify({
  regions: [
    [0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 2],
    [3, 3, 3, 3, 3, 3, 2],
    [3, 3, 3, 3, 4, 4, 4],
    [3, 5, 3, 3, 4, 4, 4],
    [3, 3, 3, 6, 4, 4, 4],
    [3, 3, 3, 6, 4, 4, 4],
  ],
});

test.describe("Settings dropdown direction", () => {
  test("Play page: settings panel opens below the button", async ({ page }) => {
    await freshLoad(page);

    const btn = page.locator('button[aria-label="Settings"]');
    await expect(btn).toBeVisible();
    const btnBox = await btn.boundingBox();
    if (!btnBox) throw new Error("Settings button not found");

    await btn.click();

    const panel = page.locator('[class*="panel"]').filter({ hasText: "Show clock" });
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    if (!panelBox) throw new Error("Settings panel not found");

    // Panel top edge must be below button bottom edge
    expect(panelBox.y).toBeGreaterThan(btnBox.y + btnBox.height);
  });

  test("Solve page: settings panel opens below the button", async ({ page }) => {
    await page.goto("solve");
    await page.evaluate((json) => {
      localStorage.setItem("queens-puzzle-v1", json);
    }, DEFAULT_PUZZLE_JSON);
    await page.reload();
    await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
    await page.waitForTimeout(800);

    const btn = page.locator('button[aria-label="Settings"]');
    await expect(btn).toBeVisible();
    const btnBox = await btn.boundingBox();
    if (!btnBox) throw new Error("Settings button not found");

    await btn.click();

    const panel = page.locator('[class*="panel"]').filter({ hasText: "Show clock" });
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    if (!panelBox) throw new Error("Settings panel not found");

    // Panel top edge must be below button bottom edge
    expect(panelBox.y).toBeGreaterThan(btnBox.y + btnBox.height);
  });
});
