/**
 * Integration tests for the Editor page.
 *
 * Requires the dev server to be running on http://localhost:5173.
 * Run with: npx playwright test tests/editor.test.ts
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

// ── Entry points ─────────────────────────────────────────────────────────────

test.describe("Editor: entry points", () => {
  test("'Open in Editor' shows colour swatches matching puzzle size", async ({
    page,
  }) => {
    await freshLoad(page);
    await openInEditor(page);

    // Default puzzle is 7×7 → 7 colour swatches
    expect(await page.locator("button[title^='Colour']").count()).toBe(7);
    // Wand tool is present
    await expect(page.locator("button[title^='Extend colour']")).toBeVisible();
  });

  test("Editor tab navigated directly starts with a fresh board and undo disabled", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    // Undo is disabled on a fresh empty board
    await expect(page.locator("button:has-text('↩ Undo')")).toBeDisabled();
  });

  test("'Open in Editor' clears player cell states", async ({ page }) => {
    await freshLoad(page);

    // Place a cross in play mode first
    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await expect(board.locator("[class*='cross']").first()).toBeVisible();

    // Enter edit mode — crosses should be cleared
    await openInEditor(page);
    await expect(page.locator("[class*='cross']")).toHaveCount(0);
  });
});

// ── Undo ─────────────────────────────────────────────────────────────────────

test.describe("Editor: undo", () => {
  test("paint then undo removes the stroke as one action", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    const board = page.locator('[class*="board"]').first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");

    await page.locator("button[title='Colour 1 (1)']").click();
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
    await page.locator("button[title='Colour 1 (1)']").click();
    await dragPaintFirstRow(page, board);

    await expect(page.locator("button:has-text('↩ Undo')")).toBeEnabled();
    // One undo clears the whole drag
    await page.locator("button:has-text('↩ Undo')").click();
    await page.waitForTimeout(150);
    await expect(page.locator("button:has-text('↩ Undo')")).toBeDisabled();
  });
});

// ── Shuffle queens ────────────────────────────────────────────────────────────

test.describe("Editor: shuffle queens", () => {
  test("shuffle queens on an unpainted board places no queens", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    // Board is fully unassigned — shuffle has nothing to do
    await page.locator("button:has-text('Shuffle queens')").click();
    await page.waitForTimeout(200);

    // No queens should appear
    const board = page.locator("[data-testid='board']").first();
    const queenCount = await board.locator('[class*="queen"]').count();
    expect(queenCount).toBe(0);
    // Undo should also be disabled (no change was made)
    await expect(page.locator("button:has-text('↩ Undo')")).toBeDisabled();
  });

  test("shuffle queens places exactly one queen per painted region", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    await page.selectOption("select", "4");
    await page.waitForTimeout(300);

    const board = page.locator("[data-testid='board']").first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 4;

    // Paint two rows with two distinct colours → 2 regions
    await page.locator("button[title='Colour 1 (1)']").click();
    for (let col = 0; col < 4; col++) await clickCell(page, board, cs, 0, col);
    await page.locator("button[title='Colour 2 (2)']").click();
    for (let col = 0; col < 4; col++) await clickCell(page, board, cs, 1, col);

    await page.locator("button:has-text('Shuffle queens')").click();
    await page.waitForTimeout(200);

    // Exactly 2 queens placed (one per region)
    const queenCount = await board.locator('[class*="queen"]').count();
    expect(queenCount).toBe(2);

    // Undo reverts all queens
    await page.locator("button:has-text('↩ Undo')").click();
    await page.waitForTimeout(150);
    const queenCountAfterUndo = await board.locator('[class*="queen"]').count();
    expect(queenCountAfterUndo).toBe(0);
  });

  test("shuffle queens clears existing queens before placing new ones", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    const board = page.locator("[data-testid='board']").first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 7;

    // Paint two regions on the default 7×7 board
    await page.locator("button[title='Colour 1 (1)']").click();
    for (let col = 0; col < 7; col++) await clickCell(page, board, cs, 0, col);
    await page.locator("button[title='Colour 2 (2)']").click();
    for (let col = 0; col < 7; col++) await clickCell(page, board, cs, 1, col);

    // Shuffle once → 2 queens
    await page.locator("button:has-text('Shuffle queens')").click();
    await page.waitForTimeout(200);
    expect(await board.locator('[class*="queen"]').count()).toBe(2);

    // Shuffle again → still exactly 2 queens (old queens cleared)
    await page.locator("button:has-text('Shuffle queens')").click();
    await page.waitForTimeout(200);
    expect(await board.locator('[class*="queen"]').count()).toBe(2);
  });
});

// ── Size picker ───────────────────────────────────────────────────────────────

test.describe("Editor: size picker", () => {
  test("size picker on empty board changes immediately without confirm", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    await page.selectOption("select", "4");
    await page.waitForTimeout(300);
    expect(await page.locator("button[title^='Colour']").count()).toBe(4);

    await page.selectOption("select", "6");
    await page.waitForTimeout(300);
    expect(await page.locator("button[title^='Colour']").count()).toBe(6);
  });

  test("size picker on non-empty board shows confirm dialog", async ({
    page,
  }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    // Paint a cell to make the board non-empty
    const board = page.locator('[class*="board"]').first();
    await page.locator("button[title='Colour 1 (1)']").click();
    await clickCell(page, board, (await board.boundingBox())!.width / 7, 0, 0);
    await page.waitForTimeout(100);

    // Size change → confirm
    await page.selectOption("select", "4");
    await page.waitForTimeout(300);
    await expect(page.locator("text=Change to 4×4?")).toBeVisible();

    // Cancel → size stays at 7
    await page.locator("button:has-text('Cancel')").last().click();
    await page.waitForTimeout(200);
    expect(await page.locator("button[title^='Colour']").count()).toBe(7);

    // Confirm → size changes to 4
    await page.selectOption("select", "4");
    await page.waitForTimeout(300);
    await page.locator("button:has-text('Change size')").click();
    await page.waitForTimeout(300);
    expect(await page.locator("button[title^='Colour']").count()).toBe(4);
  });
});

// ── Export ────────────────────────────────────────────────────────────────────

test.describe("Editor: export", () => {
  test("Share / Export button is present and clickable", async ({ page }) => {
    await freshLoad(page);
    await newEditorPuzzle(page);

    await expect(page.locator("button:has-text('Share / Export')")).toBeVisible();
    // Clicking doesn't crash (clipboard write may fail in headless, that's OK)
    await page.locator("button:has-text('Share / Export')").click();
    await page.waitForTimeout(300);
  });
});
