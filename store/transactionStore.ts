import { create } from "zustand";
import { persist } from "zustand/middleware";

// 🎯 Types ────────────────────────────────────────────────────────────

export type TxType = "mint" | "fund" | "repay" | "claim" | "transfer" | "escrow_fund" | "escrow_transfer";
export type TxStatus = "confirmed" | "failed";

export interface TxRecord {
  /** Stellar transaction hash (64-char hex) */
  hash: string;
  /** Type of operation performed */
  type: TxType;
  /** Invoice ID this transaction relates to, if applicable */
  invoiceId?: string;
  /** Invoice number for display (e.g. "INV-2024-0891") */
  invoiceNumber?: string;
  /** Amount involved in the transaction (USDC) */
  amount?: number;
  /** Currency of the amount */
  currency?: string;
  /** Final status */
  status: TxStatus;
  /** ISO timestamp when the transaction was recorded */
  timestamp: string;
  /** Human-readable description */
  description?: string;
  /** Cancellation reason for cancelled invoice transactions */
  cancelReason?: string;
  /** Additional cancellation notes */
  cancelNotes?: string;
}

// 🧩 Types ────────────────────────────────────────────────────────────

export type EscrowStep = "idle" | "buyer_funding" | "buyer_funded" | "seller_transferring" | "seller_transferred" | "settled";

export interface EscrowStepAttempt {
  step: "buyer_funding" | "seller_transferring";
  attemptNumber: number;
  timestamp: string; // ISO 8601
  success: boolean;
  errorMessage?: string;
  txHash?: string;
  positionId?: string;
  buyerAddress?: string;
  sellerAddress?: string;
  amount?: number;
}

export interface EscrowState {
  step: EscrowStep;
  errorStep?: "buyer_funding" | "seller_transferring" | null;
  errorMessage?: string | null;
  txHash?: string | null;
  /** Ledger of all escrow step attempts for retry history */
  attemptHistory: EscrowStepAttempt[];
  /** Current attempt being executed */
  currentAttempt?: EscrowStepAttempt;
  /** Total retry count for current flow */
  totalRetryCount: number;
  /** Position/buyer/seller context for retry */
  currentContext?: {
    positionId: string;
    buyerAddress: string;
    sellerAddress: string;
    amount: number;
  };
}

interface TransactionStore {
  /** Ordered list of transactions — newest first */
  transactions: TxRecord[];

  /** Secondary Escrow State Machine state */
  escrowState: EscrowState;

  /** Add a new confirmed or failed transaction record */
  addTransaction: (record: Omit<TxRecord, "timestamp"> & { timestamp?: string }) => void;

  /** Remove a single transaction by hash */
  removeTransaction: (hash: string) => void;

  /** Wipe the entire history */
  clearHistory: () => void;

  /** Update escrow step */
  setEscrowStep: (step: EscrowStep) => void;

  /** Set escrow error step and message */
  setEscrowError: (errorStep: "buyer_funding" | "seller_transferring" | null, message: string | null) => void;

  /** Reset escrow state */
  resetEscrow: () => void;

  /** Record an escrow step attempt in the history ledger */
  recordEscrowAttempt: (attempt: EscrowStepAttempt) => void;

  /** Set the current attempt being executed */
  setCurrentAttempt: (attempt: EscrowStepAttempt | undefined) => void;

  /** Increment total retry count */
  incrementRetryCount: () => void;

  /** Set the current escrow context (position/buyer/seller/amount) */
  setEscrowContext: (context: { positionId: string; buyerAddress: string; sellerAddress: string; amount: number } | null) => void;
}

// 💾 Defaults ──────────────────────────────────────────────────────────

const MAX_HISTORY = 200; // cap to avoid unbounded localStorage growth

const DEFAULT_ESCROW_STATE: EscrowState = {
  step: "idle",
  errorStep: null,
  errorMessage: null,
  txHash: null,
  attemptHistory: [] as EscrowStepAttempt[],
  currentAttempt: undefined,
  totalRetryCount: 0,
  currentContext: undefined as { positionId: string; buyerAddress: string; sellerAddress: string; amount: number } | undefined,
};

interface TransactionStore {
  /** Ordered list of transactions — newest first */
  transactions: TxRecord[];

  /** Secondary Escrow State Machine state */
  escrowState: {
    step: "idle" | "buyer_funding" | "buyer_funded" | "seller_transferring" | "seller_transferred" | "settled";
    errorStep?: "buyer_funding" | "seller_transferring" | null;
    errorMessage?: string | null;
    txHash?: string | null;
    attemptHistory: EscrowStepAttempt[];
    currentAttempt?: EscrowStepAttempt;
    totalRetryCount: number;
    currentContext?: {
      positionId: string;
      buyerAddress: string;
      sellerAddress: string;
      amount: number;
    };
  };

  /** Add a new confirmed or failed transaction record */
  addTransaction: (record: Omit<TxRecord, "timestamp"> & { timestamp?: string }) => void;

  /** Remove a single transaction by hash */
  removeTransaction: (hash: string) => void;

  /** Wipe the entire history */
  clearHistory: () => void;

  /** Update escrow step */
  setEscrowStep: (step: "idle" | "buyer_funding" | "buyer_funded" | "seller_transferring" | "seller_transferred" | "settled") => void;

  /** Set escrow error step and message */
  setEscrowError: (errorStep: "buyer_funding" | "seller_transferring" | null, message: string | null) => void;

  /** Reset escrow state */
  resetEscrow: () => void;

  /** Record an escrow step attempt in the history ledger */
  recordEscrowAttempt: (attempt: {
    step: "buyer_funding" | "seller_transferring";
    attemptNumber: number;
    timestamp: string;
    success: boolean;
    errorMessage?: string;
    txHash?: string;
    positionId?: string;
    buyerAddress?: string;
    sellerAddress?: string;
    amount?: number;
  }) => void;

  /** Set the current attempt being executed */
  setCurrentAttempt: (attempt: {
    step: "buyer_funding" | "seller_transferring";
    attemptNumber: number;
    timestamp: string;
    success: boolean;
    errorMessage?: string;
    txHash?: string;
    positionId?: string;
    buyerAddress?: string;
    sellerAddress?: string;
    amount?: number;
  } | undefined) => void;

  /** Increment total retry count */
  incrementRetryCount: () => void;

  /** Set the current escrow context (position/buyer/seller/amount) */
  setEscrowContext: (context: { positionId: string; buyerAddress: string; sellerAddress: string; amount: number } | null) => void;
}

// 🏪 Store ────────────────────────────────────────────────────────────

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set) => ({
      transactions: [],
      escrowState: { ...DEFAULT_ESCROW_STATE },

      addTransaction: (record) =>
        set((s) => {
          const entry: TxRecord = {
            ...record,
            timestamp: record.timestamp ?? new Date().toISOString(),
          };
          // Deduplicate by hash — replace if already exists (e.g. status update)
          const filtered = s.transactions.filter((t) => t.hash !== entry.hash);
          return {
            transactions: [entry, ...filtered].slice(0, MAX_HISTORY),
          };
        }),

      removeTransaction: (hash) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => t.hash !== hash),
        })),

      clearHistory: () => set({ transactions: [] }),

      setEscrowStep: (step) =>
        set((s) => ({
          escrowState: {
            ...s.escrowState,
            step,
            // Clear error when transitioning out of error states or starting over
            ...(step === "buyer_funding" || step === "seller_transferring"
              ? { errorStep: null, errorMessage: null }
              : {}),
          },
        })),

      setEscrowError: (errorStep, message) =>
        set((s) => ({
          escrowState: {
            ...s.escrowState,
            errorStep,
            errorMessage: message,
          },
        })),

      resetEscrow: () =>
        set((s) => ({
          escrowState: {
            ...DEFAULT_ESCROW_STATE,
            attemptHistory: s.escrowState.attemptHistory,
            totalRetryCount: s.escrowState.totalRetryCount,
            currentContext: s.escrowState.currentContext,
          },
        })),

      recordEscrowAttempt: (attempt) =>
        set((s) => ({
          escrowState: {
            ...s.escrowState,
            attemptHistory: [...s.escrowState.attemptHistory, attempt],
            totalRetryCount: s.escrowState.totalRetryCount + 1,
            currentAttempt: undefined,
          },
        })),

      setCurrentAttempt: (attempt) =>
        set((s) => ({
          escrowState: {
            ...s.escrowState,
            currentAttempt: attempt,
          },
        })),

      incrementRetryCount: () =>
        set((s) => ({
          escrowState: {
            ...s.escrowState,
            totalRetryCount: s.escrowState.totalRetryCount + 1,
          },
        })),

      setEscrowContext: (context) =>
        set((s) => ({
          escrowState: {
            ...s.escrowState,
            currentContext: context ?? undefined,
          },
        })),
    }),
    {
      name: "kora-tx-history",
      // Persist the transactions array and escrowState
      partialize: (state) => ({
        transactions: state.transactions,
        escrowState: state.escrowState,
      }),
    }
  )
);
