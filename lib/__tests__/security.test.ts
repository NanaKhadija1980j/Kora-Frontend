import { describe, expect, it } from "vitest";
import {
  parseWalletDiagnosticsImport,
  redactWalletAddress,
  sanitizeWalletDiagnosticsExport,
} from "../security";

describe("wallet diagnostics security helpers", () => {
  it("redacts full wallet addresses", () => {
    expect(
      redactWalletAddress("GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
    ).toBe("GA5Z...KZVN");
  });

  it("sanitizes export payloads without leaking raw addresses", () => {
    const payload = sanitizeWalletDiagnosticsExport({
      exportedAt: "2026-08-27T00:00:00.000Z",
      network: "testnet",
      wallet: {
        provider: "freighter",
        isConnected: true,
        addressSuffix:
          "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        walletNetwork: "testnet",
        passphraseMismatch: false,
        kitSessionActive: true,
      },
      flags: {
        enableDevtools: true,
        enableInvoiceComparison: true,
      },
    });

    expect(payload.wallet.addressSuffix).toBe("GA5Z...KZVN");
  });

  it("parses imports with missing fields safely", () => {
    const imported = parseWalletDiagnosticsImport("{\"network\":\"testnet\"}");
    expect(imported.network).toBe("testnet");
    expect(imported.wallet.provider).toBeNull();
    expect(imported.flags.enableDevtools).toBe(false);
  });
});
