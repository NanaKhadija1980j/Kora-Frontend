import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TxType =
  | "mint_invoice"
  | "fund_invoice"
  | "repay_invoice"
  | "claim_yield"
  | "transfer"
  | "cancel_invoice"
  | "other";

export type TxStatus = "pending" | "confirmed" | "failed";

export interface TransactionRecord {
  hash: string;
  type: TxType;
  status: TxStatus;
  amount?: string; // in USDC or XLM
  assetCode?: string; // USDC, XLM, EURC
  timestamp: number; // Unix ms
  description?: string;
  invoiceId?: string;
  error?: string;
  cancelReason?: string;
  cancelNotes?: string;
}

interface TransactionHistoryStore {
  transactions: TransactionRecord[];
  filterType: string;
  filterStartDate: string | null;
  filterEndDate: string | null;

  addTransaction: (tx: Omit<TransactionRecord, "timestamp"> & { timestamp?: number }) => void;
  updateTransactionStatus: (hash: string, status: TxStatus, error?: string) => void;
  clearHistory: () => void;
  getRecentTransactions: (limit?: number) => TransactionRecord[];
  getTransactionByHash: (hash: string) => TransactionRecord | undefined;
  removeTransaction: (hash: string) => void;

  setFilterType: (type: string) => void;
  setFilterStartDate: (date: string | null) => void;
  setFilterEndDate: (date: string | null) => void;
  resetFilters: () => void;
  getFilteredTransactions: () => TransactionRecord[];
}

export const useTransactionHistoryStore = create<TransactionHistoryStore>()(
  persist(
    (set, get) => ({
      transactions: [],
      filterType: "all",
      filterStartDate: null,
      filterEndDate: null,

      addTransaction: (tx) => {
        set((state) => ({
          transactions: [
            {
              ...tx,
              timestamp: tx.timestamp ?? Date.now(),
            },
            ...state.transactions,
          ].slice(0, 100), // Keep last 100 transactions
        }));
      },

      updateTransactionStatus: (hash, status, error) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.hash === hash ? { ...tx, status, error } : tx
          ),
        }));
      },

      clearHistory: () => set({ transactions: [] }),

      getRecentTransactions: (limit = 10) => {
        return get().transactions.slice(0, limit);
      },

      getTransactionByHash: (hash) => {
        return get().transactions.find((tx) => tx.hash === hash);
      },

      removeTransaction: (hash) => {
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.hash !== hash),
        }));
      },

      setFilterType: (type) => set({ filterType: type }),
      setFilterStartDate: (date) => set({ filterStartDate: date }),
      setFilterEndDate: (date) => set({ filterEndDate: date }),
      resetFilters: () => set({ filterType: "all", filterStartDate: null, filterEndDate: null }),

      getFilteredTransactions: () => {
        const { transactions, filterType, filterStartDate, filterEndDate } = get();
        return transactions.filter((tx) => {
          // 1. Filter by type
          if (filterType !== "all") {
            const txType = tx.type;
            let match = false;
            if (filterType === "mint" && txType === "mint_invoice") match = true;
            else if (filterType === "fund" && txType === "fund_invoice") match = true;
            else if (filterType === "repay" && txType === "repay_invoice") match = true;
            else if (filterType === "claim" && txType === "claim_yield") match = true;
            else if (filterType === "transfer" && txType === "transfer") match = true;
            else if (filterType === "other" && txType === "other") match = true;
            if (!match) return false;
          }

          // 2. Filter by date range
          if (filterStartDate) {
            const startMs = new Date(filterStartDate).getTime();
            if (!isNaN(startMs) && tx.timestamp < startMs) return false;
          }
          if (filterEndDate) {
            const endMs = new Date(filterEndDate).getTime() + 86400000 - 1;
            if (!isNaN(endMs) && tx.timestamp > endMs) return false;
          }

          return true;
        });
      },
    }),
    {
      name: "kora-transaction-history",
      partialize: (state) => ({
        transactions: state.transactions,
        filterType: state.filterType,
        filterStartDate: state.filterStartDate,
        filterEndDate: state.filterEndDate,
      }),
      storage: {
        getItem: (name: string) => {
          if (typeof window === "undefined") return null;
          const str = window.localStorage.getItem(name);
          if (!str) return null;
          try {
            const data = JSON.parse(str);
            const state = data?.state ?? data;
            const rawTransactions = Array.isArray(state?.transactions) ? state.transactions : [];
            const transactions = rawTransactions
              .filter((tx: any) => tx && typeof tx.hash === "string")
              .map((tx: any) => ({
                hash: String(tx.hash),
                type: [
                  "mint_invoice",
                  "fund_invoice",
                  "repay_invoice",
                  "claim_yield",
                  "transfer",
                  "cancel_invoice",
                  "other",
                ].includes(tx.type)
                  ? (tx.type as TxType)
                  : "other",
                status: tx.status === "failed" ? "failed" : tx.status === "confirmed" ? "confirmed" : "pending",
                amount: typeof tx.amount === "string" ? tx.amount : undefined,
                assetCode: typeof tx.assetCode === "string" ? tx.assetCode : undefined,
                timestamp: Number(tx.timestamp) || Date.now(),
                description: typeof tx.description === "string" ? tx.description : undefined,
                invoiceId: typeof tx.invoiceId === "string" ? tx.invoiceId : undefined,
                error: typeof tx.error === "string" ? tx.error : undefined,
                cancelReason: typeof tx.cancelReason === "string" ? tx.cancelReason : undefined,
                cancelNotes: typeof tx.cancelNotes === "string" ? tx.cancelNotes : undefined,
              }))
              .slice(0, 100);
            return {
              state: {
                transactions,
                filterType:
                  typeof state?.filterType === "string" ? state.filterType : "all",
                filterStartDate:
                  typeof state?.filterStartDate === "string"
                    ? state.filterStartDate
                    : null,
                filterEndDate:
                  typeof state?.filterEndDate === "string" ? state.filterEndDate : null,
              },
            };
          } catch {
            return {
              state: {
                transactions: [],
                filterType: "all" as string,
                filterStartDate: null as string | null,
                filterEndDate: null as string | null,
              },
            };
          }
        },
        setItem: (name: string, value: any) => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(name, JSON.stringify(value));
          }
        },
        removeItem: (name: string) => {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(name);
          }
        },
      },
    }
  )
);
