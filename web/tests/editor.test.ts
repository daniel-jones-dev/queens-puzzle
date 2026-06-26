/**
 * Integration tests for milestone 7: Custom puzzle editor.
 *
 * Requires the dev server to be running on http://localhost:5173.
 * Run with: npx playwright test
 */
import { test, expect } from "@playwright/test";
import { freshLoad, clickCell, dragPaintFirstRow } from "./helpers";

async function openInEditor(page: Parameters<typeof freshLoad>[0]) {
  await page.locator("button:has-text('Open in Editor')").click();
  await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
  await page.waitForTimeout(400);
}

async function newEditorPuzzle(page: Parameters<typeof freshLoad>[0]) {
  await page.locator("a:has-text('Editor')").first().click();
  await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
  await page.waitForTimeout(400);
}

test.describe("Editor: entry points", () => {
  test("'Open in Editor' shows EDITOR badge with palette", async ({
    page,
  }) => {
    await freshLoad(page);
    await openInEditor(page);

    await expect(page.getByText('EDITOR', { exact: true })).toBeVisible();
    // Default puzzle is 7×7 → 7 colour swatches
    expect(await page.locator("button[title^='Region']").count()).toBe(7);
    await expect(
      page.locator("button[title='Erase (unassign cell)']"),
    ).toBeVisible();
  });

  test("Editor tab starts with an empty board (no prior editor session)", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    await expect(page.getByText('EDITOR', { exact: true })).toBeVisible();
    // Shuffle is disabled until queens are scattered
    await expect(
      page.locator("button:has-text('Shuffle colours')"),
    ).toBeDisabled();
  });
});

test.describe("Editor: undo / back", () => {
  test("paint then undo removes the stroke as one action", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    const board = page.locator('[class*="board"]').first();

    await page.locator("button[title='Region 1']").click();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    // Single click on a cell that might already be region 1 — use a big offset
    await clickCell(page, board, bb.width / 7, 3, 3);

    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled();
    await page.locator("button:has-text('↩ Undo')").click();
    await page.waitForTimeout(150);
    await expect(page.locator("button:has-text('↩ Undo')")).toBeDisabled();
  });

  test("drag-paint is a single undo entry", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    const board = page.locator('[class*="board"]').first();
    await page.locator("button[title='Region 1']").click();
    await dragPaintFirstRow(page, board);

    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled();
    // One undo clears the whole drag
    await page.locator("button:has-text('↩ Undo')").click();
    await page.waitForTimeout(150);
    await expect(page.locator("button:has-text('↩ Undo')")).toBeDisabled();
  });

  test("'Open in Editor' clears cell states on entry", async ({ page }) => {
    await freshLoad(page);

    // Place a cross in play mode first
    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await expect(board.locator("[class*='cross']").first()).toBeVisible();

    // Enter edit mode — crosses should be cleared
    await openInEditor(page);

    await expect(page.getByText('EDITOR', { exact: true })).toBeVisible();
    await expect(page.locator("[class*='cross']")).toHaveCount(0);
  });
});

test.describe("Editor: scatter queens", () => {
  test("scatter on empty board needs no confirmation", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);

    // No confirm dialog — scatter happened immediately
    await expect(page.locator("text=Clear and scatter queens?")).not.toBeVisible();
    await expect(
      page.locator("button:has-text('Shuffle colours')"),
    ).toBeEnabled();
  });

  test("scatter after user edit shows confirmation", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    // First scatter (no confirm — nothing changed yet)
    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);

    // Paint the entire first row to guarantee a change regardless of which
    // cell scatter_queens placed region 0 on (clicking a single cell is
    // flaky when that cell already holds the selected colour).
    const board = page.locator('[class*="board"]').first();
    await page.locator("button[title='Region 1']").click();
    await dragPaintFirstRow(page, board);

    // Second scatter → confirm because board changed
    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Clear and scatter queens?")).toBeVisible();
    // Cancel
    await page.locator("button:has-text('Cancel')").last().click();
    await page.waitForTimeout(200);
    await expect(page.locator("text=Clear and scatter queens?")).not.toBeVisible();
  });

  test("scatter immediately after scatter needs no confirmation", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    // First scatter
    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);

    // Second scatter immediately — no changes made, so no confirm
    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Clear and scatter queens?")).not.toBeVisible();
    await expect(page.locator("button:has-text('Shuffle colours')")).toBeEnabled();
  });

  test("shuffle colours enabled after scatter, undo works", async ({
    page,
  }) => {
    await freshLoad(page);
    await openInEditor(page);

    // First scatter after entering edit: no confirm regardless of existing regions
    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Clear and scatter queens?")).not.toBeVisible();

    await page.locator("button:has-text('Shuffle colours')").click();
    await page.waitForTimeout(200);
    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled();
  });
});

test.describe("Editor: validation and play", () => {
  test("Play ▶ on incomplete board shows validation error", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    // Paint only one row — board is incomplete
    await page.locator("button[title='Region 1']").click();
    const board = page.locator('[class*="board"]').first();
    await dragPaintFirstRow(page, board);

    await page.locator("button:has-text('Play ▶')").click();
    await page.waitForTimeout(300);
    await expect(
      page.locator("text=Some cells have no region assigned"),
    ).toBeVisible();
  });

  test("Play ▶ on valid board shows confirm, then loads play mode", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    // Switch to 4×4 for ease
    await page.selectOption("select", "4");
    await page.waitForTimeout(300);
    expect(await page.locator("button[title^='Region']").count()).toBe(4);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 4;

    // Fill all 16 cells, one row per colour
    for (let row = 0; row < 4; row++) {
      await page.locator(`button[title='Region ${row + 1}']`).click();
      await page.waitForTimeout(20);
      for (let col = 0; col < 4; col++) {
        await clickCell(page, board, cs, row, col);
      }
    }
    await page.waitForTimeout(200);

    await page.locator("button:has-text('Play ▶')").click();
    await page.waitForTimeout(400);
    await expect(page.locator("text=Play this puzzle?")).toBeVisible();

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
    await page.waitForTimeout(600);

    // Now in play mode
    await expect(page.getByText('EDITOR', { exact: true })).not.toBeVisible();
    await expect(page.locator("button:has-text('Hint')")).toBeVisible();
  });

  test("hints work on an editor-created 4×4 puzzle", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    await page.selectOption("select", "4");
    await page.waitForTimeout(300);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 4;

    for (let row = 0; row < 4; row++) {
      await page.locator(`button[title='Region ${row + 1}']`).click();
      await page.waitForTimeout(20);
      for (let col = 0; col < 4; col++) {
        await clickCell(page, board, cs, row, col);
      }
    }

    await page.locator("button:has-text('Play ▶')").click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
    await page.waitForTimeout(600);

    await page.locator("button:has-text('Hint')").click();
    await page.waitForTimeout(600);
    const hintShown =
      (await page.locator("text=💡").isVisible()) ||
      (await page.locator("text=No logical step").isVisible());
    expect(hintShown).toBe(true);
  });
});

test.describe("Editor: size picker and export", () => {
  test("size picker on empty board changes immediately without confirm", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    await page.selectOption("select", "4");
    await page.waitForTimeout(300);
    expect(await page.locator("button[title^='Region']").count()).toBe(4);
    await expect(
      page.locator("button:has-text('Shuffle colours')"),
    ).toBeDisabled();

    await page.selectOption("select", "6");
    await page.waitForTimeout(300);
    expect(await page.locator("button[title^='Region']").count()).toBe(6);
    await expect(
      page.locator("button:has-text('Shuffle colours')"),
    ).toBeDisabled();
  });

  test("size picker on non-empty board shows confirm dialog", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    // Paint a cell to make the board non-empty
    const board = page.locator('[class*="board"]').first();
    await page.locator("button[title='Region 1']").click();
    await clickCell(page, board, (await board.boundingBox())!.width / 7, 0, 0);
    await page.waitForTimeout(100);

    // Size change → confirm
    await page.selectOption("select", "4");
    await page.waitForTimeout(300);
    await expect(page.locator("text=Change to 4×4?")).toBeVisible();

    // Cancel → size stays at 7
    await page.locator("button:has-text('Cancel')").last().click();
    await page.waitForTimeout(200);
    expect(await page.locator("button[title^='Region']").count()).toBe(7);

    // Confirm → size changes to 4
    await page.selectOption("select", "4");
    await page.waitForTimeout(300);
    await page.locator("button:has-text('Change size')").click();
    await page.waitForTimeout(300);
    expect(await page.locator("button[title^='Region']").count()).toBe(4);
  });

  test("Export JSON button is present and clickable", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    await expect(
      page.locator("button:has-text('Export JSON')"),
    ).toBeVisible();
    await page.locator("button:has-text('Export JSON')").click();
    // No crash — that's the assertion
  });
});
