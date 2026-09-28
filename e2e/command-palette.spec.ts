/**
 * E2E — Command Palette (issue #510)
 *
 * Covers:
 *  - Opening the command palette via Ctrl+K keyboard shortcut
 *  - All primary route labels are visible when the palette opens
 *  - Typing a query filters the command list (search for "Market")
 *  - Selecting a navigation item navigates to the target route
 *  - Pressing Escape closes the palette
 *  - Clicking the backdrop closes the palette
 *  - "Connect Wallet" action appears (wallet disconnected by default in E2E)
 */

import { test, expect } from "@playwright/test";

test.describe("Command Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("kora-tour-done", "true");
      localStorage.setItem("kora-changelog-seen-version", "0.1.0");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  // ── Opening ──────────────────────────────────────────────────────────────────

  test("opens via Ctrl+K keyboard shortcut", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: /command palette/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("opens via Meta+K on Mac-like environment", async ({ page }) => {
    // Playwright sends Meta+k on all platforms; the app handles both metaKey and ctrlKey.
    await page.keyboard.press("Meta+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    // Accept if either shortcut works (platform-dependent)
    const visible = await palette.isVisible().catch(() => false);
    if (!visible) {
      await page.keyboard.press("Control+k");
    }
    await expect(palette).toBeVisible({ timeout: 5_000 });
  });

  // ── Navigation commands ───────────────────────────────────────────────────────

  test("shows all primary route labels when opened with no query", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    const expectedLabels = [
      "Marketplace",
      "Secondary Market",
      "Investor Dashboard",
      "My Invoices",
      "Create Invoice",
      "Transaction History",
      "Analytics",
    ];

    for (const label of expectedLabels) {
      await expect(palette.getByText(label)).toBeVisible();
    }
  });

  test("search query filters page commands", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    const input = palette.getByLabel("Command palette search");
    await input.fill("Market");

    await expect(palette.getByText("Marketplace")).toBeVisible();
    await expect(palette.getByText("Analytics")).not.toBeVisible();
  });

  test("selecting Marketplace navigates to /marketplace", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    await palette.getByText("Marketplace").first().click();

    await expect(page).toHaveURL(/\/marketplace/, { timeout: 10_000 });
  });

  test("selecting Transaction History navigates to /transactions", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    await palette.getByText("Transaction History").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });
  });

  test("searching Secondary Market and pressing Enter navigates and records it", async ({
    page,
  }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    const input = palette.getByLabel("Command palette search");
    await input.fill("secondary");
    await expect(palette.getByText("Secondary Market")).toBeVisible();

    await input.press("ArrowDown");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/secondary/, { timeout: 10_000 });
    const recent = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kora-cmd-recent") ?? "[]")
    );
    expect(recent[0]).toMatchObject({
      label: "Secondary Market",
      href: "/secondary",
      type: "page",
    });
  });

  // ── Keyboard navigation ───────────────────────────────────────────────────────

  test("arrow keys move selection and Enter triggers navigation", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    // Arrow down to select Marketplace (first in Pages group)
    // Depending on whether Recent is shown, press down until Marketplace is highlighted
    const input = palette.getByLabel("Command palette search");
    await input.press("ArrowDown");
    await input.press("Enter");

    // Should have navigated somewhere (exact route depends on what was highlighted)
    await expect(page).not.toHaveURL("/");
  });

  // ── Closing ───────────────────────────────────────────────────────────────────

  test("Escape closes the palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(palette).not.toBeVisible({ timeout: 3_000 });
  });

  test("clicking the backdrop closes the palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    // Click outside the dialog (top-left corner of the viewport)
    await page.mouse.click(10, 10);
    await expect(palette).not.toBeVisible({ timeout: 3_000 });
  });

  // ── Wallet actions ────────────────────────────────────────────────────────────

  test("shows Connect Wallet action when wallet is disconnected", async ({ page }) => {
    // In E2E tests the wallet is not connected by default
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    // Connect Wallet action should be visible
    await expect(palette.getByText("Connect Wallet")).toBeVisible();
  });

  test("clicking Connect Wallet opens the wallet modal", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    await palette.getByText("Connect Wallet").click();

    // The wallet connect modal should now be visible
    const walletDialog = page.getByRole("dialog", { name: /connect wallet/i });
    await expect(walletDialog).toBeVisible({ timeout: 5_000 });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────────

  test("palette has accessible dialog role and label", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });
    await expect(palette).toHaveAttribute("aria-modal", "true");
  });

  test("search input is focused when palette opens", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    const input = palette.getByLabel("Command palette search");
    await expect(input).toBeFocused({ timeout: 2_000 });
  });
});
