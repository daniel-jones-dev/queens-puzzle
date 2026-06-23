/**
 * Integration tests for milestone 7: Custom puzzle editor.
 *
 * Requires the dev server to be running on http://localhost:5173.
 * Run with: npx playwright test
 */
import { test, expect } from "@playwright/test";
import { freshLoad, clickCell, dragPaintFirstRow } from "./helpers";

test.describe("Editor: entry points", () => {
  test("'Edit this puzzle' shows EDITOR badge with palette", async ({
    page,
  }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=Edit this puzzle").click();
    await page.waitForTimeout(400);

    await expect(page.locator("text=EDITOR")).toBeVisible();
    // Default puzzle is 7×7 → 7 colour swatches
    expect(await page.locator("button[title^='Region']").count()).toBe(7);
    await expect(
      page.locator("button[title='Erase (unassign cell)']"),
    ).toBeVisible();
  });

  test("'New puzzle (Editor)…' starts with an empty board", async ({
    page,
  }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

    await expect(page.locator("text=EDITOR")).toBeVisible();
    // Shuffle is disabled until queens are scattered
    await expect(
      page.locator("button:has-text('Shuffle colours')"),
    ).toBeDisabled();
  });
});

test.describe("Editor: undo / back", () => {
  test("paint then undo removes the stroke as one action", async ({ page }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=Edit this puzzle").click();
    await page.waitForTimeout(400);

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
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

    const board = page.locator('[class*="board"]').first();
    await page.locator("button[title='Region 1']").click();
    await dragPaintFirstRow(page, board);

    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled();
    // One undo clears the whole drag
    await page.locator("button:has-text('↩ Undo')").click();
    await page.waitForTimeout(150);
    await expect(page.locator("button:has-text('↩ Undo')")).toBeDisabled();
  });

  test("'Edit this puzzle' clears cell states on entry", async ({ page }) => {
    await freshLoad(page);

    // Place a cross in play mode first
    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await expect(board.locator("[class*='cross']").first()).toBeVisible();

    // Enter edit mode — crosses should be cleared
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=Edit this puzzle").click();
    await page.waitForTimeout(400);

    await expect(page.locator("text=EDITOR")).toBeVisible();
    await expect(board.locator("[class*='cross']")).toHaveCount(0);
  });
});

test.describe("Editor: scatter queens", () => {
  test("scatter on empty board needs no confirmation", async ({ page }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);

    // No confirm dialog — scatter happened immediately
    await expect(page.locator("text=Clear and scatter queens?")).not.toBeVisible();
    await expect(
      page.locator("button:has-text('Shuffle colours')"),
    ).toBeEnabled();
  });

  test("scatter on non-empty board shows confirmation", async ({ page }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

    // First scatter (no confirm)
    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);

    // Second scatter → confirm
    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Clear and scatter queens?")).toBeVisible();
    // Cancel
    await page.locator("button:has-text('Cancel')").last().click();
    await page.waitForTimeout(200);
    await expect(page.locator("text=Clear and scatter queens?")).not.toBeVisible();
  });

  test("shuffle colours enabled after scatter, undo works", async ({
    page,
  }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=Edit this puzzle").click();
    await page.waitForTimeout(400);

    await page.locator("button:has-text('Scatter queens')").click();
    await page.waitForTimeout(300);
    // May show confirm if puzzle was non-empty
    if (await page.locator("text=Clear and scatter queens?").isVisible()) {
      await page.getByRole("button", { name: "Scatter", exact: true }).click();
      await page.waitForTimeout(300);
    }

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
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

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
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

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
    await page.waitForTimeout(600);

    // Now in play mode
    await expect(page.locator("text=EDITOR")).not.toBeVisible();
    await expect(page.locator("button:has-text('Hint')")).toBeVisible();
  });

  test("hints work on an editor-created 4×4 puzzle", async ({ page }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

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
  test("size picker updates palette and resets board", async ({ page }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

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

  test("Export JSON button is present and clickable", async ({ page }) => {
    await freshLoad(page);
    await page.click("button[title='Settings']");
    await page.waitForTimeout(300);
    await page.locator("text=New puzzle (Editor)…").click();
    await page.waitForTimeout(400);

    await expect(
      page.locator("button:has-text('Export JSON')"),
    ).toBeVisible();
    await page.locator("button:has-text('Export JSON')").click();
    // No crash — that's the assertion
  });
});
