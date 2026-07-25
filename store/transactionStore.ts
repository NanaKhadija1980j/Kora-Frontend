import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxType = "mint" | "fund" | "repay" | "claim";
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
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface TransactionStore {
  /** Ordered list of transactions — newest first */
  transactions: TxRecord[];

  /** Add a new confirmed or failed transaction record */
  addTransaction: (record: Omit<TxRecord, "timestamp"> & { timestamp?: string }) => void;

  /** Remove a single transaction by hash */
  removeTransaction: (hash: string) => void;

  /** Wipe the entire history */
  clearHistory: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 200; // cap to avoid unbounded localStorage growth

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set) => ({
      transactions: [],

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
    }),
    {
      name: "kora-tx-history",
      // Persist the full transactions array
      partialize: (state) => ({ transactions: state.transactions }),
    }
  )
);
