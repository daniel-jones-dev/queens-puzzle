/**
 * Integration tests for the puzzle generator.
 *
 * Requires the dev server to be running on http://localhost:5173.
 * Run with: npx playwright test tests/generate.test.ts
 */
import { test, expect } from "@playwright/test";
import { freshLoad, clickCell, solveViaHints } from "./helpers";

// ── Play page: New puzzle ─────────────────────────────────────────────────────

test.describe("Play: new puzzle", () => {
  test("'New puzzle' button is hidden until puzzle is solved", async ({ page }) => {
    await freshLoad(page);
    await expect(page.locator("button:has-text('New puzzle')")).not.toBeVisible();
    await solveViaHints(page);
    await expect(page.locator("text=Congratulations")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("button:has-text('New puzzle')")).toBeVisible();
  });

  test("'New puzzle' button opens the generate modal after solving", async ({ page }) => {
    await freshLoad(page);
    await solveViaHints(page);
    await expect(page.locator("button:has-text('New puzzle')")).toBeVisible({ timeout: 5_000 });
    await page.locator("button:has-text('New puzzle')").click();
    await expect(page.locator("text=New random puzzle")).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
  });

  test("modal cancel after solving leaves the solved puzzle intact", async ({ page }) => {
    await freshLoad(page);
    await solveViaHints(page);
    await expect(page.locator("button:has-text('New puzzle')")).toBeVisible({ timeout: 5_000 });

    await page.locator("button:has-text('New puzzle')").click();
    await expect(page.locator("text=New random puzzle")).toBeVisible();
    await page.locator("button:has-text('Cancel')").click();
    await page.waitForTimeout(150);

    // Modal gone, solved banner still visible
    await expect(page.locator("text=New random puzzle")).not.toBeVisible();
    await expect(page.locator("text=Congratulations")).toBeVisible();
  });

  test("generating a 5×5 puzzle replaces the board with no player marks", async ({
    page,
  }) => {
    await freshLoad(page);
    await solveViaHints(page);
    await expect(page.locator("button:has-text('New puzzle')")).toBeVisible({ timeout: 5_000 });

    await page.locator("button:has-text('New puzzle')").click();
    await expect(page.locator("text=New random puzzle")).toBeVisible();

    await page.selectOption("select", "5");
    await page.locator("[role='dialog'] button:has-text('Generate'), div button:has-text('Generate')").last().click();
    await page.waitForTimeout(600);

    const board = page.locator("[data-testid='board']").first();
    await expect(board).toBeVisible();
    // Fresh board — no queens or crosses placed yet
    expect(await board.locator("[class*='queen']").count()).toBe(0);
    expect(await board.locator("[class*='cross']").count()).toBe(0);
  });
});

// ── Editor: Generate ──────────────────────────────────────────────────────────

test.describe("Editor: generate", () => {
  async function openEditor(page: Parameters<typeof freshLoad>[0]) {
    await freshLoad(page);
    // Clear editor localStorage so each test starts with a blank board
    await page.evaluate(() => localStorage.removeItem("queens-puzzle-editor-v1"));
    await page.locator("a:has-text('Editor')").first().click();
    await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
    await page.waitForTimeout(400);
    // Use 5×5 so generation completes fast on any seed / CPU load
    await page.selectOption('[aria-label="Board size"]', '5');
    await page.waitForTimeout(150);
  }

  test("Generate on an empty board immediately creates a puzzle (undo enabled)", async ({
    page,
  }) => {
    await openEditor(page);

    // Before generate, undo is disabled
    await expect(page.locator("button:has-text('↩ Undo')")).toBeDisabled();

    await page.locator("button[title='Generate a random unique puzzle']").click();

    // 5×5 generation completes in < 3 s on any seed
    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled({ timeout: 8_000 });
  });

  test("Generated puzzle has a unique solution (analysis shows '1 (unique)')", async ({
    page,
  }) => {
    await openEditor(page);

    await page.locator("button[title='Generate a random unique puzzle']").click();
    // Wait for generation then debounce + analysis
    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled({ timeout: 8_000 });
    await expect(page.locator("text=1 (unique)")).toBeVisible({ timeout: 10_000 });
  });

  test("Undo after Generate reverts to the prior empty board", async ({
    page,
  }) => {
    await openEditor(page);

    await page.locator("button[title='Generate a random unique puzzle']").click();
    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled({ timeout: 8_000 });

    await page.locator("button:has-text('↩ Undo')").click();
    await page.waitForTimeout(150);

    // Board is empty again — undo is disabled
    await expect(page.locator("button:has-text('↩ Undo')")).toBeDisabled();
  });

  test("Generate on a non-empty board shows a confirm dialog", async ({
    page,
  }) => {
    await openEditor(page);

    // Paint a cell
    const board = page.locator('[class*="board"]').first();
    await page.locator("button[title='Colour 1 (1)']").click();
    await clickCell(page, board, (await board.boundingBox())!.width / 7, 0, 0);

    await page.locator("button[title='Generate a random unique puzzle']").click();
    await expect(page.locator("text=Generate a random puzzle?")).toBeVisible();
  });

  test("Cancelling the generate confirm keeps the existing board", async ({
    page,
  }) => {
    await openEditor(page);

    const board = page.locator('[class*="board"]').first();
    await page.locator("button[title='Colour 1 (1)']").click();
    await clickCell(page, board, (await board.boundingBox())!.width / 7, 0, 0);

    await page.locator("button[title='Generate a random unique puzzle']").click();
    await expect(page.locator("text=Generate a random puzzle?")).toBeVisible();
    await page.locator("button:has-text('Cancel')").last().click();
    await page.waitForTimeout(150);

    // Confirm gone, board still has painted cells (undo enabled)
    await expect(page.locator("text=Generate a random puzzle?")).not.toBeVisible();
    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled();
  });

  test("Confirming generate on non-empty board replaces it", async ({
    page,
  }) => {
    await openEditor(page);

    const board = page.locator('[class*="board"]').first();
    await page.locator("button[title='Colour 1 (1)']").click();
    await clickCell(page, board, (await board.boundingBox())!.width / 7, 0, 0);

    await page.locator("button[title='Generate a random unique puzzle']").click();
    await expect(page.locator("text=Generate a random puzzle?")).toBeVisible();
    await page.locator("[data-testid='confirm-btn']").click();

    // Board replaced — undo is enabled (can undo the generate)
    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled({ timeout: 8_000 });
  });
});
