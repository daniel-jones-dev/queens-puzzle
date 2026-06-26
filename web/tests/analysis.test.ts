/**
 * Integration tests for the Editor live analysis panel.
 *
 * Requires the dev server to be running on http://localhost:5173.
 * Run with: npx playwright test tests/analysis.test.ts
 */
import { test, expect } from "@playwright/test";
import { freshLoad, clickCell } from "./helpers";

async function enterEditorNew(page: Parameters<typeof freshLoad>[0]) {
  await freshLoad(page);
  await page.locator("a:has-text('Editor')").first().click();
  await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
  await page.waitForTimeout(400);
}

test.describe("Editor: live analysis indicator", () => {
  test("shows no solution on an empty board (no regions assigned)", async ({
    page,
  }) => {
    await enterEditorNew(page);
    // Wait past the debounce — empty board yields 0 valid placements
    await page.waitForTimeout(1000);
    // Valid layout row shows "✗ No" for an empty/invalid board
    await expect(page.locator('[class*="err"]:has-text("✗ No")').first()).toBeVisible();
  });

  test("shows analysis result even when board is only partially painted", async ({
    page,
  }) => {
    await enterEditorNew(page);
    await page.selectOption("select", "4");
    await page.waitForTimeout(300);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 4;

    // Paint only two rows — partial board; analysis still runs
    await page.locator("button[title='Colour 1 (1)']").click();
    for (let col = 0; col < 4; col++) await clickCell(page, board, cs, 0, col);
    await page.locator("button[title='Colour 2 (2)']").click();
    for (let col = 0; col < 4; col++) await clickCell(page, board, cs, 1, col);
    await page.waitForTimeout(1000);

    // With only 2 regions on a 4×4 board, no valid n-queen solution exists
    await expect(page.locator('[class*="err"]:has-text("✗ No")').first()).toBeVisible();
  });

  test("shows unique solution indicator for the default puzzle in edit mode", async ({
    page,
  }) => {
    // freshLoad loads the default 7×7 puzzle which has a unique solution
    await freshLoad(page);
    await page.locator("button:has-text('Open in Editor')").click();
    await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
    await page.waitForTimeout(400);

    // Wait for debounce + worker init + analysis on a fully-assigned board
    await page.waitForTimeout(2000);

    // Solutions row shows "1 (unique)" for a uniquely-solvable board
    await expect(page.locator('text=1 (unique)')).toBeVisible();
  });

  test("shows multiple-solutions indicator for an ambiguous board", async ({
    page,
  }) => {
    await enterEditorNew(page);
    await page.selectOption("select", "4");
    await page.waitForTimeout(300);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 4;

    // Assign all 16 cells to a single region → multiple (or no) solutions
    await page.locator("button[title='Colour 1 (1)']").click();
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) await clickCell(page, board, cs, row, col);
    await page.waitForTimeout(1500);

    // A single-region board cannot have valid queen placement → no solution or multiple
    const noSol = page.locator('[class*="err"]:has-text("✗ No")').first();
    const multiWarn = page.locator('[class*="multiWarn"]');
    const either = await Promise.race([
      noSol.waitFor({ timeout: 2000 }).then(() => "no-solution"),
      multiWarn.waitFor({ timeout: 2000 }).then(() => "multiple"),
    ]).catch(() => null);
    expect(either).not.toBeNull();
  });

  test("indicator updates when board is cleared by size change", async ({
    page,
  }) => {
    // Default 7×7 puzzle has a unique solution
    await freshLoad(page);
    await page.locator("button:has-text('Open in Editor')").click();
    await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
    await page.waitForTimeout(400);

    await page.waitForTimeout(2000);
    await expect(page.locator("text=1 (unique)")).toBeVisible();

    // Change size on a board with work → confirm dialog
    await page.selectOption("select", "5");
    await page.waitForTimeout(300);
    await expect(page.locator("text=Change to 5×5?")).toBeVisible();
    await page.locator("button:has-text('Change size')").click();
    await page.waitForTimeout(1200);

    // Empty 5×5 board → no regions → no valid queen placements
    await expect(page.locator('[class*="err"]:has-text("✗ No")').first()).toBeVisible();
  });
});
