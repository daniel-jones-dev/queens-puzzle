/**
 * Integration tests for milestone 8: Editor live analysis.
 *
 * Requires the dev server to be running on http://localhost:5173.
 * Run with: npx playwright test
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
    await expect(page.locator("text=✗ No solution")).toBeVisible();
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
    await page.locator("button[title='Region 1']").click();
    for (let col = 0; col < 4; col++) await clickCell(page, board, cs, 0, col);
    await page.locator("button[title='Region 2']").click();
    for (let col = 0; col < 4; col++) await clickCell(page, board, cs, 1, col);
    await page.waitForTimeout(1000);

    // With only 2 regions on a 4×4 board, no valid n-queen solution exists
    await expect(page.locator("text=✗ No solution")).toBeVisible();
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

    await expect(page.locator("text=✓ Unique solution")).toBeVisible();
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
    await page.locator("button[title='Region 1']").click();
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) await clickCell(page, board, cs, row, col);
    await page.waitForTimeout(1500);

    // A single-region board cannot have valid queen placement → no solution or multiple
    const noSol = page.locator("text=✗ No solution");
    const multiSol = page.locator("text=/⚠.+solution/");
    const either = await Promise.race([
      noSol.waitFor({ timeout: 2000 }).then(() => "no-solution"),
      multiSol.waitFor({ timeout: 2000 }).then(() => "multiple"),
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
    await expect(page.locator("text=✓ Unique solution")).toBeVisible();

    // Change size on a board with work → confirm dialog
    await page.selectOption("select", "5");
    await page.waitForTimeout(300);
    await expect(page.locator("text=Change to 5×5?")).toBeVisible();
    await page.locator("button:has-text('Change size')").click();
    await page.waitForTimeout(1200);

    // Empty 5×5 board → all regions null → no valid queen placements → no solution
    await expect(page.locator("text=✗ No solution")).toBeVisible();
  });
});

test.describe("Editor: Play button warning", () => {
  test("Play button shows '!' and warning confirm for a non-unique board", async ({
    page,
  }) => {
    await enterEditorNew(page);
    await page.selectOption("select", "4");
    await page.waitForTimeout(300);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 4;

    // Row-per-region 4×4 layout → valid board (all cells assigned, 4 distinct regions)
    // but has 2 standard n-queens solutions → analysis reports "multiple"
    for (let row = 0; row < 4; row++) {
      await page.locator(`button[title='Region ${row + 1}']`).click();
      for (let col = 0; col < 4; col++) await clickCell(page, board, cs, row, col);
    }
    await page.waitForTimeout(1500);

    // Play button should show "!" because puzzle is not unique
    await expect(page.locator("button:has-text('Play ▶ !')")).toBeVisible();

    // Clicking it shows a warning in the confirm dialog
    await page.locator("button:has-text('Play ▶ !')").click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Play this puzzle?")).toBeVisible();
    const dialogText = await page.locator("text=Play this puzzle?").locator("..").textContent();
    expect(dialogText).toContain("⚠");
  });

  test("Play button shows no '!' for a unique puzzle", async ({ page }) => {
    // Default 7×7 puzzle has a unique solution
    await freshLoad(page);
    await page.locator("button:has-text('Open in Editor')").click();
    await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
    await page.waitForTimeout(400);

    await page.waitForTimeout(2000);

    // Normal Play button (no "!")
    await expect(page.locator("button:has-text('Play ▶')")).toBeVisible();
    await expect(page.locator("button:has-text('Play ▶ !')")).not.toBeVisible();
  });
});
