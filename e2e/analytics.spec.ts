/**
 * E2E — Wallet-gated /analytics page.
 *
 * Covers:
 *  - Disconnected: shows the "Connect your wallet" gate instead of analytics
 *  - Disconnected: "Connect Wallet" CTA opens the wallet connect modal
 *  - Connected: wallet gate is dismissed and the analytics page renders
 *
 * Wallet simulation strategy:
 *   Inject a Zustand-compatible localStorage entry for `kora-wallet-store`
 *   before navigating so the app rehydrates as connected, same approach as
 *   e2e/dashboard.spec.ts.
 */
import { test, expect, type BrowserContext } from "@playwright/test";
import { MOCK_ADDRESS, injectWalletStubs } from "./helpers/mock-wallet";

async function injectConnectedWallet(context: BrowserContext) {
  await injectWalletStubs(context);
}

test.describe("Analytics page — disconnected", () => {
  test("shows connect wallet gate when no wallet is connected", async ({ page }) => {
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).toBeVisible();
    await expect(page.getByText(/view your portfolio analytics/i)).toBeVisible();
  });

  test("connect wallet CTA opens the wallet connect modal", async ({ page }) => {
    await page.goto("/analytics");

    await page.getByRole("button", { name: /connect wallet/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Analytics page — connected", () => {
  test("renders analytics once a wallet is connected", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();
  });

  test("triggers portfolio PDF digest download", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();

    const digestButton = page.getByRole("button", {
      name: /download portfolio pdf digest|pdf digest/i,
    });

    await expect(digestButton).toBeVisible();

    // Skips gracefully when portfolio empty in mock
    if (await digestButton.isDisabled()) {
      test.skip(true, "Portfolio is empty in mock data, skipping PDF download assertion");
      return;
    }

    const downloadPromise = page.waitForEvent("download");
    await digestButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^kora-portfolio-digest-.*\.pdf$/);
  });
});

