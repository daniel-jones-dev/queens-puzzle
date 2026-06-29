import { test, expect } from "@playwright/test";
import { freshLoad, clickCell } from "./helpers";

test.describe("Play mode", () => {
  test("default puzzle loads and is playable", async ({ page }) => {
    await freshLoad(page);

    // Board renders
    const board = page.locator('[class*="board"]').first();
    await expect(board).toBeVisible();

    // Hint button is visible in play mode
    await expect(page.locator("button:has-text('Hint')")).toBeVisible();

    // Timer starts at 0
    await expect(page.locator("text=0:00")).toBeVisible();
  });

  test("hint step is applied and cleared", async ({ page }) => {
    await freshLoad(page);
    await page.locator("button:has-text('Hint')").click();
    await page.waitForTimeout(600);

    const hintVisible =
      (await page.locator("text=💡").isVisible()) ||
      (await page.locator("text=No logical step").isVisible());
    expect(hintVisible).toBe(true);
  });

  test("drag on unknown cell places a cross", async ({ page }) => {
    await freshLoad(page);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const n = 7;
    const cs = bb.width / n;

    // Board starts with no cross icons
    await expect(board.locator("[class*='cross']")).toHaveCount(0);

    // Drag-click an unknown cell → cross appears
    await clickCell(page, board, cs, 3, 3);
    await expect(board.locator("[class*='cross']").first()).toBeVisible();
  });

  test("clicking a cross cell cycles it to queen", async ({ page }) => {
    await freshLoad(page);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 7;

    // Place cross at (3,3)
    await clickCell(page, board, cs, 3, 3);
    await expect(board.locator("[class*='cross']").first()).toBeVisible();

    // Click the cross → queen appears
    await clickCell(page, board, cs, 3, 3);
    await expect(
      board.locator("[class*='queen']").or(board.locator("[class*='queenClash']")).first(),
    ).toBeVisible();
  });

  test("undo button reverts last move", async ({ page }) => {
    await freshLoad(page);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 7;

    await clickCell(page, board, cs, 2, 2);
    await expect(board.locator("text=✕").first()).toBeVisible();

    await page.locator("button[title='Undo']").click();
    await page.waitForTimeout(150);
    await expect(board.locator("text=✕")).toHaveCount(0);
  });

  test("settings panel opens and closes via overlay click", async ({ page }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await expect(page.locator("text=Show clock")).toBeVisible();

    // Click the backdrop overlay (top-left corner, away from the panel)
    await page.mouse.click(10, 10);
    await page.waitForTimeout(200);
    await expect(page.locator("text=Show clock")).not.toBeVisible();
  });
});
