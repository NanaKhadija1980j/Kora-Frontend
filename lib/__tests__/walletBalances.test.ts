/**
 * Unit tests for lib/walletBalances.ts — Issue #728
 *
 * Covers:
 *  1. fetchAccountBalanceSnapshot — mock mode returns hardcoded snapshot
 *  2. fetchAccountBalanceSnapshot — live mode delegates to getAccountBalances
 *  3. getAssetAmount — native (XLM) branch
 *  4. getAssetAmount — USDC branch by code
 *  5. getAssetAmount — USDC branch by symbol fallback
 *  6. getAssetAmount — otherAssets lookup by code
 *  7. getAssetAmount — otherAssets lookup by code + issuer
 *  8. getAssetAmount — issuer mismatch falls through to 0
 *  9. getAssetAmount — zero XLM balance
 * 10. getAssetAmount — zero USDC balance
 * 11. getAssetAmount — missing trustline (code not found) returns 0
 * 12. getAssetAmount — undefined otherAssets balance string returns 0
 * 13. toWalletStoreBalance — maps xlm, usdc, eurc correctly
 * 14. toWalletStoreBalance — with zero balances
 * 15. toLegacyAccountBalance — converts all fields to numbers
 * 16. toLegacyAccountBalance — zero balances
 * 17. toLegacyAccountBalance — undefined xlm/usdc strings return 0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock env before importing the module under test ───────────────────────────

const mockEnv = { NEXT_PUBLIC_ENABLE_MOCK_DATA: true };

vi.mock("@/lib/env", () => ({ env: mockEnv }));

const mockGetAccountBalances = vi.fn();
vi.mock("@/lib/stellar/client", () => ({
  getAccountBalances: mockGetAccountBalances,
}));

// ── Import SUT after mocks ────────────────────────────────────────────────────

import {
  fetchAccountBalanceSnapshot,
  getAssetAmount,
  toWalletStoreBalance,
  toLegacyAccountBalance,
} from "@/lib/walletBalances";
import type { AccountBalances } from "@/types/stellar";
import type { WalletAssetConfig } from "@/config/walletAssets";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const XLM_ASSET: WalletAssetConfig = {
  symbol: "XLM",
  type: "native",
  code: "XLM",
};

const USDC_ASSET: WalletAssetConfig = {
  symbol: "USDC",
  type: "credit",
  code: "USDC",
  issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};

const EURC_ASSET: WalletAssetConfig = {
  symbol: "EURC",
  type: "credit",
  code: "EURC",
};

const EURC_WITH_ISSUER: WalletAssetConfig = {
  symbol: "EURC",
  type: "credit",
  code: "EURC",
  issuer: "MOCK_ISSUER",
};

const UNKNOWN_ASSET: WalletAssetConfig = {
  symbol: "XBULL",
  type: "credit",
  code: "XBULL",
};

function makeBalances(
  xlm = "1000.50",
  usdc = "500.00",
  otherAssets: AccountBalances["otherAssets"] = []
): AccountBalances {
  return { xlm, usdc, otherAssets };
}

const FULL_BALANCES: AccountBalances = {
  xlm: "1500.75",
  usdc: "2500.00",
  otherAssets: [
    { code: "EURC", issuer: "MOCK_ISSUER", balance: "300.00" },
    { code: "YUSDC", issuer: "YISSUER", balance: "0.00" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// fetchAccountBalanceSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchAccountBalanceSnapshot", () => {
  describe("when NEXT_PUBLIC_ENABLE_MOCK_DATA is true (mock mode)", () => {
    beforeEach(() => {
      mockEnv.NEXT_PUBLIC_ENABLE_MOCK_DATA = true;
    });

    it("returns the hardcoded mock XLM balance of 10000", async () => {
      const result = await fetchAccountBalanceSnapshot("GANYADDRESS");
      expect(result.xlm).toBe("10000");
    });

    it("returns the hardcoded mock USDC balance of 999999", async () => {
      const result = await fetchAccountBalanceSnapshot("GANYADDRESS");
      expect(result.usdc).toBe("999999");
    });

    it("includes EURC with balance 5000 in mock otherAssets", async () => {
      const result = await fetchAccountBalanceSnapshot("GANYADDRESS");
      const eurc = result.otherAssets.find((a) => a.code === "EURC");
      expect(eurc).toBeDefined();
      expect(eurc?.balance).toBe("5000");
    });

    it("does not call getAccountBalances in mock mode", async () => {
      await fetchAccountBalanceSnapshot("GANYADDRESS");
      expect(mockGetAccountBalances).not.toHaveBeenCalled();
    });
  });

  describe("when NEXT_PUBLIC_ENABLE_MOCK_DATA is false (live mode)", () => {
    beforeEach(() => {
      mockEnv.NEXT_PUBLIC_ENABLE_MOCK_DATA = false;
      mockGetAccountBalances.mockResolvedValue(FULL_BALANCES);
    });

    afterEach(() => {
      mockEnv.NEXT_PUBLIC_ENABLE_MOCK_DATA = true; // restore default
    });

    it("delegates to getAccountBalances with the provided address", async () => {
      const ADDRESS = "GLIVE1111111111111111111111111111111111111111111";
      await fetchAccountBalanceSnapshot(ADDRESS);
      expect(mockGetAccountBalances).toHaveBeenCalledWith(ADDRESS);
    });

    it("returns the data from getAccountBalances", async () => {
      const result = await fetchAccountBalanceSnapshot("GLIVE...");
      expect(result).toEqual(FULL_BALANCES);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAssetAmount
// ─────────────────────────────────────────────────────────────────────────────

describe("getAssetAmount", () => {
  describe("native (XLM) asset", () => {
    it("returns the parsed xlm balance", () => {
      expect(getAssetAmount(makeBalances("1234.56"), XLM_ASSET)).toBe(1234.56);
    });

    it("returns 0 when xlm is an empty string", () => {
      expect(getAssetAmount(makeBalances(""), XLM_ASSET)).toBe(0);
    });

    it("returns 0 when xlm is '0'", () => {
      expect(getAssetAmount(makeBalances("0"), XLM_ASSET)).toBe(0);
    });

    it("handles large XLM balances correctly", () => {
      expect(getAssetAmount(makeBalances("10000000.99"), XLM_ASSET)).toBeCloseTo(10000000.99);
    });
  });

  describe("USDC asset", () => {
    it("returns the parsed usdc balance when code === 'USDC'", () => {
      expect(getAssetAmount(makeBalances("0", "750.25"), USDC_ASSET)).toBe(750.25);
    });

    it("returns the parsed usdc balance when symbol === 'USDC' (no issuer check)", () => {
      const usdcBySymbol: WalletAssetConfig = {
        symbol: "USDC",
        type: "credit",
        code: "OTHER_CODE", // code is not USDC but symbol is
      };
      expect(getAssetAmount(makeBalances("0", "999.00"), usdcBySymbol)).toBe(999.0);
    });

    it("returns 0 when usdc balance is '0'", () => {
      expect(getAssetAmount(makeBalances("100", "0"), USDC_ASSET)).toBe(0);
    });

    it("returns 0 when usdc balance is an empty string", () => {
      expect(getAssetAmount(makeBalances("100", ""), USDC_ASSET)).toBe(0);
    });
  });

  describe("otherAssets lookup", () => {
    it("finds EURC by code when no issuer constraint is given", () => {
      const balances = makeBalances("0", "0", [
        { code: "EURC", issuer: "SOME_ISSUER", balance: "250.00" },
      ]);
      expect(getAssetAmount(balances, EURC_ASSET)).toBe(250.0);
    });

    it("finds EURC by code + matching issuer", () => {
      const balances = makeBalances("0", "0", [
        { code: "EURC", issuer: "MOCK_ISSUER", balance: "300.50" },
      ]);
      expect(getAssetAmount(balances, EURC_WITH_ISSUER)).toBe(300.5);
    });

    it("returns 0 when issuer does not match", () => {
      const balances = makeBalances("0", "0", [
        { code: "EURC", issuer: "DIFFERENT_ISSUER", balance: "500.00" },
      ]);
      expect(getAssetAmount(balances, EURC_WITH_ISSUER)).toBe(0);
    });

    it("returns 0 for missing trustline (code not present in otherAssets)", () => {
      const balances = makeBalances("100", "200", [
        { code: "EURC", issuer: "MOCK_ISSUER", balance: "50.00" },
      ]);
      expect(getAssetAmount(balances, UNKNOWN_ASSET)).toBe(0);
    });

    it("returns 0 when otherAssets is empty (missing trustline)", () => {
      const balances = makeBalances("100", "200", []);
      expect(getAssetAmount(balances, EURC_ASSET)).toBe(0);
    });

    it("returns 0 when a matching asset has undefined/empty balance string", () => {
      const balances = makeBalances("0", "0", [
        { code: "EURC", issuer: "MOCK_ISSUER", balance: "" },
      ]);
      expect(getAssetAmount(balances, EURC_WITH_ISSUER)).toBe(0);
    });

    it("handles multiple assets and picks the correct one", () => {
      const balances = makeBalances("0", "0", [
        { code: "EURC", issuer: "ISSUER_1", balance: "100.00" },
        { code: "XBULL", issuer: "ISSUER_2", balance: "999.00" },
        { code: "YUSDC", issuer: "ISSUER_3", balance: "50.00" },
      ]);
      expect(getAssetAmount(balances, UNKNOWN_ASSET)).toBe(999.0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toWalletStoreBalance
// ─────────────────────────────────────────────────────────────────────────────

describe("toWalletStoreBalance", () => {
  it("maps xlm as a string passthrough", () => {
    const result = toWalletStoreBalance(FULL_BALANCES);
    expect(result.xlm).toBe("1500.75");
  });

  it("maps usdc as a string passthrough", () => {
    const result = toWalletStoreBalance(FULL_BALANCES);
    expect(result.usdc).toBe("2500.00");
  });

  it("maps eurc from otherAssets correctly", () => {
    const result = toWalletStoreBalance(FULL_BALANCES);
    expect(result.eurc).toBe("300");
  });

  it("returns eurc '0' when no EURC trustline present", () => {
    const balances = makeBalances("500", "200", []);
    const result = toWalletStoreBalance(balances);
    expect(result.eurc).toBe("0");
  });

  it("returns xlm '0.00' and usdc '0.00' for zero balances", () => {
    const result = toWalletStoreBalance(makeBalances("0.00", "0.00", []));
    expect(result.xlm).toBe("0.00");
    expect(result.usdc).toBe("0.00");
    expect(result.eurc).toBe("0");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toLegacyAccountBalance
// ─────────────────────────────────────────────────────────────────────────────

describe("toLegacyAccountBalance", () => {
  it("converts xlm to a number", () => {
    const result = toLegacyAccountBalance(FULL_BALANCES);
    expect(result.xlm).toBe(1500.75);
  });

  it("converts usdc to a number", () => {
    const result = toLegacyAccountBalance(FULL_BALANCES);
    expect(result.usdc).toBe(2500.0);
  });

  it("converts eurc from otherAssets to a number", () => {
    const result = toLegacyAccountBalance(FULL_BALANCES);
    expect(result.eurc).toBe(300.0);
  });

  it("returns 0 for xlm when balance is empty string", () => {
    const result = toLegacyAccountBalance(makeBalances("", "0", []));
    expect(result.xlm).toBe(0);
  });

  it("returns 0 for usdc when balance is empty string", () => {
    const result = toLegacyAccountBalance(makeBalances("0", "", []));
    expect(result.usdc).toBe(0);
  });

  it("returns 0 for eurc when no EURC trustline", () => {
    const result = toLegacyAccountBalance(makeBalances("100", "50", []));
    expect(result.eurc).toBe(0);
  });

  it("handles zero balances across all fields", () => {
    const result = toLegacyAccountBalance(makeBalances("0", "0", []));
    expect(result.xlm).toBe(0);
    expect(result.usdc).toBe(0);
    expect(result.eurc).toBe(0);
  });

  it("returns numeric values for XLM and USDC branches from MOCK snapshot", async () => {
    // Use the mock snapshot (ENABLE_MOCK_DATA=true path) to ensure the round-trip
    const snapshot = await fetchAccountBalanceSnapshot("GTEST...");
    const result = toLegacyAccountBalance(snapshot);
    expect(result.xlm).toBe(10000);
    expect(result.usdc).toBe(999999);
    expect(result.eurc).toBe(5000);
  });
});
