/**
 * Unit tests for lib/stellar/contracts.ts
 *
 * Target: Verify XDR output shape and parameter validation for all contract methods.
 * All tests mock the Soroban RPC - no real network calls.
 *
 * Test coverage:
 * - mintInvoice: XDR structure, parameter validation
 * - fundInvoice: XDR structure, parameter validation
 * - repayInvoice: XDR structure, parameter validation
 * - getInvoice: simulation and parsing
 * - getPositions: simulation and parsing
 * - Parameter validation: invalid addresses, missing fields
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  invoiceContract,
  marketplaceContract,
  buildTestnetUsdcMintTx,
  updateInvoiceStatus,
  getPositions,
} from "../contracts";
import type { MintInvoiceParams, FundInvoiceParams, RepayInvoiceParams } from "@/types/contract";

// Mock environment variables
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  },
}));

// Mock the RPC client
vi.mock("../client", () => {
  const mockAccount = new StellarSdk.Account(
    "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI",
    "1000"
  );

  const mockRpc = {
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    simulateTransaction: vi.fn(),
    getTransaction: vi.fn(),
  };

  return {
    rpc: mockRpc,
    sequenceManager: {
      nextAccount: vi.fn().mockResolvedValue(mockAccount),
      reset: vi.fn(),
    },
    networkConfig: {
      networkPassphrase: "Test SDF Network ; September 2015",
      network: "testnet",
      horizonUrl: "https://horizon-testnet.stellar.org",
      rpcUrl: "https://soroban-testnet.stellar.org",
    },
    submitTransaction: vi.fn(),
    sequenceManager: {
      nextAccount: vi.fn().mockImplementation(async (address: string) => {
        return new StellarSdk.Account(address, "1000");
      }),
      reset: vi.fn(),
    },
  };
});

// Avoid parsing fake simulation XDR in assembleTransaction during unit tests.
function restoreAssembleMocks() {
  const assemble = vi.fn((tx: StellarSdk.Transaction) => ({
    build: () => tx,
  }));
  Object.defineProperty(StellarSdk.rpc, "assembleTransaction", {
    configurable: true,
    writable: true,
    value: assemble,
  });

  const isError = vi.fn(
    (sim: unknown) =>
      Boolean(
        sim &&
          typeof sim === "object" &&
          "error" in (sim as Record<string, unknown>) &&
          (sim as { error?: unknown }).error,
      ),
  );
  Object.defineProperty(StellarSdk.rpc.Api, "isSimulationError", {
    configurable: true,
    writable: true,
    value: isError,
  });
}

restoreAssembleMocks();

// Valid test addresses
const VALID_ADDRESS_1 = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";
const VALID_ADDRESS_2 = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const INVALID_ADDRESS = "INVALID_STELLAR_ADDRESS";

beforeEach(() => {
  // assembleTransaction requires a full RPC simulation payload; unit tests
  // only assert XDR shape, so short-circuit assembly to the pre-sim tx.
  vi.spyOn(StellarSdk.rpc, "assembleTransaction").mockImplementation(
    (tx: StellarSdk.Transaction) =>
      ({
        build: () => tx,
      }) as unknown as ReturnType<typeof StellarSdk.rpc.assembleTransaction>
  );
  vi.spyOn(StellarSdk.rpc.Api, "isSimulationError").mockImplementation(
    (result: unknown) =>
      Boolean(result && typeof result === "object" && "error" in (result as object))
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InvoiceContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreAssembleMocks();
  });

  describe("mintInvoice", () => {
    it("builds XDR for minting an invoice", async () => {
      const { rpc } = await import("../client");
      
      // Mock successful simulation
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{
          auth: [],
          xdr: "mock-result-xdr",
        }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const params: MintInvoiceParams = {
        ipfsCid: "QmTest123",
        amount: BigInt(10000_000000),
        financingAmount: BigInt(9500_000000),
        discountRate: 500, // 5%
        dueDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 90),
      };

      const xdr = await invoiceContract.mintInvoice(params, VALID_ADDRESS_1);

      expect(typeof xdr).toBe("string");
      expect(xdr.length).toBeGreaterThan(0);
      
      // Verify XDR can be parsed back
      const tx = StellarSdk.TransactionBuilder.fromXDR(
        xdr,
        "Test SDF Network ; September 2015"
      );
      expect(tx).toBeDefined();
      expect(tx.operations).toHaveLength(1);
    });

    it("throws on invalid source address", async () => {
      const params: MintInvoiceParams = {
        ipfsCid: "QmTest123",
        amount: BigInt(10000_000000),
        financingAmount: BigInt(9500_000000),
        discountRate: 500,
        dueDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 90),
      };

      await expect(
        invoiceContract.mintInvoice(params, INVALID_ADDRESS)
      ).rejects.toThrow("Invalid Stellar address format");
    });

    it("throws on simulation error", async () => {
      const { rpc } = await import("../client");
      
      // Mock simulation error
      (rpc.simulateTransaction as any).mockResolvedValue({
        error: "Error(Contract, #1)",
      });

      const params: MintInvoiceParams = {
        ipfsCid: "QmTest123",
        amount: BigInt(10000_000000),
        financingAmount: BigInt(9500_000000),
        discountRate: 500,
        dueDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 90),
      };

      await expect(
        invoiceContract.mintInvoice(params, VALID_ADDRESS_1)
      ).rejects.toThrow("Invoice not found");
    });
  });

  describe("updateStatus / cancelInvoice", () => {
    it("builds XDR for status update", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const xdr = await invoiceContract.updateStatus(BigInt(1), 6, VALID_ADDRESS_1);
      expect(typeof xdr).toBe("string");
    });

    it("cancelInvoice calls updateStatus with status=6", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const xdr = await invoiceContract.cancelInvoice(BigInt(1), VALID_ADDRESS_1);
      expect(typeof xdr).toBe("string");
    });
  });

  describe("getInvoice", () => {
    it("simulates and parses on-chain invoice", async () => {
      const { rpc } = await import("../client");
      
      // Mock successful read simulation with invoice data
      (rpc.simulateTransaction as any).mockResolvedValue({
        result: {
          retval: StellarSdk.xdr.ScVal.scvMap([
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("token_id"),
              val: StellarSdk.xdr.ScVal.scvU64(
                StellarSdk.xdr.Uint64.fromString("1")
              ),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("owner"),
              val: new StellarSdk.Address(VALID_ADDRESS_1).toScVal(),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("ipfs_cid"),
              val: StellarSdk.xdr.ScVal.scvString("QmTest123"),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("amount"),
              val: StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  hi: StellarSdk.xdr.Int64.fromString("0"),
                  lo: StellarSdk.xdr.Uint64.fromString("10000000000"),
                })
              ),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("financing_amount"),
              val: StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  hi: StellarSdk.xdr.Int64.fromString("0"),
                  lo: StellarSdk.xdr.Uint64.fromString("9500000000"),
                })
              ),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("discount_rate"),
              val: StellarSdk.xdr.ScVal.scvU32(500),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("due_date"),
              val: StellarSdk.xdr.ScVal.scvU64(
                StellarSdk.xdr.Uint64.fromString("1704067200")
              ),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("status"),
              val: StellarSdk.xdr.ScVal.scvU32(1),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("funded_amount"),
              val: StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  hi: StellarSdk.xdr.Int64.fromString("0"),
                  lo: StellarSdk.xdr.Uint64.fromString("0"),
                })
              ),
            }),
          ]),
        },
        latestLedger: 1000,
      });

      const invoice = await invoiceContract.getInvoice(BigInt(1), VALID_ADDRESS_1);

      expect(invoice).toBeDefined();
      expect(invoice.token_id).toBe(BigInt(1));
      expect(invoice.owner).toBe(VALID_ADDRESS_1);
      expect(invoice.ipfs_cid).toBe("QmTest123");
      expect(invoice.amount).toBe(BigInt(10000000000));
      expect(invoice.financing_amount).toBe(BigInt(9500000000));
      expect(invoice.discount_rate).toBe(500);
      expect(invoice.due_date).toBe(BigInt(1704067200));
      expect(invoice.status).toBe(1);
      expect(invoice.funded_amount).toBe(BigInt(0));
    });

    it("throws on invalid address", async () => {
      await expect(
        invoiceContract.getInvoice(BigInt(1), INVALID_ADDRESS)
      ).rejects.toThrow("Invalid Stellar address format");
    });

    it("throws on simulation error", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        error: "Error(Contract, #1)",
      });

      await expect(
        invoiceContract.getInvoice(BigInt(999), VALID_ADDRESS_1)
      ).rejects.toThrow("Invoice not found");
    });
  });

  describe("batchGetInvoices", () => {
    it("fetches multiple invoices concurrently", async () => {
      const { rpc } = await import("../client");
      
      // Mock successful simulation for invoice 1
      (rpc.simulateTransaction as any).mockResolvedValue({
        result: {
          retval: StellarSdk.xdr.ScVal.scvMap([
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("token_id"),
              val: StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString("1")),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("owner"),
              val: new StellarSdk.Address(VALID_ADDRESS_1).toScVal(),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("ipfs_cid"),
              val: StellarSdk.xdr.ScVal.scvString("QmTest"),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("amount"),
              val: StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  hi: StellarSdk.xdr.Int64.fromString("0"),
                  lo: StellarSdk.xdr.Uint64.fromString("1000"),
                })
              ),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("financing_amount"),
              val: StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  hi: StellarSdk.xdr.Int64.fromString("0"),
                  lo: StellarSdk.xdr.Uint64.fromString("950"),
                })
              ),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("discount_rate"),
              val: StellarSdk.xdr.ScVal.scvU32(50),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("due_date"),
              val: StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString("1704067200")),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("status"),
              val: StellarSdk.xdr.ScVal.scvU32(1),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol("funded_amount"),
              val: StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  hi: StellarSdk.xdr.Int64.fromString("0"),
                  lo: StellarSdk.xdr.Uint64.fromString("0"),
                })
              ),
            }),
          ]),
        },
        latestLedger: 1000,
      });

      const results = await invoiceContract.batchGetInvoices(
        [BigInt(1), BigInt(2)],
        VALID_ADDRESS_1
      );

      expect(results.size).toBeGreaterThan(0);
    });

    it("omits failed invoice fetches from result", async () => {
      const { rpc } = await import("../client");
      
      // Mock failure
      (rpc.simulateTransaction as any).mockRejectedValue(new Error("Invoice not found"));

      const results = await invoiceContract.batchGetInvoices(
        [BigInt(999)],
        VALID_ADDRESS_1
      );

      expect(results.size).toBe(0);
    });
  });
});

describe("MarketplaceContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreAssembleMocks();
  });

  describe("fundInvoice", () => {
    it("builds XDR for funding an invoice", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const params: FundInvoiceParams = {
        tokenId: BigInt(1),
        amount: BigInt(5000_000000),
      };

      const xdr = await marketplaceContract.fundInvoice(params, VALID_ADDRESS_2);

      expect(typeof xdr).toBe("string");
      expect(xdr.length).toBeGreaterThan(0);
    });

    it("throws on invalid address", async () => {
      const params: FundInvoiceParams = {
        tokenId: BigInt(1),
        amount: BigInt(5000_000000),
      };

      await expect(
        marketplaceContract.fundInvoice(params, INVALID_ADDRESS)
      ).rejects.toThrow("Invalid Stellar address format");
    });
  });

  describe("repayInvoice", () => {
    it("builds XDR for repaying an invoice", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const params: RepayInvoiceParams = {
        tokenId: BigInt(1),
      };

      const xdr = await marketplaceContract.repayInvoice(params, VALID_ADDRESS_1);

      expect(typeof xdr).toBe("string");
    });
  });

  describe("claimPosition", () => {
    it("builds XDR for claiming a position", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const xdr = await marketplaceContract.claimPosition(
        { positionId: BigInt(1) },
        VALID_ADDRESS_2
      );

      expect(typeof xdr).toBe("string");
    });
  });

  describe("getPositions", () => {
    it("returns empty array when investor has no positions", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        error: "Error(Contract, #1)",
      });

      const positions = await marketplaceContract.getPositions(
        VALID_ADDRESS_2,
        VALID_ADDRESS_1
      );

      expect(positions).toEqual([]);
    });

    it("parses investor positions from simulation result", async () => {
      const { rpc } = await import("../client");
      
      // Mock vec with one position
      (rpc.simulateTransaction as any).mockResolvedValue({
        result: {
          retval: StellarSdk.xdr.ScVal.scvVec([
            StellarSdk.xdr.ScVal.scvMap([
              new StellarSdk.xdr.ScMapEntry({
                key: StellarSdk.xdr.ScVal.scvSymbol("token_id"),
                val: StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString("1")),
              }),
              new StellarSdk.xdr.ScMapEntry({
                key: StellarSdk.xdr.ScVal.scvSymbol("amount"),
                val: StellarSdk.xdr.ScVal.scvI128(
                  new StellarSdk.xdr.Int128Parts({
                    hi: StellarSdk.xdr.Int64.fromString("0"),
                    lo: StellarSdk.xdr.Uint64.fromString("5000000000"),
                  })
                ),
              }),
              new StellarSdk.xdr.ScMapEntry({
                key: StellarSdk.xdr.ScVal.scvSymbol("expected_return"),
                val: StellarSdk.xdr.ScVal.scvI128(
                  new StellarSdk.xdr.Int128Parts({
                    hi: StellarSdk.xdr.Int64.fromString("0"),
                    lo: StellarSdk.xdr.Uint64.fromString("5250000000"),
                  })
                ),
              }),
              new StellarSdk.xdr.ScMapEntry({
                key: StellarSdk.xdr.ScVal.scvSymbol("yield_earned"),
                val: StellarSdk.xdr.ScVal.scvI128(
                  new StellarSdk.xdr.Int128Parts({
                    hi: StellarSdk.xdr.Int64.fromString("0"),
                    lo: StellarSdk.xdr.Uint64.fromString("0"),
                  })
                ),
              }),
              new StellarSdk.xdr.ScMapEntry({
                key: StellarSdk.xdr.ScVal.scvSymbol("invested_at"),
                val: StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString("1704067200")),
              }),
              new StellarSdk.xdr.ScMapEntry({
                key: StellarSdk.xdr.ScVal.scvSymbol("status"),
                val: StellarSdk.xdr.ScVal.scvU32(1),
              }),
            ]),
          ]),
        },
        latestLedger: 1000,
      });

      const positions = await marketplaceContract.getPositions(
        VALID_ADDRESS_2,
        VALID_ADDRESS_1
      );

      expect(positions).toHaveLength(1);
      expect(positions[0].invoiceId).toBe("1");
      expect(positions[0].investedAmount).toBe(5000);
      expect(positions[0].expectedReturn).toBe(5250);
      expect(positions[0].status).toBe("active");
    });

    it("throws on invalid investor address", async () => {
      await expect(
        marketplaceContract.getPositions(INVALID_ADDRESS, VALID_ADDRESS_1)
      ).rejects.toThrow("Invalid Stellar address format");
    });
  });

  describe("claimYield", () => {
    it("builds XDR for claiming yield", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const xdr = await marketplaceContract.claimYield(
        { tokenId: BigInt(1) },
        VALID_ADDRESS_2
      );

      expect(typeof xdr).toBe("string");
    });
  });
});

describe("Utility Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreAssembleMocks();
  });

  describe("buildTestnetUsdcMintTx", () => {
    it("builds XDR for minting testnet USDC", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const xdr = await buildTestnetUsdcMintTx(
        VALID_ADDRESS_1,
        VALID_ADDRESS_1,
        BigInt(10000_000000)
      );

      expect(typeof xdr).toBe("string");
    });

    it("uses default amount if not provided", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const xdr = await buildTestnetUsdcMintTx(VALID_ADDRESS_1, VALID_ADDRESS_1);
      expect(typeof xdr).toBe("string");
    });
  });

  describe("updateInvoiceStatus", () => {
    it("calls invoiceContract.updateStatus with correct params", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        results: [{ auth: [], xdr: "mock-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        cost: { cpuInsns: "100", memBytes: "200" },
      });

      const xdr = await updateInvoiceStatus("1", 6, VALID_ADDRESS_1);
      expect(typeof xdr).toBe("string");
    });
  });

  describe("getPositions", () => {
    it("calls marketplaceContract.getPositions", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        error: "Error(Contract, #1)",
      });

      const positions = await getPositions(VALID_ADDRESS_2);
      expect(Array.isArray(positions)).toBe(true);
    });

    it("accepts optional sourcePublicKey parameter", async () => {
      const { rpc } = await import("../client");
      
      (rpc.simulateTransaction as any).mockResolvedValue({
        error: "Error(Contract, #1)",
      });

      const positions = await getPositions(VALID_ADDRESS_2, VALID_ADDRESS_1);
      expect(Array.isArray(positions)).toBe(true);
    });
  });
});

describe("Error Handling", () => {
  beforeEach(() => {
    restoreAssembleMocks();
  });

  it("parses Soroban error codes correctly", async () => {
    const { rpc } = await import("../client");
    
    const errorCodes = [
      { code: "#1", message: "Invoice not found" },
      { code: "#2", message: "Invoice already funded" },
      { code: "#3", message: "Insufficient balance" },
      { code: "#4", message: "Unauthorized: caller is not the owner" },
    ];

    for (const { code, message } of errorCodes) {
      (rpc.simulateTransaction as any).mockResolvedValue({
        error: `Error(Contract, ${code})`,
      });

      await expect(
        invoiceContract.mintInvoice(
          {
            ipfsCid: "test",
            amount: BigInt(1000),
            financingAmount: BigInt(950),
            discountRate: 50,
            dueDate: BigInt(Date.now()),
          },
          VALID_ADDRESS_1
        )
      ).rejects.toThrow(message);
    }
  });
});
