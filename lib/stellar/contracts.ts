/**
 * Soroban contract client — type-safe builders for all invoice and marketplace
 * contract methods. Each method returns an unsigned XDR string ready for the
 * useTransaction hook.
 */
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, networkConfig, sequenceManager } from "./client";
import { env } from "@/lib/env";
import { isValidStellarAddress } from "@/lib/utils";
import { WALLET_ASSETS } from "@/config/walletAssets";
import { parseSorobanError } from "@/lib/stellar/simulationErrors";

import type {
  MintInvoiceParams,
  FundInvoiceParams,
  RepayInvoiceParams,
  ClaimYieldParams,
  TransferPositionParams,
  OnChainInvoice,
} from "@/types/contract";
import type { InvoicePosition } from "@/types/invoice";

// ─── Network-aware contract registry ─────────────────────────────────────────
//
// Each network has its own set of deployed contract addresses.  The active set
// is selected at module load time from NEXT_PUBLIC_STELLAR_NETWORK.
//
// To add a new network entry, extend the NETWORK_CONTRACTS map below and ensure
// the corresponding env vars are set before building.

const SOROBAN_ZERO_ADDRESS =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

/**
 * Per-network contract address registry.
 *
 * Addresses here are the v0.2 testnet deployments.  When a mainnet deployment
 * is made, add a "mainnet" entry and set NEXT_PUBLIC_STELLAR_NETWORK=mainnet.
 */
const NETWORK_CONTRACTS: Record<
  string,
  { invoice: string; marketplace: string; token: string }
> = {
  testnet: {
    invoice: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    marketplace: "CBWOAOZCOAJQH7HHZRE5BVNL2C4HRP4JCQZF3YQCQYDL5BZJRN4YGK4",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
  // mainnet: { invoice: "C...", marketplace: "C...", token: "C..." },
};

/**
 * Resolve contract addresses with the following priority:
 *   1. Env vars (`.env.local` / CI secrets) — allows overriding per-deployment
 *   2. Built-in NETWORK_CONTRACTS registry for the active network
 *
 * In live mode (NEXT_PUBLIC_ENABLE_MOCK_DATA=false) the resolved addresses are
 * validated: they must be non-empty and not the Soroban zero-address.
 */
function resolveContractAddresses(): {
  invoiceContractId: string;
  marketplaceContractId: string;
  tokenContractId: string;
} {
  const network = env.NEXT_PUBLIC_STELLAR_NETWORK;
  const networkDefaults = NETWORK_CONTRACTS[network];

  const invoiceContractId =
    env.NEXT_PUBLIC_INVOICE_CONTRACT_ID ||
    networkDefaults?.invoice ||
    SOROBAN_ZERO_ADDRESS;

  const marketplaceContractId =
    env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID ||
    networkDefaults?.marketplace ||
    SOROBAN_ZERO_ADDRESS;

  const tokenContractId =
    env.NEXT_PUBLIC_TOKEN_CONTRACT_ID ||
    networkDefaults?.token ||
    SOROBAN_ZERO_ADDRESS;

  // Fail fast in live mode if any contract resolves to the zero-address.
  // env.ts already performs this check at startup, but we repeat it here as a
  // defense-in-depth guard for direct module imports in server contexts.
  if (!env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
    const zeroAddrs: string[] = [];
    if (invoiceContractId === SOROBAN_ZERO_ADDRESS)
      zeroAddrs.push("NEXT_PUBLIC_INVOICE_CONTRACT_ID");
    if (marketplaceContractId === SOROBAN_ZERO_ADDRESS)
      zeroAddrs.push("NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID");
    if (tokenContractId === SOROBAN_ZERO_ADDRESS)
      zeroAddrs.push("NEXT_PUBLIC_TOKEN_CONTRACT_ID");

    if (zeroAddrs.length > 0) {
      throw new Error(
        `[contracts] Live mode is active but the following contract IDs resolve ` +
          `to the Soroban zero-address on ${network}:\n` +
          zeroAddrs.map((k) => `  ${k}`).join("\n") +
          `\nSet real deployed addresses in your .env.local or add them to ` +
          `NETWORK_CONTRACTS in lib/stellar/contracts.ts.`,
      );
    }
  }

  return { invoiceContractId, marketplaceContractId, tokenContractId };
}

const {
  invoiceContractId: INVOICE_CONTRACT_ID_RESOLVED,
  marketplaceContractId: MARKETPLACE_CONTRACT_ID_RESOLVED,
  tokenContractId: TOKEN_CONTRACT_ID_RESOLVED,
} = resolveContractAddresses();

// ─── XDR helpers ──────────────────────────────────────────────────────────────

function scvString(s: string): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvString(s);
}

function scvU64(n: bigint): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvU64(
    StellarSdk.xdr.Uint64.fromString(n.toString())
  );
}

function scvI128(n: bigint): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvI128(
    new StellarSdk.xdr.Int128Parts({
      hi: StellarSdk.xdr.Int64.fromString("0"),
      lo: StellarSdk.xdr.Uint64.fromString(n.toString()),
    })
  );
}

function scvU32(n: number): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvU32(n);
}

function scvAddress(address: string): StellarSdk.xdr.ScVal {
  if (!isValidStellarAddress(address)) {
    throw new Error("Invalid Stellar address format");
  }
  return new StellarSdk.Address(address).toScVal();
}

// ─── Simulation wrapper ───────────────────────────────────────────────────────

/**
 * Simulate a transaction and return the assembled (resource-footprinted) XDR.
 * Throws a human-readable error if simulation fails.
 */
async function simulate(
  tx: StellarSdk.Transaction
): Promise<StellarSdk.Transaction> {
  const simResult = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
    throw new Error(parseSorobanError(simResult.error));
  }
  return StellarSdk.rpc.assembleTransaction(tx, simResult).build();
}

// ─── Core builder ─────────────────────────────────────────────────────────────

async function buildCall(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sourcePublicKey: string
): Promise<string> {
  if (!isValidStellarAddress(sourcePublicKey)) {
    throw new Error("Invalid Stellar address format");
  }
  // Use the sequence manager for optimistic local incrementing so back-to-back
  // calls don't collide on the same committed sequence number from the network.
  const account = await sequenceManager.nextAccount(sourcePublicKey);
  const contract = new StellarSdk.Contract(contractId);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const assembled = await simulate(tx);
  return assembled.toXDR();
}

/**
 * Simulate a read-only call and parse the return value.
 */
async function readCall<T>(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sourcePublicKey: string,
  parser: (val: StellarSdk.xdr.ScVal) => T
): Promise<T> {
  if (!isValidStellarAddress(sourcePublicKey)) {
    throw new Error("Invalid Stellar address format");
  }
  const account = await rpc.getAccount(sourcePublicKey);
  const contract = new StellarSdk.Contract(contractId);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
    throw new Error(parseSorobanError(simResult.error));
  }
  if (!simResult.result?.retval) {
    throw new Error("No return value from contract");
  }
  return parser(simResult.result.retval);
}

// ─── Invoice Contract ─────────────────────────────────────────────────────────

const INVOICE_CONTRACT_ID = INVOICE_CONTRACT_ID_RESOLVED;

class InvoiceContractClient {
  readonly contractId = INVOICE_CONTRACT_ID;

  /**
   * Mint a new invoice NFT.
   * Returns unsigned XDR string.
   */
  async mintInvoice(
    params: MintInvoiceParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "mint_invoice",
      [
        scvString(params.ipfsCid),
        scvI128(params.amount),
        scvI128(params.financingAmount),
        scvU32(params.discountRate),
        scvU64(params.dueDate),
      ],
      sourcePublicKey
    );
  }

  /**
   * Read invoice state from chain (simulation only, no signature needed).
   */
  async getInvoice(
    tokenId: bigint,
    sourcePublicKey: string
  ): Promise<OnChainInvoice> {
    return readCall(
      this.contractId,
      "get_invoice",
      [scvU64(tokenId)],
      sourcePublicKey,
      parseOnChainInvoice
    );
  }

  /**
   * Batch-fetch multiple invoices by tokenId using concurrent simulations.
   * Returns a map of tokenId (string) → OnChainInvoice. Entries that fail
   * are omitted from the result rather than throwing, so one bad ID doesn't
   * abort the whole batch.
   */
  async batchGetInvoices(
    tokenIds: bigint[],
    sourcePublicKey: string
  ): Promise<Map<string, OnChainInvoice>> {
    const results = await Promise.allSettled(
      tokenIds.map((id) => this.getInvoice(id, sourcePublicKey))
    );
    const map = new Map<string, OnChainInvoice>();
    for (let i = 0; i < tokenIds.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        map.set(tokenIds[i].toString(), r.value);
      }
    }
    return map;
  }
  async updateStatus(
    tokenId: bigint,
    status: number,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "update_status",
      [scvU64(tokenId), scvU32(status)],
      sourcePublicKey
    );
  }

  /**
   * Cancel an invoice (owner only). Only cancellable if pending or unfunded.
   * Status code: 6 for cancelled
   * Returns unsigned XDR string.
   */
  async cancelInvoice(
    tokenId: bigint,
    sourcePublicKey: string
  ): Promise<string> {
    // Status code 6 = cancelled
    return this.updateStatus(tokenId, 6, sourcePublicKey);
  }
}

// ─── Marketplace Contract ─────────────────────────────────────────────────────

const MARKETPLACE_CONTRACT_ID = MARKETPLACE_CONTRACT_ID_RESOLVED;
const TOKEN_CONTRACT_ID = TOKEN_CONTRACT_ID_RESOLVED;

class MarketplaceContractClient {
  readonly contractId = MARKETPLACE_CONTRACT_ID;

  /**
   * Investor funds an invoice.
   * Returns unsigned XDR string.
   */
  async fundInvoice(
    params: FundInvoiceParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "fund_invoice",
      [scvU64(params.tokenId), scvI128(params.amount)],
      sourcePublicKey
    );
  }

  /**
   * SME repays an invoice; triggers yield distribution.
   * Returns unsigned XDR string.
   */
  async repayInvoice(
    params: RepayInvoiceParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "repay_invoice",
      [scvU64(params.tokenId)],
      sourcePublicKey
    );
  }

  async claimPosition(
    params: { positionId: bigint },
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "claim_position",
      [scvU64(params.positionId)],
      sourcePublicKey
    );
  }

  /**
   * Read all investor positions (simulation only).
   */
  async getPositions(
    investor: string,
    sourcePublicKey: string
  ): Promise<InvoicePosition[]> {
    try {
      return await readCall(
        this.contractId,
        "get_positions",
        [scvAddress(investor)],
        sourcePublicKey,
        parseInvoicePositions
      );
    } catch (err) {
      // Contract returns an error when investor has no positions — treat as empty
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("No return value") || msg.includes("#1")) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Investor claims yield from a repaid position.
   * Returns unsigned XDR string.
   */
  async claimYield(
    params: ClaimYieldParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "claim_yield",
      [scvU64(params.tokenId)],
      sourcePublicKey
    );
  }

  /**
   * P2P secondary-market transfer of an investor position to a new owner.
   * See the `TransferPositionParams` doc comment in types/contract.ts for
   * the assumed contract ABI. Returns unsigned XDR string, to be signed by
   * the current position owner (`sourcePublicKey`).
   */
  async transferPosition(
    params: TransferPositionParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "transfer_position",
      [scvU64(params.positionId), scvAddress(params.toAddress)],
      sourcePublicKey
    );
  }
}

// ─── ScVal parsers ────────────────────────────────────────────────────────────

function parseOnChainInvoice(val: StellarSdk.xdr.ScVal): OnChainInvoice {
  // The contract returns a map; parse each field by key name.
  const map = val.map();
  if (!map) throw new Error("Expected map from get_invoice");

  function getField(key: string): StellarSdk.xdr.ScVal {
    const entry = map!.find(
      (e) => e.key().sym()?.toString() === key
    );
    if (!entry) throw new Error(`Missing field: ${key}`);
    return entry.val();
  }

  return {
    token_id: BigInt(getField("token_id").u64().toString()),
    owner: StellarSdk.Address.fromScVal(getField("owner")).toString(),
    ipfs_cid: getField("ipfs_cid").str()?.toString() ?? "",
    amount: BigInt(getField("amount").i128().lo().toString()),
    financing_amount: BigInt(getField("financing_amount").i128().lo().toString()),
    discount_rate: getField("discount_rate").u32(),
    due_date: BigInt(getField("due_date").u64().toString()),
    status: getField("status").u32(),
    funded_amount: BigInt(getField("funded_amount").i128().lo().toString()),
  };
}

/**
 * Parse a vec of position maps returned by `get_positions`.
 * Each entry is expected to be a map with: token_id, investor, amount, expected_return, yield_earned, invested_at, status.
 */
function parseInvoicePositions(val: StellarSdk.xdr.ScVal): InvoicePosition[] {
  // The contract may return a vec of position structs
  if (val.switch().name !== "scvVec") return [];
  const vec = val.vec();
  if (!vec || vec.length === 0) return [];

  return vec
    .map((entry): InvoicePosition | null => {
      try {
        const map = entry.map();
        if (!map) return null;

        function getField(key: string): StellarSdk.xdr.ScVal | undefined {
          return map!.find((e) => {
            try { return e.key().sym()?.toString() === key; } catch { return false; }
          })?.val();
        }

        const tokenIdVal = getField("token_id");
        const amountVal = getField("amount") ?? getField("invested_amount");
        const expectedVal = getField("expected_return");
        const yieldVal = getField("yield_earned");
        const investedAtVal = getField("invested_at");
        const statusVal = getField("status");

        if (!tokenIdVal || !amountVal) return null;

        const tokenId = tokenIdVal.u64()?.toString() ?? "0";
        const investedAmount = Number(amountVal.i128()?.lo()?.toString() ?? "0") / 1_000_000;
        const expectedReturn = expectedVal
          ? Number(expectedVal.i128()?.lo()?.toString() ?? "0") / 1_000_000
          : investedAmount;
        const yieldEarned = yieldVal
          ? Number(yieldVal.i128()?.lo()?.toString() ?? "0") / 1_000_000
          : 0;
        const investedAt = investedAtVal
          ? new Date(Number(investedAtVal.u64()?.toString() ?? "0") * 1000).toISOString()
          : new Date().toISOString();
        const rawStatus = statusVal?.u32() ?? 0;
        const status = rawStatus === 2 ? "repaid" : rawStatus === 3 ? "defaulted" : "active";

        // Minimal invoice stub — real data will be fetched via getInvoice if needed
        return {
          invoiceId: tokenId,
          invoice: {
            id: tokenId,
            tokenId,
            contractAddress: MARKETPLACE_CONTRACT_ID,
            ipfsCid: "",
            metadata: {
              invoiceNumber: `INV-${tokenId}`,
              issuerName: "",
              issuerAddress: "",
              debtorName: "",
              debtorAddress: "",
              amount: expectedReturn,
              currency: "USDC",
              issueDate: investedAt,
              dueDate: investedAt,
              description: "",
              jurisdiction: "OTHER",
              category: "other",
              documentHash: "",
              documentUrl: "",
            },
            terms: {
              discountRate: investedAmount > 0 ? (expectedReturn - investedAmount) / investedAmount : 0,
              apr: 0,
              financingAmount: expectedReturn,
              minInvestment: 0,
              maxInvestment: expectedReturn,
              tenor: 0,
              repaymentDate: investedAt,
            },
            funding: {
              totalRaised: investedAmount,
              targetAmount: investedAmount,
              fundingProgress: 1,
              investorCount: 1,
              remainingCapacity: 0,
            },
            riskTier: "A",
            riskScore: 75,
            debtorPrivacy: "partial",
            status: status === "repaid" ? "repaid" : "active",
            createdAt: investedAt,
            updatedAt: investedAt,
            ownerAddress: "",
          } as any,
          investedAmount,
          expectedReturn,
          yieldEarned,
          investedAt,
          status,
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is InvoicePosition => p !== null);
}

// ─── Singleton exports ────────────────────────────────────────────────────────

export const invoiceContract = new InvoiceContractClient();
export const marketplaceContract = new MarketplaceContractClient();

/**
 * Build an unsigned transaction to mint testnet USDC to a wallet.
 *
 * Used by the investor onboarding faucet (`mintTestnetUsdc` / fund panel CTA).
 * Callers must gate this behind a testnet-only check — never invoke on mainnet.
 *
 * @param recipient       Address that receives the minted USDC
 * @param sourcePublicKey Account that signs / pays fees
 * @param amount          Amount in token base units (7 decimals). Default = 10,000 USDC.
 */
export async function buildTestnetUsdcMintTx(
  recipient: string,
  sourcePublicKey: string,
  amount: bigint = BigInt("100000000000")
): Promise<string> {
  return buildCall(
    TOKEN_CONTRACT_ID,
    "mint",
    [scvAddress(recipient), scvI128(amount)],
    sourcePublicKey
  );
}

export async function buildAddTrustlineTx(
  sourcePublicKey: string,
  assetCode: keyof typeof WALLET_ASSETS = "eurc"
): Promise<string> {
  if (!isValidStellarAddress(sourcePublicKey)) {
    throw new Error("Invalid Stellar address format");
  }
  const configuredAsset = WALLET_ASSETS[assetCode];
  const account = await sequenceManager.nextAccount(sourcePublicKey);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: configuredAsset.asset,
        limit: configuredAsset.trustlineLimit,
      })
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

/**
 * Build an unsigned XDR transaction that calls `update_status` on the invoice
 * contract. The caller is responsible for verifying ownership before calling.
 *
 * @param tokenId       On-chain token ID (string, BigInt-convertible).
 * @param status        Target status as the on-chain enum index.
 * @param walletAddress Wallet that will sign — must be the invoice owner on-chain.
 */
export async function updateInvoiceStatus(
  tokenId: string,
  status: number,
  walletAddress: string
): Promise<string> {
  return invoiceContract.updateStatus(BigInt(tokenId), status, walletAddress);
}

/**
 * Read all investor positions for the given investor address.
 *
 * @param investor       The investor address.
 * @param sourcePublicKey Optional source public key (defaults to investor).
 */
export async function getPositions(
  investor: string,
  sourcePublicKey: string = investor
): Promise<InvoicePosition[]> {
  return marketplaceContract.getPositions(investor, sourcePublicKey);
}

/**
 * P2P secondary-market transfer of an investor position.
 * Returns an unsigned XDR string ready for signing by the seller.
 *
 * @param positionId     On-chain position ID (string, BigInt-convertible).
 * @param toAddress      Recipient's Stellar G-address.
 * @param sellerAddress  Current owner's Stellar G-address (transaction signer).
 */
export async function transferPosition(
  positionId: string,
  toAddress: string,
  sellerAddress: string
): Promise<string> {
  return marketplaceContract.transferPosition(
    { positionId: BigInt(positionId), toAddress },
    sellerAddress
  );
}

// Re-export low-level helpers for advanced use
export { buildCall, readCall, parseSorobanError, simulate, scvAddress };

