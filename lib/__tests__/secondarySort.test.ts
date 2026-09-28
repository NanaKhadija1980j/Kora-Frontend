import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECONDARY_SORT,
  parseSecondarySort,
  sortSecondaryItems,
  type SecondarySortBy,
} from "../secondarySort";

const items = [
  {
    positionId: "pos-b",
    remainingTenor: 30,
    listing: {
      askPrice: 200,
      impliedDiscount: 0.05,
      listedAt: "2026-08-02T00:00:00.000Z",
    },
  },
  {
    positionId: "pos-c",
    remainingTenor: 10,
    listing: {
      askPrice: 100,
      impliedDiscount: 0.1,
      listedAt: "2026-08-03T00:00:00.000Z",
    },
  },
  {
    positionId: "pos-a",
    remainingTenor: 20,
    listing: {
      askPrice: 300,
      impliedDiscount: 0.02,
      listedAt: "2026-08-01T00:00:00.000Z",
    },
  },
];

describe("sortSecondaryItems", () => {
  it.each<[SecondarySortBy, string[]]>([
    ["listed_desc", ["pos-c", "pos-b", "pos-a"]],
    ["listed_asc", ["pos-a", "pos-b", "pos-c"]],
    ["ask_price_asc", ["pos-c", "pos-b", "pos-a"]],
    ["ask_price_desc", ["pos-a", "pos-b", "pos-c"]],
    ["discount_desc", ["pos-c", "pos-b", "pos-a"]],
    ["discount_asc", ["pos-a", "pos-b", "pos-c"]],
    ["tenor_asc", ["pos-c", "pos-a", "pos-b"]],
    ["tenor_desc", ["pos-b", "pos-a", "pos-c"]],
  ])("sorts by %s", (sortBy, expectedIds) => {
    expect(sortSecondaryItems(items, sortBy).map((item) => item.positionId)).toEqual(expectedIds);
  });

  it("uses positionId as a deterministic tie-breaker", () => {
    const tied = items.map((item) => ({
      ...item,
      listing: { ...item.listing, askPrice: 100 },
    }));

    expect(sortSecondaryItems(tied, "ask_price_asc").map((item) => item.positionId)).toEqual([
      "pos-a",
      "pos-b",
      "pos-c",
    ]);
  });

  it("does not mutate the input and leaves an empty portfolio empty", () => {
    const original = [...items];

    expect(sortSecondaryItems(items, "listed_desc")).not.toBe(items);
    expect(items).toEqual(original);
    expect(sortSecondaryItems([], "listed_desc")).toEqual([]);
  });
});

describe("parseSecondarySort", () => {
  it("preserves a valid URL value", () => {
    expect(parseSecondarySort("tenor_desc")).toBe("tenor_desc");
  });

  it("falls back to newest listed for missing or invalid URL values", () => {
    expect(parseSecondarySort(null)).toBe(DEFAULT_SECONDARY_SORT);
    expect(parseSecondarySort("unexpected")).toBe(DEFAULT_SECONDARY_SORT);
  });
});
