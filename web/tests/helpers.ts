import { Page, Locator } from "@playwright/test";

/** Clear localStorage, reload, and wait for the app to be ready. */
export async function freshLoad(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("h1", { timeout: 10_000 });
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
