/**
 * Unit tests for lib/env parse failures (#817).
 *
 * `env` is parsed at import time, so each test stubs process.env and
 * re-imports the module. `window` is stubbed to undefined to exercise the
 * server path; the client path restores jsdom's window.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VALID_CONTRACT = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const ZERO_CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

const REQUIRED_CLIENT = {
  NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NEXT_PUBLIC_INVOICE_CONTRACT_ID: VALID_CONTRACT,
  NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: VALID_CONTRACT,
  NEXT_PUBLIC_TOKEN_CONTRACT_ID: VALID_CONTRACT,
  NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
};

const originalEnv = process.env;

function setEnv(vars: Record<string, string | undefined>) {
  const next: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) next[key] = value;
  }
  process.env = next;
}

async function loadEnv() {
  vi.resetModules();
  return (await import("@/lib/env")).env;
}

describe("lib/env parseEnv", () => {
  beforeEach(() => {
    vi.stubGlobal("window", undefined);
    setEnv({ ...REQUIRED_CLIENT, PINATA_JWT: "jwt" });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("required client vars", () => {
    it.each(Object.keys(REQUIRED_CLIENT))("throws when %s is missing", async (key) => {
      setEnv({ ...REQUIRED_CLIENT, [key]: undefined, PINATA_JWT: "jwt" });

      await expect(loadEnv()).rejects.toThrow(
        new RegExp(`Invalid environment variables:[\\s\\S]*${key}`)
      );
    });

    it("lists every offending key in a single error", async () => {
      setEnv({ PINATA_JWT: "jwt" });

      const error = await loadEnv().catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      for (const key of Object.keys(REQUIRED_CLIENT)) {
        expect((error as Error).message).toContain(key);
      }
    });

    it("rejects a non-URL RPC endpoint", async () => {
      setEnv({ ...REQUIRED_CLIENT, NEXT_PUBLIC_STELLAR_RPC_URL: "not-a-url" });

      await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_STELLAR_RPC_URL/);
    });

    it("rejects a malformed Soroban contract ID", async () => {
      setEnv({ ...REQUIRED_CLIENT, NEXT_PUBLIC_TOKEN_CONTRACT_ID: "GABC" });

      await expect(loadEnv()).rejects.toThrow(
        /NEXT_PUBLIC_TOKEN_CONTRACT_ID: Invalid Soroban contract ID "GABC"/
      );
    });

    it("rejects an unknown Stellar network", async () => {
      setEnv({ ...REQUIRED_CLIENT, NEXT_PUBLIC_STELLAR_NETWORK: "devnet" });

      await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_STELLAR_NETWORK/);
    });

    it("rejects fee bps outside 0-10000", async () => {
      setEnv({ ...REQUIRED_CLIENT, NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS: "10001" });

      await expect(loadEnv()).rejects.toThrow(/Protocol fee must be between 0 and 10000 bps/);
    });
  });

  describe("optional client vars", () => {
    it("applies documented defaults when optional vars are unset", async () => {
      const env = await loadEnv();

      expect(env.NEXT_PUBLIC_STELLAR_NETWORK).toBe("testnet");
      expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
      expect(env.NEXT_PUBLIC_APP_NAME).toBe("Kora");
      expect(env.NEXT_PUBLIC_ENABLE_MOCK_DATA).toBe(false);
      expect(env.NEXT_PUBLIC_ENABLE_DEVTOOLS).toBe(false);
      expect(env.NEXT_PUBLIC_KYC_FUND_THRESHOLD).toBe(10000);
      expect(env.NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS).toBe(50);
      expect(env.NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS).toBe(25);
    });

    it("parses provided optional values", async () => {
      setEnv({
        ...REQUIRED_CLIENT,
        PINATA_JWT: "jwt",
        NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
        NEXT_PUBLIC_ENABLE_MOCK_DATA: "true",
        NEXT_PUBLIC_KYC_FUND_THRESHOLD: "2500",
        NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS: "0",
      });

      const env = await loadEnv();

      expect(env.NEXT_PUBLIC_STELLAR_NETWORK).toBe("mainnet");
      expect(env.NEXT_PUBLIC_ENABLE_MOCK_DATA).toBe(true);
      expect(env.NEXT_PUBLIC_KYC_FUND_THRESHOLD).toBe(2500);
      expect(env.NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS).toBe(0);
    });
  });

  describe("live-mode zero-address guard", () => {
    it("throws when a contract ID is the zero-address and mock data is off", async () => {
      setEnv({ ...REQUIRED_CLIENT, PINATA_JWT: "jwt", NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: ZERO_CONTRACT });

      const error = await loadEnv().catch((e: Error) => e);
      expect((error as Error).message).toMatch(/Live mode is enabled/);
      expect((error as Error).message).toContain("NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID");
      expect((error as Error).message).not.toContain("NEXT_PUBLIC_INVOICE_CONTRACT_ID");
    });

    it("allows the zero-address when mock data is enabled", async () => {
      setEnv({
        ...REQUIRED_CLIENT,
        PINATA_JWT: "jwt",
        NEXT_PUBLIC_ENABLE_MOCK_DATA: "true",
        NEXT_PUBLIC_INVOICE_CONTRACT_ID: ZERO_CONTRACT,
      });

      const env = await loadEnv();
      expect(env.NEXT_PUBLIC_INVOICE_CONTRACT_ID).toBe(ZERO_CONTRACT);
    });
  });

  describe("server-only vars", () => {
    it("includes server vars when all are valid", async () => {
      setEnv({ ...REQUIRED_CLIENT, PINATA_JWT: "jwt", VIRUSTOTAL_API_KEY: "vt" });

      const env = await loadEnv();

      expect(env).toMatchObject({ PINATA_JWT: "jwt", VIRUSTOTAL_API_KEY: "vt" });
    });

    it("throws in production when PINATA_JWT is missing", async () => {
      setEnv({ ...REQUIRED_CLIENT, NODE_ENV: "production" });

      await expect(loadEnv()).rejects.toThrow(
        /Missing required server environment variables:[\s\S]*PINATA_JWT/
      );
    });

    it("warns instead of throwing outside production when PINATA_JWT is missing", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      setEnv({ ...REQUIRED_CLIENT, NODE_ENV: "development", PINATA_API_KEY: "key" });

      const env = await loadEnv();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("PINATA_JWT"));
      expect(env).toMatchObject({ PINATA_API_KEY: "key" });
      expect(env).not.toHaveProperty("PINATA_JWT");
    });

    it("skips server validation on the client", async () => {
      vi.unstubAllGlobals();
      setEnv({ ...REQUIRED_CLIENT, NODE_ENV: "production" });

      const env = await loadEnv();

      expect(env).not.toHaveProperty("PINATA_JWT");
      expect(env.NEXT_PUBLIC_IPFS_GATEWAY).toBe(REQUIRED_CLIENT.NEXT_PUBLIC_IPFS_GATEWAY);
    });
  });
});
