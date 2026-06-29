/**
 * Integration tests for the Solver page.
 *
 * Requires the dev server to be running on http://localhost:5173.
 * Run with: npx playwright test tests/solve.test.ts
 */
import { test, expect, Page, Locator } from "@playwright/test";
import { freshLoad, clickCell } from "./helpers";

// The default 7×7 puzzle JSON (matches DEFAULT_JSON in PlayPage.tsx)
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

/** The desktop rules panel (always rendered but hidden on mobile). Scoped to avoid
 *  conflicts with the duplicate mobile panel that is `display: none` at desktop width. */
function desktopPanel(page: Page): Locator {
  return page.locator('[class*="desktopRules"]');
}

/** Navigate to /play via freshLoad, then click "Open in Solver". */
async function openSolverFromPlay(page: Page) {
  await freshLoad(page);
  await page.locator("button:has-text('Open in Solver')").click();
  await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
  await page.waitForTimeout(800);
}

/** Seed localStorage with the default puzzle and navigate directly to /solve. */
async function directToSolver(page: Page) {
  await page.goto("solve");
  await page.evaluate(
    ([key, json]) => localStorage.setItem(key, json),
    ["queens-puzzle-v1", DEFAULT_PUZZLE_JSON],
  );
  await page.reload();
  await page.waitForSelector("[data-testid='board']", { timeout: 10_000 });
  await page.waitForTimeout(800);
}

// ── Loading / navigation ────────────────────────────────────────────────────

test.describe("Solver page: loading", () => {
  test("shows empty state when no puzzle is in storage and no navigation state", async ({
    page,
  }) => {
    await page.goto("solve");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.locator("text=No puzzle loaded")).toBeVisible();
  });

  test("loads puzzle from localStorage when navigating directly to /solve", async ({
    page,
  }) => {
    await directToSolver(page);
    await expect(page.locator("[data-testid='board']")).toBeVisible();
    await expect(desktopPanel(page).locator('[class*="rulesTitle"]')).toBeVisible();
  });

  test("loads puzzle via 'Open in Solver' from Play page", async ({ page }) => {
    await openSolverFromPlay(page);
    await expect(page.locator("[data-testid='board']")).toBeVisible();
    await expect(desktopPanel(page).locator('[class*="rulesTitle"]')).toBeVisible();
  });
});

// ── Rules panel ─────────────────────────────────────────────────────────────

test.describe("Solver page: rules panel", () => {
  test("shows all four rule categories", async ({ page }) => {
    await openSolverFromPlay(page);
    const panel = desktopPanel(page);
    await expect(panel.locator("text=Basic")).toBeVisible();
    await expect(panel.locator("text=Easy")).toBeVisible();
    await expect(panel.locator("text=Medium")).toBeVisible();
    await expect(panel.locator("text=Hard")).toBeVisible();
  });

  test("highlights an active rule with description when a deduction is available", async ({
    page,
  }) => {
    await openSolverFromPlay(page);
    // At least one rule should be active (default puzzle has immediate deductions)
    const activeRule = desktopPanel(page).locator('[class*="ruleItemActive"]').first();
    await expect(activeRule).toBeVisible();
    // The description paragraph is inside the active rule
    const desc = activeRule.locator('[class*="ruleDesc"]').first();
    await expect(desc).toBeVisible();
    const descText = await desc.textContent();
    expect(descText?.trim().length).toBeGreaterThan(0);
  });

  test("shows 'Apply step →' button inside the active rule", async ({
    page,
  }) => {
    await openSolverFromPlay(page);
    await expect(
      desktopPanel(page).locator("button:has-text('Apply step')").first(),
    ).toBeVisible();
  });
});

// ── Apply step ──────────────────────────────────────────────────────────────

test.describe("Solver page: apply step", () => {
  test("Apply changes the board and advances to the next deduction", async ({
    page,
  }) => {
    await openSolverFromPlay(page);

    const board = page.locator("[data-testid='board']").first();

    // Board starts completely empty (no queens or crosses)
    expect(await board.locator('[class*="queen"]').count()).toBe(0);

    // Apply the first step
    await desktopPanel(page).locator("button:has-text('Apply step')").first().click();
    await page.waitForTimeout(300);

    // After applying, at least one cell should be placed (queen or cross)
    const queensAfter = await board.locator('[class*="queen"]').count();
    const crossesAfter = await board.locator('[class*="cross"]').count();
    expect(queensAfter + crossesAfter).toBeGreaterThan(0);
  });

  test("hint description changes after Apply completes all changes", async ({
    page,
  }) => {
    await openSolverFromPlay(page);

    const panel = desktopPanel(page);
    const activeRule = panel.locator('[class*="ruleItemActive"]').first();
    const descBefore = await activeRule.locator('[class*="ruleDesc"]').textContent();

    // Apply the first step — all its changes are applied atomically
    await panel.locator("button:has-text('Apply step')").first().click();
    await page.waitForTimeout(300);

    // Active rule description should have changed (or Apply button gone if solved)
    const descAfter = await panel
      .locator('[class*="ruleItemActive"]')
      .first()
      .locator('[class*="ruleDesc"]')
      .textContent()
      .catch(() => null);
    expect(descAfter).not.toBe(descBefore);
  });
});

// ── Hint freeze ─────────────────────────────────────────────────────────────

test.describe("Solver page: hint freeze", () => {
  test("hint stays frozen when only part of its changes are manually applied", async ({
    page,
  }) => {
    await openSolverFromPlay(page);

    const panel = desktopPanel(page);
    const board = page.locator("[data-testid='board']").first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 7;

    // Apply the first step (MarkQueen for the singleton region at row 4, col 1).
    // This advances to the second step: MarkEmpty for cells sharing the queen's row/col.
    await panel.locator("button:has-text('Apply step')").first().click();
    await page.waitForTimeout(300);

    // Record the second-step description.
    const activeRule = panel.locator('[class*="ruleItemActive"]').first();
    const descBefore = await activeRule.locator('[class*="ruleDesc"]').textContent();
    expect(descBefore).toBeTruthy();

    // Manually mark ONE cell in the queen's row (row 4, col 0) as empty.
    // This is one of many MarkEmpty changes — applying it alone should NOT advance the hint.
    await clickCell(page, board, cs, 4, 0);
    await page.waitForTimeout(200);

    // Hint should still be the same MarkEmpty description.
    const descAfter = await activeRule.locator('[class*="ruleDesc"]').textContent();
    expect(descAfter).toBe(descBefore);
  });
});

// ── Undo / Redo ─────────────────────────────────────────────────────────────

test.describe("Solver page: undo / redo", () => {
  test("Undo reverts an applied step and restores the previous hint", async ({
    page,
  }) => {
    await openSolverFromPlay(page);

    const panel = desktopPanel(page);
    const board = page.locator("[data-testid='board']").first();

    const descFirst = await panel
      .locator('[class*="ruleItemActive"]')
      .first()
      .locator('[class*="ruleDesc"]')
      .textContent();

    // Apply the first step
    await panel.locator("button:has-text('Apply step')").first().click();
    await page.waitForTimeout(300);

    // Board should now have placements
    const placedAfterApply = await board.locator('[class*="queen"], [class*="cross"]').count();
    expect(placedAfterApply).toBeGreaterThan(0);

    // Undo
    await page.locator("button:has-text('Undo')").click();
    await page.waitForTimeout(300);

    // Board should be empty again
    const placedAfterUndo = await board.locator('[class*="queen"], [class*="cross"]').count();
    expect(placedAfterUndo).toBe(0);

    // Hint description should be back to the first step
    const descAfterUndo = await panel
      .locator('[class*="ruleItemActive"]')
      .first()
      .locator('[class*="ruleDesc"]')
      .textContent();
    expect(descAfterUndo).toBe(descFirst);
  });

  test("Redo re-applies an undone step", async ({ page }) => {
    await openSolverFromPlay(page);

    const panel = desktopPanel(page);
    const board = page.locator("[data-testid='board']").first();

    // Apply → Undo → Redo sequence
    await panel.locator("button:has-text('Apply step')").first().click();
    await page.waitForTimeout(300);

    const placedAfterApply = await board.locator('[class*="queen"], [class*="cross"]').count();

    await page.locator("button:has-text('Undo')").click();
    await page.waitForTimeout(300);
    await expect(page.locator("button:has-text('Redo')")).not.toBeDisabled();

    await page.locator("button:has-text('Redo')").click();
    await page.waitForTimeout(300);

    // Should be back to the post-apply cell count
    const placedAfterRedo = await board.locator('[class*="queen"], [class*="cross"]').count();
    expect(placedAfterRedo).toBe(placedAfterApply);
  });

  test("Undo is disabled on a fresh board (no history)", async ({ page }) => {
    await openSolverFromPlay(page);
    await expect(page.locator("button:has-text('Undo')")).toBeDisabled();
  });

  test("Redo is disabled when nothing has been undone", async ({ page }) => {
    await openSolverFromPlay(page);
    await expect(page.locator("button:has-text('Redo')")).toBeDisabled();
  });
});

// ── Cell interaction ────────────────────────────────────────────────────────

test.describe("Solver page: cell interaction", () => {
  test("clicking an empty cell places a cross, then clicking the cross places a queen", async ({
    page,
  }) => {
    await openSolverFromPlay(page);

    const board = page.locator("[data-testid='board']").first();
    const bb = await board.boundingBox();
    if (!bb) throw new Error("board not found");
    const cs = bb.width / 7;

    // First click on empty cell → cross
    await clickCell(page, board, cs, 0, 0);
    await expect(board.locator('[class*="cross"]').first()).toBeVisible();

    // Second click on cross → queen
    await clickCell(page, board, cs, 0, 0);
    const queenEl = board
      .locator('[class*="queen"]')
      .or(board.locator('[class*="queenClash"]'))
      .first();
    await expect(queenEl).toBeVisible();

    // Third click on queen → empty again
    await clickCell(page, board, cs, 0, 0);
    const crossCount = await board.locator('[class*="cross"]').count();
    const queenCount = await board.locator('[class*="queen"]').count();
    expect(crossCount + queenCount).toBe(0);
  });
});

// ── Continue in Play ────────────────────────────────────────────────────────

test.describe("Solver page: navigation", () => {
  test("'Continue in Play →' navigates back to the Play page with board intact", async ({
    page,
  }) => {
    await openSolverFromPlay(page);

    // Make a change so the board has some state to persist
    await desktopPanel(page).locator("button:has-text('Apply step')").first().click();
    await page.waitForTimeout(300);

    await page.locator("button:has-text('Continue in Play')").click();
    await page.waitForURL("**/play", { timeout: 5_000 });
    await expect(page.locator("[data-testid='board']")).toBeVisible();
  });
});
