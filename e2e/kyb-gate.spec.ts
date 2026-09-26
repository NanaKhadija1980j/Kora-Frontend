/**
 * E2E — SME KYB Gate Screen (Issue #729)
 *
 * Verifies that an unverified SME attempting to create an invoice is:
 *  1. Shown the KybGateScreen interstitial (not the Upload & Review step)
 *  2. Unable to reach the wizard steps beyond Financing Terms
 *  3. Shown a verify CTA button
 *  4. Able to go back to the previous step
 *
 * Strategy:
 *  - Inject mock wallet state via localStorage (same pattern as existing helpers)
 *  - Set kycStatus to "none" to trigger the gate
 *  - Enable the "kyb-mint-gate" feature flag via localStorage
 *  - Navigate to /invoice/create and advance the wizard to step 2
 *  - Assert gate screen is visible and Upload & Review step is not reachable
 *
 * All specs run under 30 seconds.
 */

import { test, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOCK_ADDRESS = "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a date string N days from today in YYYY-MM-DD format */
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

/**
 * Inject a connected wallet with kycStatus "none" (unverified SME) into
 * localStorage so the Zustand store rehydrates correctly on page load.
 * Also enables the "kyb-mint-gate" feature flag.
 */
async function injectUnverifiedSmeWallet(
  context: BrowserContext,
  kycStatus: "none" | "pending" | "rejected" = "none",
) {
  await context.addInitScript(
    ({ address, kyc }) => {
      // Freighter stub so wallet detection logic sees a connected wallet
      (window as any).freighter = {
        isConnected: () => Promise.resolve(true),
        getPublicKey: () => Promise.resolve(address),
        signTransaction: (xdr: string) => Promise.resolve({ signedTxXdr: xdr }),
        getNetwork: () =>
          Promise.resolve({
            network: "TESTNET",
            networkPassphrase: "Test SDF Network ; September 2015",
          }),
        getNetworkDetails: () =>
          Promise.resolve({
            network: "TESTNET",
            networkPassphrase: "Test SDF Network ; September 2015",
            sorobanRpcUrl: "https://soroban-testnet.stellar.org",
          }),
      };

      // Wallet store — connected but NOT KYC verified
      const walletState = {
        state: {
          address,
          publicKey: address,
          isConnected: true,
          provider: "freighter",
          network: "testnet",
          balance: { xlm: "1000.00", usdc: "5000.00", eurc: "0" },
          isVerified: false,
          verifiedAt: null,
          kycStatus: kyc,
          walletPassphrase: "Test SDF Network ; September 2015",
        },
        version: 0,
      };
      localStorage.setItem("kora-wallet", JSON.stringify(walletState));
      localStorage.setItem("kora-wallet-store", JSON.stringify(walletState));

      // Enable the kyb-mint-gate feature flag via the flags store / localStorage key
      // The app reads feature flags from NEXT_PUBLIC_FEATURE_FLAGS or a local override.
      // We also try the common Zustand-persisted flag store key patterns.
      const flagState = {
        state: { flags: { "kyb-mint-gate": true } },
        version: 0,
      };
      localStorage.setItem("kora-feature-flags", JSON.stringify(flagState));

      // Override environment-level mock flag in window so env module picks it up
      (window as any).__KORA_FEATURE_FLAGS__ = { "kyb-mint-gate": true };
    },
    { address: MOCK_ADDRESS, kyc: kycStatus },
  );
}

/**
 * Fill all Step 1 (Invoice Details) required fields.
 */
async function fillInvoiceDetails(page: Page) {
  await page.getByLabel(/invoice number/i).fill("INV-KYB-E2E-001");
  await page.getByLabel(/debtor company name/i).fill("Test Debtor Corp");
  await page.getByLabel(/debtor address/i).fill("123 Business St, Nairobi");

  const amountInput = page.getByRole("spinbutton", { name: /invoice amount/i });
  await amountInput.fill("50000");

  // Due date via hidden input workaround (same as invoice-wizard.spec.ts)
  await page.evaluate((dateStr) => {
    const hiddenInputs = document.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    for (const inp of hiddenInputs) {
      const label = document.querySelector<HTMLLabelElement>(`label[for="${inp.id}"]`);
      if (label && /due date/i.test(label.textContent || "")) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(inp, dateStr);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
    }
  }, futureDate(90));
}

/**
 * Fill Step 2 (Financing Terms) required fields.
 */
async function fillFinancingTerms(page: Page) {
  const discountInput = page.getByRole("spinbutton", { name: /discount rate/i });
  await discountInput.fill("5");

  const minInvInput = page.getByRole("spinbutton", { name: /minimum investment/i });
  await minInvInput.fill("1000");

  await page.evaluate((dateStr) => {
    const hiddenInputs = document.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    for (const inp of hiddenInputs) {
      const label = document.querySelector<HTMLLabelElement>(`label[for="${inp.id}"]`);
      if (label && /listing expiry/i.test(label.textContent || "")) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(inp, dateStr);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
    }
  }, futureDate(30));
}

/**
 * Navigate the wizard to the point where Next is clicked after Step 2
 * (Financing Terms), triggering the KYB gate check.
 */
async function navigateToKybGateClick(page: Page) {
  // Step 1: Invoice Details
  await fillInvoiceDetails(page);
  await expect(page.getByRole("button", { name: /next/i })).toBeEnabled({ timeout: 5_000 });
  await page.getByRole("button", { name: /next/i }).click();

  // Step 2: Financing Terms
  await expect(page.getByText(/Financing Terms/i)).toBeVisible({ timeout: 5_000 });
  await fillFinancingTerms(page);
  await expect(page.getByRole("button", { name: /next/i })).toBeEnabled({ timeout: 5_000 });

  // Click Next — this triggers the KYB gate check
  await page.getByRole("button", { name: /next/i }).click();
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe("SME KYB Gate Screen — unverified SME", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectUnverifiedSmeWallet(context, "none");
    await page.goto("/invoice/create");
  });

  // ── Acceptance criterion 1: Unverified SME sees gate screen ────────────────

  test("unverified SME sees KybGateScreen when advancing past Financing Terms", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    await expect(
      page.getByTestId("kyb-gate-screen"),
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── Acceptance criterion 2: Wizard steps are not reachable ─────────────────

  test("Upload & Review step is not visible when gate is shown", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    // Gate must be visible
    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });

    // Upload & Review must NOT be reachable
    await expect(
      page.getByText(/Upload & Review/i),
    ).not.toBeVisible();
  });

  test("no file upload area is shown while gate is active", async ({ page }) => {
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });

    // Invoice document upload zone must not appear behind the gate
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  // ── Acceptance criterion 3: Verify CTA is visible ──────────────────────────

  test("Start Verification CTA is visible on the gate screen", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-gate-cta")).toBeVisible();
    await expect(page.getByTestId("kyb-gate-cta")).toContainText(/start verification/i);
  });

  test("gate screen shows the 'Business Verification Required' heading", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByText(/Business Verification Required/i),
    ).toBeVisible();
  });

  // ── Go Back navigation ──────────────────────────────────────────────────────

  test("Go Back button on the gate returns to Financing Terms", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });

    // Click the back button on the gate screen
    await page.getByTestId("kyb-gate-back").click();

    // Should return to Financing Terms step
    await expect(page.getByText(/Financing Terms/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("kyb-gate-screen")).not.toBeVisible();
  });
});

// ── Pending KYC status ────────────────────────────────────────────────────────

test.describe("SME KYB Gate Screen — pending verification", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectUnverifiedSmeWallet(context, "pending");
    await page.goto("/invoice/create");
  });

  test("pending KYC shows the pending badge instead of a CTA", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-pending-badge")).toBeVisible();
    // No CTA button when status is pending
    await expect(page.getByTestId("kyb-gate-cta")).not.toBeVisible();
  });
});

// ── Rejected KYC status ───────────────────────────────────────────────────────

test.describe("SME KYB Gate Screen — rejected verification", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectUnverifiedSmeWallet(context, "rejected");
    await page.goto("/invoice/create");
  });

  test("rejected KYC shows Re-verify CTA instead of Start Verification", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-gate-cta")).toBeVisible();
    await expect(page.getByTestId("kyb-gate-cta")).toContainText(/re-verify/i);
  });
});

// ── Uses mock wallet helpers (validates helper approach) ─────────────────────

test.describe("Mock wallet helper integration", () => {
  test("page loads with wallet connected indicator (no login wall)", async ({
    context,
    page,
  }) => {
    await injectUnverifiedSmeWallet(context, "none");
    await page.goto("/invoice/create");

    // The invoice create page should be accessible (not redirect to connect wallet)
    await expect(
      page.getByRole("heading", { name: /Create Invoice/i }),
    ).toBeVisible({ timeout: 8_000 });
  });
});
