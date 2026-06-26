import { test, expect } from "@playwright/test";
import { freshLoad } from "./helpers";

async function openGenerateModal(page: Parameters<typeof freshLoad>[0]) {
  await page.locator("button:has-text('Generate puzzle…')").click();
  await expect(page.locator("p").filter({ hasText: /^Generate puzzle$/ })).toBeVisible();
}

test.describe("Generator", () => {
  test("'Generate puzzle…' button is visible in play page actions", async ({ page }) => {
    await freshLoad(page);
    await expect(page.locator("button:has-text('Generate puzzle…')")).toBeVisible();
  });

  test("modal opens with correct defaults", async ({ page }) => {
    await freshLoad(page);
    await openGenerateModal(page);

    // Default size 8×8
    await expect(page.locator("select")).toHaveValue("8");
    // Seed input is empty (placeholder "random")
    await expect(page.locator("input[placeholder='random']")).toHaveValue("");
    // Generate button visible, Play ▶ not yet visible
    await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeVisible();
    await expect(page.locator("button:has-text('Play ▶')")).not.toBeVisible();
  });

  test("generate shows loading then difficulty, Play ▶ loads puzzle", async ({ page }) => {
    await freshLoad(page);
    await openGenerateModal(page);

    // Use 4×4 for speed
    await page.selectOption("select", "4");
    await page.getByRole("button", { name: "Generate", exact: true }).click();

    // Loading state: button shows "Generating…"
    await expect(page.locator("button:has-text('Generating…')")).toBeVisible();

    // Wait for completion
    await expect(page.locator("button:has-text('Play ▶')")).toBeVisible({ timeout: 30_000 });

    // Difficulty shown in green
    const diffText = page.locator("p").filter({ hasText: "✓" });
    await expect(diffText).toBeVisible();

    // Click Play ▶ → closes modal, loads puzzle
    await page.click("button:has-text('Play ▶')");
    await expect(page.locator("p").filter({ hasText: /^Generate puzzle$/ })).not.toBeVisible();
    await expect(page.locator("button:has-text('Hint')")).toBeVisible();

    // Stored puzzle has 4 rows (4×4 board)
    const stored = await page.evaluate(() => localStorage.getItem("queens-puzzle-v1"));
    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.regions).toHaveLength(4);
  });

  test("re-generate button resets to idle", async ({ page }) => {
    await freshLoad(page);
    await openGenerateModal(page);

    await page.selectOption("select", "4");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.locator("button:has-text('Play ▶')")).toBeVisible({ timeout: 30_000 });

    // Click Re-generate → back to idle (Generate button, no Play ▶)
    await page.click("button:has-text('Re-generate')");
    await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeVisible();
    await expect(page.locator("button:has-text('Play ▶')")).not.toBeVisible();
    await expect(page.locator("p").filter({ hasText: "✓" })).not.toBeVisible();
  });

  test("same seed produces the same puzzle", async ({ page }) => {
    await freshLoad(page);

    // Generate with seed 42, size 4
    await openGenerateModal(page);
    await page.selectOption("select", "4");
    await page.fill("input[placeholder='random']", "42");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.locator("button:has-text('Play ▶')")).toBeVisible({ timeout: 30_000 });
    await page.click("button:has-text('Play ▶')");
    const json1 = await page.evaluate(() => localStorage.getItem("queens-puzzle-v1"));

    // Generate again with same seed
    await openGenerateModal(page);
    await page.selectOption("select", "4");
    await page.fill("input[placeholder='random']", "42");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.locator("button:has-text('Play ▶')")).toBeVisible({ timeout: 30_000 });
    await page.click("button:has-text('Play ▶')");
    const json2 = await page.evaluate(() => localStorage.getItem("queens-puzzle-v1"));

    expect(json1).toBeTruthy();
    expect(json1).toBe(json2);
  });

  test("invalid seed shows validation error", async ({ page }) => {
    await freshLoad(page);
    await openGenerateModal(page);

    await page.fill("input[placeholder='random']", "9999999999");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.locator("text=Must be an integer")).toBeVisible();
    // No worker started — still in idle, no loading
    await expect(page.locator("button:has-text('Generating…')")).not.toBeVisible();
  });

  test("cancel closes modal without loading a puzzle", async ({ page }) => {
    await freshLoad(page);
    const initialJson = await page.evaluate(() => localStorage.getItem("queens-puzzle-v1"));

    await openGenerateModal(page);
    await page.click("button:has-text('Cancel')");
    await expect(page.locator("p").filter({ hasText: /^Generate puzzle$/ })).not.toBeVisible();

    const afterJson = await page.evaluate(() => localStorage.getItem("queens-puzzle-v1"));
    expect(afterJson).toBe(initialJson);
  });
});
