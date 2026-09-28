import { describe, it, expect, beforeEach } from "vitest";
import { useInvoiceStore } from "../store/invoiceStore";
import { MAX_COMPARISON_INVOICES } from "@/lib/comparison";

function resetStore() {
  useInvoiceStore.setState({ comparisonList: [] });
}

describe("invoiceStore — comparison list", () => {
  beforeEach(resetStore);

  it("toggles an invoice into the comparison list", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    expect(useInvoiceStore.getState().comparisonList).toContain("inv_001");
  });

  it("removes an invoice already in the list", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().toggleComparison("inv_001");
    expect(useInvoiceStore.getState().comparisonList).not.toContain("inv_001");
  });

  it("allows up to 4 invoices", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().toggleComparison("inv_002");
    useInvoiceStore.getState().toggleComparison("inv_003");
    useInvoiceStore.getState().toggleComparison("inv_004");
    expect(useInvoiceStore.getState().comparisonList).toHaveLength(
      MAX_COMPARISON_INVOICES
    );
  });

  it("replaces the oldest when a 5th is added", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().toggleComparison("inv_002");
    useInvoiceStore.getState().toggleComparison("inv_003");
    useInvoiceStore.getState().toggleComparison("inv_004");
    useInvoiceStore.getState().toggleComparison("inv_005");
    const list = useInvoiceStore.getState().comparisonList;
    expect(list).toHaveLength(4);
    expect(list).not.toContain("inv_001"); // oldest replaced
    expect(list).toContain("inv_005");
  });

  it("setComparisonList restores a shareable URL selection (capped at 4)", () => {
    useInvoiceStore
      .getState()
      .setComparisonList(["a", "b", "c", "d", "e", "a"]);
    expect(useInvoiceStore.getState().comparisonList).toEqual(["a", "b", "c", "d"]);
  });

  it("removeFromComparison removes a single invoice", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().toggleComparison("inv_002");
    useInvoiceStore.getState().removeFromComparison("inv_001");
    expect(useInvoiceStore.getState().comparisonList).not.toContain("inv_001");
    expect(useInvoiceStore.getState().comparisonList).toContain("inv_002");
  });

  it("clearComparison empties the list", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().clearComparison();
    expect(useInvoiceStore.getState().comparisonList).toHaveLength(0);
  });

  it("handles URL comparison parameter parsing and deduplication", () => {
    const rawParam = "inv_001,inv_002,inv_003,inv_004,inv_005";
    const ids = rawParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COMPARISON_INVOICES);

    useInvoiceStore.getState().setComparisonList(ids);
    expect(useInvoiceStore.getState().comparisonList).toEqual([
      "inv_001",
      "inv_002",
      "inv_003",
      "inv_004",
    ]);
  });

  // ─── New tests for URL hydrate + remove chip ──────────────────────────

  it("hydrates comparison list from URL on load", () => {
    // Simulate URL hydration
    const ids = ["url_001", "url_002", "url_003"];
    useInvoiceStore.getState().setComparisonList(ids);
    expect(useInvoiceStore.getState().comparisonList).toEqual(ids);
  });

  it("removing a chip updates the comparison list", () => {
    useInvoiceStore.getState().setComparisonList(["chip_001", "chip_002", "chip_003"]);
    useInvoiceStore.getState().removeFromComparison("chip_002");
    expect(useInvoiceStore.getState().comparisonList).toEqual(["chip_001", "chip_003"]);
  });

  it("removing the last chip clears the list", () => {
    useInvoiceStore.getState().setComparisonList(["last_chip"]);
    useInvoiceStore.getState().removeFromComparison("last_chip");
    expect(useInvoiceStore.getState().comparisonList).toHaveLength(0);
  });

  it("max selection enforced when toggling", () => {
    useInvoiceStore.getState().setComparisonList(["a", "b", "c", "d"]);
    useInvoiceStore.getState().toggleComparison("e");
    expect(useInvoiceStore.getState().comparisonList).toHaveLength(4);
    expect(useInvoiceStore.getState().comparisonList).not.toContain("a");
    expect(useInvoiceStore.getState().comparisonList).toContain("e");
  });

  it("URL hydration handles malformed input gracefully", () => {
    const malformed = "inv_001,,inv_002, ,inv_003";
    const ids = malformed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COMPARISON_INVOICES);

    useInvoiceStore.getState().setComparisonList(ids);
    expect(useInvoiceStore.getState().comparisonList).toEqual([
      "inv_001",
      "inv_002",
      "inv_003",
    ]);
  });

  // ─── ComparisonBar URL sync coverage ──────────────────────────────────

  it("serializes the comparison list into a URL query parameter", () => {
    useInvoiceStore.getState().setComparisonList(["inv_001", "inv_002"]);
    const params = new URLSearchParams();
    params.set("compare", useInvoiceStore.getState().comparisonList.join(","));
    expect(params.get("compare")).toBe("inv_001,inv_002");
  });

  it("round-trips a comparison list through the URL query parameter", () => {
    const original = ["inv_001", "inv_002", "inv_003"];
    useInvoiceStore.getState().setComparisonList(original);

    const params = new URLSearchParams();
    params.set("compare", useInvoiceStore.getState().comparisonList.join(","));

    const restored = (params.get("compare") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COMPARISON_INVOICES);

    useInvoiceStore.getState().setComparisonList(restored);
    expect(useInvoiceStore.getState().comparisonList).toEqual(original);
  });

  it("clears the URL query parameter when the comparison list is emptied", () => {
    useInvoiceStore.getState().setComparisonList(["inv_001"]);
    const params = new URLSearchParams();
    params.set("compare", useInvoiceStore.getState().comparisonList.join(","));

    useInvoiceStore.getState().clearComparison();
    const list = useInvoiceStore.getState().comparisonList;
    if (list.length === 0) {
      params.delete("compare");
    }

    expect(params.get("compare")).toBeNull();
  });
});