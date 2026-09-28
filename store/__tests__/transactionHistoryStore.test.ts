import { describe, it, expect, beforeEach } from "vitest";
import { useTransactionHistoryStore } from "../transactionHistoryStore";

function resetStore() {
  useTransactionHistoryStore.setState({
    transactions: [],
    filterType: "all",
    filterStartDate: null,
    filterEndDate: null,
  });
}

describe("transactionHistoryStore", () => {
  beforeEach(resetStore);

  it("should have correct initial state", () => {
    const state = useTransactionHistoryStore.getState();
    expect(state.transactions).toEqual([]);
    expect(state.filterType).toBe("all");
    expect(state.filterStartDate).toBeNull();
    expect(state.filterEndDate).toBeNull();
  });

  it("should add, update status, and remove transactions", () => {
    const store = useTransactionHistoryStore.getState();
    
    // Add transaction
    useTransactionHistoryStore.getState().addTransaction({
      hash: "hash_1",
      type: "mint_invoice",
      status: "pending",
      amount: "100",
      assetCode: "USDC",
      description: "Mint invoice #1",
    });

    let transactions = useTransactionHistoryStore.getState().transactions;
    expect(transactions).toHaveLength(1);
    expect(transactions[0].hash).toBe("hash_1");
    expect(transactions[0].status).toBe("pending");

    // Update status
    useTransactionHistoryStore.getState().updateTransactionStatus("hash_1", "confirmed");
    transactions = useTransactionHistoryStore.getState().transactions;
    expect(transactions[0].status).toBe("confirmed");

    // Remove transaction
    useTransactionHistoryStore.getState().removeTransaction("hash_1");
    transactions = useTransactionHistoryStore.getState().transactions;
    expect(transactions).toHaveLength(0);
  });

  it("should filter transactions by type", () => {
    const store = useTransactionHistoryStore.getState();
    
    // Add multiple transactions of different types
    store.addTransaction({ hash: "tx_mint", type: "mint_invoice", status: "confirmed" });
    store.addTransaction({ hash: "tx_fund", type: "fund_invoice", status: "confirmed" });
    store.addTransaction({ hash: "tx_repay", type: "repay_invoice", status: "confirmed" });
    store.addTransaction({ hash: "tx_claim", type: "claim_yield", status: "confirmed" });
    store.addTransaction({ hash: "tx_transfer", type: "transfer", status: "confirmed" });

    // Filter Mints
    store.setFilterType("mint");
    let filtered = store.getFilteredTransactions();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].hash).toBe("tx_mint");

    // Filter Funding
    store.setFilterType("fund");
    filtered = store.getFilteredTransactions();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].hash).toBe("tx_fund");

    // Filter Repayments
    store.setFilterType("repay");
    filtered = store.getFilteredTransactions();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].hash).toBe("tx_repay");

    // Filter Claims
    store.setFilterType("claim");
    filtered = store.getFilteredTransactions();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].hash).toBe("tx_claim");

    // Filter Transfer
    store.setFilterType("transfer");
    filtered = store.getFilteredTransactions();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].hash).toBe("tx_transfer");
  });

  it("should filter transactions by date range", () => {
    const store = useTransactionHistoryStore.getState();

    // Timestamps for test
    // 2026-07-28 is Tue (UTC)
    const ms27 = new Date("2026-07-27T12:00:00Z").getTime();
    const ms28 = new Date("2026-07-28T12:00:00Z").getTime();
    const ms29 = new Date("2026-07-29T12:00:00Z").getTime();

    store.addTransaction({ hash: "tx27", type: "other", status: "confirmed", timestamp: ms27 });
    store.addTransaction({ hash: "tx28", type: "other", status: "confirmed", timestamp: ms28 });
    store.addTransaction({ hash: "tx29", type: "other", status: "confirmed", timestamp: ms29 });

    // Only start date
    store.setFilterStartDate("2026-07-28");
    let filtered = store.getFilteredTransactions();
    expect(filtered).toHaveLength(2); // tx28, tx29
    expect(filtered.map(t => t.hash)).toContain("tx28");
    expect(filtered.map(t => t.hash)).toContain("tx29");

    // Only end date
    store.resetFilters();
    store.setFilterEndDate("2026-07-28");
    filtered = store.getFilteredTransactions();
    expect(filtered).toHaveLength(2); // tx27, tx28
    expect(filtered.map(t => t.hash)).toContain("tx27");
    expect(filtered.map(t => t.hash)).toContain("tx28");

    // Start & End dates combined (inclusive)
    store.resetFilters();
    store.setFilterStartDate("2026-07-28");
    store.setFilterEndDate("2026-07-28");
    filtered = store.getFilteredTransactions();
    expect(filtered).toHaveLength(1); // only tx28
    expect(filtered[0].hash).toBe("tx28");
  });

  it("should reset filters successfully", () => {
    const store = useTransactionHistoryStore.getState();
    store.setFilterType("mint");
    store.setFilterStartDate("2026-07-28");
    store.setFilterEndDate("2026-07-29");

    store.resetFilters();
    expect(store.filterType).toBe("all");
    expect(store.filterStartDate).toBeNull();
    expect(store.filterEndDate).toBeNull();
  });
});
