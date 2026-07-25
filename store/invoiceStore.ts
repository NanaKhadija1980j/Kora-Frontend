import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Invoice, InvoiceFunding, InvoiceStatus } from "@/types";
import type { InvoiceDetailsStepSchema } from "@/lib/validations/invoice";
import {
  createPersistentJSONStorage,
  safeStorageGetItem,
  safeStorageSetItem,
} from "./storageAdapter";
import { MAX_COMPARISON_INVOICES } from "@/lib/comparison";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterState {
  categories: string[];
  jurisdictions: string[];
  riskTiers: string[];
  aprRange: [number, number];
  activeOnly: boolean;
  showExpired: boolean;
}

export interface SortState {
  sortBy: "apr" | "amount" | "dueDate" | "listed";
  sortDir: "asc" | "desc";
}

export type InvoiceCreateDraft = Partial<InvoiceDetailsStepSchema> & {
  currency?: "USDC" | "EURC" | "XLM";
  issueDate?: string;
  discountRate?: number;
  minInvestment?: number;
  listingExpiryDate?: string;
  description?: string;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_FILTERS: FilterState = {
  categories: [],
  jurisdictions: [],
  riskTiers: [],
  aprRange: [0, 50],
  activeOnly: false,
  showExpired: false,
};

const DEFAULT_SORT: SortState = { sortBy: "apr", sortDir: "desc" };

// ─── Pure selector ────────────────────────────────────────────────────────────

export function getFilteredInvoices(
  invoices: Invoice[],
  filters: FilterState,
  sort: SortState,
  searchQuery = ""
): Invoice[] {
  let result = invoices;

  if (filters.categories.length > 0) {
    result = result.filter((i) => filters.categories.includes(i.metadata.category));
  }
  if (filters.jurisdictions.length > 0) {
    result = result.filter((i) => filters.jurisdictions.includes(i.metadata.jurisdiction));
  }
  if (filters.riskTiers.length > 0) {
    result = result.filter((i) => filters.riskTiers.includes(i.riskTier));
  }
  const [minApr, maxApr] = filters.aprRange;
  result = result.filter((i) => i.terms.apr >= minApr && i.terms.apr <= maxApr);
  if (filters.activeOnly) {
    result = result.filter((i) => i.status === "listed" || i.status === "partially_funded");
  }
  
  // Filter by expiry status
  if (!filters.showExpired) {
    const now = new Date();
    result = result.filter((i) => {
      if (i.status === "cancelled") return false;
      if (!i.listingExpiry) return true;
      return new Date(i.listingExpiry) > now;
    });
  }
  
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (i) =>
        i.metadata.debtorName.toLowerCase().includes(q) ||
        i.metadata.invoiceNumber.toLowerCase().includes(q) ||
        i.metadata.jurisdiction.toLowerCase().includes(q)
    );
  }

  return [...result].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sort.sortBy) {
      case "apr":
        aVal = a.terms.apr; bVal = b.terms.apr; break;
      case "amount":
        aVal = a.metadata.amount; bVal = b.metadata.amount; break;
      case "dueDate":
        aVal = new Date(a.metadata.dueDate).getTime();
        bVal = new Date(b.metadata.dueDate).getTime();
        break;
      case "listed":
      default:
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
    }
    return sort.sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });
}

type FilterCacheEntry = {
  invoicesRef: Invoice[];
  filters: FilterState;
  sort: SortState;
  searchQuery: string;
  result: Invoice[];
};

let filterCache: FilterCacheEntry | null = null;

function readFilteredInvoices(
  invoices: Invoice[],
  filters: FilterState,
  sort: SortState,
  searchQuery: string
): Invoice[] {
  if (
    filterCache &&
    filterCache.invoicesRef === invoices &&
    filterCache.filters === filters &&
    filterCache.sort === sort &&
    filterCache.searchQuery === searchQuery
  ) {
    return filterCache.result;
  }

  const result = getFilteredInvoices(invoices, filters, sort, searchQuery);
  filterCache = { invoicesRef: invoices, filters, sort, searchQuery, result };
  return result;
}

/** React hook — memoized filtered invoice list keyed on store filter state. */
export function useFilteredInvoices(): Invoice[] {
  const { invoices, filters, sort, searchQuery } = useInvoiceStore(
    useShallow((state) => ({
      invoices: state.invoices,
      filters: state.filters,
      sort: state.sort,
      searchQuery: state.searchQuery,
    }))
  );

  return useMemo(
    () => getFilteredInvoices(invoices, filters, sort, searchQuery),
    [invoices, filters, sort, searchQuery]
  );
}

// ─── URL serialization ────────────────────────────────────────────────────────

export function toQueryParams(filters: FilterState, sort: SortState): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.categories.length) p.set("categories", filters.categories.join(","));
  if (filters.jurisdictions.length) p.set("jurisdictions", filters.jurisdictions.join(","));
  if (filters.riskTiers.length) p.set("riskTiers", filters.riskTiers.join(","));
  if (filters.aprRange[0] !== 0) p.set("aprMin", String(filters.aprRange[0]));
  if (filters.aprRange[1] !== 50) p.set("aprMax", String(filters.aprRange[1]));
  if (filters.activeOnly) p.set("activeOnly", "1");
  if (filters.showExpired) p.set("showExpired", "1");
  if (sort.sortBy !== "apr") p.set("sortBy", sort.sortBy);
  if (sort.sortDir !== "desc") p.set("sortDir", sort.sortDir);
  return p;
}

export function fromQueryParams(params: URLSearchParams): {
  filters: FilterState;
  sort: SortState;
} {
  return {
    filters: {
      categories: params.get("categories")?.split(",").filter(Boolean) ?? [],
      jurisdictions: params.get("jurisdictions")?.split(",").filter(Boolean) ?? [],
      riskTiers: params.get("riskTiers")?.split(",").filter(Boolean) ?? [],
      aprRange: [
        Number(params.get("aprMin") ?? 0),
        Number(params.get("aprMax") ?? 50),
      ],
      activeOnly: params.get("activeOnly") === "1",
      showExpired: params.get("showExpired") === "1",
    },
    sort: {
      sortBy: (params.get("sortBy") as SortState["sortBy"]) ?? "apr",
      sortDir: (params.get("sortDir") as SortState["sortDir"]) ?? "desc",
    },
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

const SEARCH_HISTORY_KEY = "kora-search-history";
const MAX_HISTORY = 5;

function loadSearchHistory(): string[] {
  try {
    return JSON.parse(safeStorageGetItem(SEARCH_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSearchHistory(history: string[]) {
  safeStorageSetItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

type FundingBackup = InvoiceFunding & { status: InvoiceStatus };

interface InvoiceStore {
  invoices: Invoice[];
  /** tokenId → Invoice map, maintained by batch polling */
  invoicesByTokenId: Record<string, Invoice>;
  filters: FilterState;
  sort: SortState;
  sortBy: string;
  searchQuery: string;
  searchHistory: string[];
  selectedInvoice: Invoice | null;
  createDraft: InvoiceCreateDraft;

  /** IDs of invoices selected for side-by-side comparison (max 4) */
  comparisonList: string[];

  // Actions
  setInvoices: (invoices: Invoice[]) => void;
  /** Merge a batch of invoices into invoicesByTokenId (and sync invoices array). */
  mergeInvoicesBatch: (batch: Invoice[]) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  updateSingleFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  setSort: (sort: Partial<SortState>) => void;
  setSortBy: (sortBy: string) => void;
  setSearchQuery: (q: string) => void;
  clearSearchHistory: () => void;
  setSelectedInvoice: (invoice: Invoice | null) => void;
  updateInvoiceFunding: (id: string, newAmount: number) => void;
  rollbackInvoiceFunding: (id: string) => void;
  updateInvoiceStatus: (id: string, status: Invoice["status"]) => void;
  rollbackInvoiceStatus: (id: string) => void;
  // internal backup map (not persisted)
  _fundingBackup?: Record<string, FundingBackup>;
  _statusBackup?: Record<string, { status: Invoice["status"] }>;
  setCreateDraft: (draft: Partial<InvoiceCreateDraft>) => void;
  clearCreateDraft: () => void;

  /** Toggle an invoice in/out of the comparison list (max 4) */
  toggleComparison: (id: string) => void;
  /** Replace the comparison list (capped at max) */
  setComparisonList: (ids: string[]) => void;
  /** Remove a single invoice from the comparison list */
  removeFromComparison: (id: string) => void;
  /** Clear the entire comparison list */
  clearComparison: () => void;

  // Derived
  getFiltered: () => Invoice[];
}

export const useInvoiceStore = create<InvoiceStore>()(
  persist(
    (set, get) => ({
      invoices: [],
      invoicesByTokenId: {},
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
      sortBy: "apr_desc",
      searchQuery: "",
      searchHistory: loadSearchHistory(),
      selectedInvoice: null,
      createDraft: { currency: "USDC" },
      comparisonList: [],

      setInvoices: (invoices) => set({ invoices }),

      mergeInvoicesBatch: (batch) =>
        set((s) => {
          const byTokenId = { ...s.invoicesByTokenId };
          for (const inv of batch) {
            byTokenId[inv.tokenId] = inv;
          }
          // Merge into main invoices array: update existing entries, append new ones
          const existingIds = new Set(s.invoices.map((i) => i.tokenId));
          const merged = s.invoices.map((inv) =>
            byTokenId[inv.tokenId] ? byTokenId[inv.tokenId] : inv
          );
          for (const inv of batch) {
            if (!existingIds.has(inv.tokenId)) merged.push(inv);
          }
          return { invoicesByTokenId: byTokenId, invoices: merged };
        }),

      setFilters: (filters) =>
        set((s) => ({ filters: { ...s.filters, ...filters } })),

      updateSingleFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),

      resetFilters: () =>
        set({ filters: DEFAULT_FILTERS, searchQuery: "", sortBy: "apr_desc" }),

      setSort: (sort) =>
        set((s) => ({ sort: { ...s.sort, ...sort }, sortBy: sort.sortBy ?? s.sort.sortBy })),

      setSortBy: (sortBy) =>
        set((s) => ({
          sort: { ...s.sort, sortBy: sortBy.split("_")[0] as SortState["sortBy"] },
          sortBy,
        })),

      setSearchQuery: (searchQuery) =>
        set((s) => {
          const trimmed = searchQuery.trim();
          let history = s.searchHistory;
          if (trimmed && !history.includes(trimmed)) {
            history = [trimmed, ...history].slice(0, MAX_HISTORY);
            saveSearchHistory(history);
          }
          return { searchQuery, searchHistory: history };
        }),

      clearSearchHistory: () => {
        saveSearchHistory([]);
        set({ searchHistory: [] });
      },

      setSelectedInvoice: (selectedInvoice) => set({ selectedInvoice }),

      /** Optimistic update — instantly reflects new funding amount in UI */
      updateInvoiceFunding: (id, newAmount) =>
        set((s) => {
          const prev = s.invoices.find((i) => i.id === id);
          const backup = prev ? { ...prev.funding, status: prev.status } : undefined;
          const nextInvoices = s.invoices.map((inv) => {
            if (inv.id !== id) return inv;
            const totalRaised = Math.min(newAmount, inv.funding.targetAmount);
            const isFull = totalRaised >= inv.funding.targetAmount;
            return {
              ...inv,
              status: isFull ? "fully_funded" : inv.status,
              funding: {
                ...inv.funding,
                totalRaised,
                fundingProgress: totalRaised / inv.funding.targetAmount,
                remainingCapacity: inv.funding.targetAmount - totalRaised,
                investorCount: inv.funding.investorCount + 1,
              },
            } as Invoice;
          });
          return {
            invoices: nextInvoices,
            _fundingBackup: backup ? { ...(s._fundingBackup || {}), [id]: backup } : s._fundingBackup,
          };
        }),

      rollbackInvoiceFunding: (id) =>
        set((s) => {
          const backup = s._fundingBackup?.[id];
          if (!backup) return {};
          const invoices = s.invoices.map((inv) => {
            if (inv.id !== id) return inv;
            return {
              ...inv,
              status: backup.status ?? inv.status,
              funding: {
                ...inv.funding,
                totalRaised: backup.totalRaised ?? inv.funding.totalRaised,
                fundingProgress: backup.fundingProgress ?? inv.funding.fundingProgress,
                remainingCapacity: backup.remainingCapacity ?? inv.funding.remainingCapacity,
                investorCount: backup.investorCount ?? inv.funding.investorCount,
              },
            } as Invoice;
          });
          const nextBackup = { ...(s._fundingBackup || {}) };
          delete nextBackup[id];
          return { invoices, _fundingBackup: nextBackup };
        }),

      updateInvoiceStatus: (id, status) =>
        set((s) => {
          const prev = s.invoices.find((i) => i.id === id);
          const backup = prev ? { status: prev.status } : undefined;
          const invoices = s.invoices.map((inv) =>
            inv.id === id ? ({ ...inv, status } as Invoice) : inv
          );
          return {
            invoices,
            _statusBackup: backup ? { ...(s._statusBackup || {}), [id]: backup } : s._statusBackup,
          };
        }),

      rollbackInvoiceStatus: (id) =>
        set((s) => {
          const backup = s._statusBackup?.[id];
          if (!backup) return {};
          const invoices = s.invoices.map((inv) =>
            inv.id === id ? ({ ...inv, status: backup.status } as Invoice) : inv
          );
          const nextBackup = { ...(s._statusBackup || {}) };
          delete nextBackup[id];
          return { invoices, _statusBackup: nextBackup };
        }),

      setCreateDraft: (draft) =>
        set((s) => ({ createDraft: { ...s.createDraft, ...draft } })),

      clearCreateDraft: () => set({ createDraft: { currency: "USDC" } }),

      toggleComparison: (id) =>
        set((s) => {
          const list = s.comparisonList;
          if (list.includes(id)) {
            return { comparisonList: list.filter((i) => i !== id) };
          }
          // When at max, replace oldest (first in list)
          if (list.length >= MAX_COMPARISON_INVOICES) {
            return { comparisonList: [...list.slice(1), id] };
          }
          return { comparisonList: [...list, id] };
        }),

      setComparisonList: (ids) =>
        set({
          comparisonList: [...new Set(ids)].slice(0, MAX_COMPARISON_INVOICES),
        }),

      removeFromComparison: (id) =>
        set((s) => ({ comparisonList: s.comparisonList.filter((i) => i !== id) })),

      clearComparison: () => set({ comparisonList: [] }),

      getFiltered: () => {
        const { invoices, filters, sort, searchQuery } = get();
        return readFilteredInvoices(invoices, filters, sort, searchQuery);
      },
    }),
    {
      name: "kora-invoice-store",
      storage: createPersistentJSONStorage(),
      partialize: (state) => ({ createDraft: state.createDraft }),
    }
  )
);
