import { describe, it, expect } from "vitest";
import { getInvoiceDataSource, queryKeys } from "@/lib/queryKeys";

describe("queryKeys invoice detail source namespacing", () => {
  it("defaults to live when mock flag is unset", () => {
    const original = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA;
    delete process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA;

    expect(getInvoiceDataSource()).toBe("live");
    expect(queryKeys.invoices.detail("abc")).toEqual([
      "invoices",
      "detail",
      "live",
      "abc",
    ]);

    process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA = original;
  });

  it("namespaces mock detail keys separately from live", () => {
    expect(queryKeys.invoices.detail("abc", "mock")).toEqual([
      "invoices",
      "detail",
      "mock",
      "abc",
    ]);
    expect(queryKeys.invoices.detail("abc", "live")).toEqual([
      "invoices",
      "detail",
      "live",
      "abc",
    ]);
    expect(queryKeys.invoices.detail("abc", "mock")).not.toEqual(
      queryKeys.invoices.detail("abc", "live")
    );
  });
});
