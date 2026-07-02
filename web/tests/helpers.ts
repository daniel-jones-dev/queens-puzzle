import { Page, Locator } from "@playwright/test";

/** Clear localStorage, reload, and wait for the app to be ready. */
export async function freshLoad(page: Page) {
  await page.goto("play");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
  await page.waitForTimeout(1500);
}

/** Click a cell at (row, col) given the board element and its computed cell size. */
export async function clickCell(
  page: Page,
  board: Locator,
  cellSize: number,
  row: number,
  col: number,
) {
  const bb = await board.boundingBox();
  if (!bb) throw new Error("board not found");
  await page.mouse.click(
    bb.x + col * cellSize + cellSize / 2,
    bb.y + row * cellSize + cellSize / 2,
  );
  await page.waitForTimeout(30);
}

/**
 * Solve the current Play puzzle by repeatedly requesting and applying hints.
 * Stops when the solved banner appears or no more hints are available.
 */
export async function solveViaHints(page: Page) {
  const hintBtn = page.locator("button:has-text('Hint')");
  for (let i = 0; i < 50; i++) {
    if (await page.locator("text=Congratulations").isVisible()) break;
    if (!await hintBtn.isVisible()) break;
    await hintBtn.click();
    await page.waitForTimeout(600);
    const applyBtn = page.locator("button:has-text('Apply')").first();
    if (await applyBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await applyBtn.click();
      await page.waitForTimeout(200);
    } else {
      break;
    }
  }
}

/** Drag-paint across the entire first row of the board. */
export async function dragPaintFirstRow(page: Page, board: Locator) {
  const bb = await board.boundingBox();
  if (!bb) throw new Error("board not found");
  await page.mouse.move(bb.x + 5, bb.y + 5);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width - 5, bb.y + 5);
  await page.mouse.up();
  await page.waitForTimeout(150);
}
