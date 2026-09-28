import { test, expect } from "@playwright/test";

import { installMockWallet, connectMockWallet } from "./helpers/mock-wallet";

test.describe("settings page", () => {
  test.beforeEach(async ({ page }) => {
    await installMockWallet(page);
  });

  test("shows the wallet-required empty state while disconnected", async ({ page }) => {
    await page.goto("/settings");

    // Preferences are per-wallet, so the disconnected surface is a connect gate
    // rather than the notification toggles.
    await expect(page.getByRole("button", { name: /connect/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("connect CTA opens the wallet modal", async ({ page }) => {
    await page.goto("/settings");

    await page.getByRole("button", { name: /connect/i }).click();

    // The CTA routes through the shared wallet modal, not a bespoke flow.
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("renders notification settings once connected", async ({ page }) => {
    await connectMockWallet(page);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("switch").first()).toBeVisible();
  });

  test("persists notification preferences across a reload", async ({ page }) => {
    await connectMockWallet(page);
    await page.goto("/settings");

    const toggle = page.getByRole("switch").first();
    await expect(toggle).toBeVisible();

    const initial = await toggle.getAttribute("aria-checked");
    await toggle.click();
    const toggled = await toggle.getAttribute("aria-checked");
    expect(toggled).not.toBe(initial);

    await page.reload();

    // settingsStore persists per wallet, so the flipped value must survive.
    await expect(page.getByRole("switch").first()).toHaveAttribute(
      "aria-checked",
      toggled as string,
    );
  });
});
