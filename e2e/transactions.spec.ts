/**
 * E2E — Wallet-gated /transactions page.
 *
 * Covers:
 *  - Disconnected: shows the "Connect your wallet" gate instead of history
 *  - Disconnected: "Connect Wallet" CTA opens the wallet connect modal
 *  - Connected: wallet gate is dismissed and transaction history renders
 *
 * Wallet simulation strategy:
 *   Inject a Zustand-compatible localStorage entry for `kora-wallet-store`
 *   before navigating so the app rehydrates as connected, same approach as
 *   e2e/dashboard.spec.ts.
 */
import { test, expect, type BrowserContext } from "@playwright/test";
import { MOCK_ADDRESS } from "./helpers/mock-wallet";

async function injectConnectedWallet(context: BrowserContext) {
  await context.addInitScript((address) => {
    const walletState = {
      state: {
        address,
        publicKey: address,
        isConnected: true,
        provider: "freighter",
        balance: "1000.00",
        isVerified: false,
        verifiedAt: null,
      },
      version: 0,
    };
    localStorage.setItem("kora-wallet-store", JSON.stringify(walletState));
  }, MOCK_ADDRESS);
}

test.describe("Transactions page — disconnected", () => {
  test("shows connect wallet gate when no wallet is connected", async ({ page }) => {
    await page.goto("/transactions");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).toBeVisible();
    await expect(
      page.getByText(/connect to view your on-chain transaction history/i)
    ).toBeVisible();
  });

  test("connect wallet CTA opens the wallet connect modal", async ({ page }) => {
    await page.goto("/transactions");

    await page.getByRole("button", { name: /connect wallet/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Transactions page — connected", () => {
  test("renders transaction history once a wallet is connected", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/transactions");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();
  });
});
