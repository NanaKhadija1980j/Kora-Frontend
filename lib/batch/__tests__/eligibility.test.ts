/**
 * Unit tests for the batch eligibility helpers — Issue #670
 *
 * `isBatchCancelEligible` and `isBatchRepayEligible` previously had no dedicated
 * tests and were only exercised indirectly through the SME dashboard toolbar
 * integration tests (see __tests__/batch-action-toolbar.test.tsx). CONTRIBUTING.md
 * asks for unit tests next to domain helpers, so these live in lib/batch/__tests__
 * alongside lib/batch/eligibility.ts.
 */

import { describe, it, expect } from "vitest";
import {
  isBatchCancelEligible,
  isBatchRepayEligible,
} from "@/lib/batch/eligibility";
import { createMockInvoice } from "@/__tests__/fixtures";
import type { Invoice, InvoiceStatus } from "@/types";

/** Every invoice status, in declaration order (see types/invoice.ts). */
const ALL_STATUSES: InvoiceStatus[] = [
  "draft",
  "pending_mint",
  "listed",
  "partially_funded",
  "fully_funded",
  "active",
  "repaid",
  "defaulted",
  "cancelled",
];

/**
 * Builds a fully-typed Invoice from the shared factory, overriding only the
 * fields the eligibility rules read. Nested objects are spread from the base so
 * every override stays a *complete* object (no partial-shape casts); the single
 * `as Invoice` only reconciles the dynamic `status` string with the
 * discriminated union, which TypeScript cannot narrow on its own.
 */
function makeInvoice(overrides: {
  status?: InvoiceStatus;
  funding?: Partial<Invoice["funding"]>;
  terms?: Partial<Invoice["terms"]>;
  metadata?: Partial<Invoice["metadata"]>;
}): Invoice {
  const base = createMockInvoice();
  return {
    ...base,
    status: overrides.status ?? base.status,
    funding: { ...base.funding, ...overrides.funding },
    terms: { ...base.terms, ...overrides.terms },
    metadata: { ...base.metadata, ...overrides.metadata },
  } as Invoice;
}

describe("isBatchCancelEligible", () => {
  it("is eligible for a listed invoice with nothing raised", () => {
    const inv = makeInvoice({ status: "listed", funding: { totalRaised: 0 } });
    expect(isBatchCancelEligible(inv)).toBe(true);
  });

  // `pending_mint` = the invoice NFT has been minted on-chain but is not yet
  // listed on the marketplace. No investor funds can exist in this state, so it
  // shares the unfunded-cancel path with `listed` — the SME owner may still
  // cancel it. This mirrors the single-invoice cancel rule the batch flow aligns
  // with, which is why both statuses are accepted here.
  it("is eligible for a pending_mint invoice with nothing raised", () => {
    const inv = makeInvoice({
      status: "pending_mint",
      funding: { totalRaised: 0 },
    });
    expect(isBatchCancelEligible(inv)).toBe(true);
  });

  it("is NOT eligible for a listed invoice once any funds are raised", () => {
    const inv = makeInvoice({ status: "listed", funding: { totalRaised: 1 } });
    expect(isBatchCancelEligible(inv)).toBe(false);
  });

  it("is NOT eligible for a pending_mint invoice once any funds are raised", () => {
    const inv = makeInvoice({
      status: "pending_mint",
      funding: { totalRaised: 100 },
    });
    expect(isBatchCancelEligible(inv)).toBe(false);
  });

  it("requires strictly zero raised — even the tiniest positive amount blocks cancel", () => {
    const inv = makeInvoice({
      status: "listed",
      funding: { totalRaised: Number.MIN_VALUE },
    });
    expect(isBatchCancelEligible(inv)).toBe(false);
  });

  it("accepts only listed and pending_mint across all statuses (when unfunded)", () => {
    const eligible = ALL_STATUSES.filter((status) =>
      isBatchCancelEligible(makeInvoice({ status, funding: { totalRaised: 0 } }))
    );
    expect(eligible).toEqual(["pending_mint", "listed"]);
  });
});

describe("isBatchRepayEligible", () => {
  // A fixed "now" so results never depend on the wall clock. The helper exposes
  // `now` as an injectable parameter precisely so tests can pin it.
  const NOW = new Date("2025-06-15T12:00:00.000Z");

  it("accepts only fully_funded across all statuses, even when overdue", () => {
    const overdue = { terms: { repaymentDate: "2020-01-01T00:00:00.000Z" } };
    const eligible = ALL_STATUSES.filter((status) =>
      isBatchRepayEligible(makeInvoice({ status, ...overdue }), NOW)
    );
    expect(eligible).toEqual(["fully_funded"]);
  });

  it("is eligible when fully_funded and the repayment date has passed", () => {
    const inv = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "2025-06-14T00:00:00.000Z" },
    });
    expect(isBatchRepayEligible(inv, NOW)).toBe(true);
  });

  it("is NOT eligible when fully_funded but the repayment date is still in the future", () => {
    const inv = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "2025-06-16T00:00:00.000Z" },
    });
    expect(isBatchRepayEligible(inv, NOW)).toBe(false);
  });

  it("treats the exact repayment instant as due (<= boundary)", () => {
    const instant = "2025-06-15T12:00:00.000Z";
    const inv = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: instant },
    });
    // due === now → due <= now → eligible.
    expect(isBatchRepayEligible(inv, new Date(instant))).toBe(true);
    // One millisecond before the due instant → not yet due.
    expect(
      isBatchRepayEligible(inv, new Date("2025-06-15T11:59:59.999Z"))
    ).toBe(false);
  });

  it("is NOT eligible when both repaymentDate and dueDate are unparseable", () => {
    const inv = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "not-a-date" },
      metadata: { dueDate: "also-not-a-date" },
    });
    // new Date(...).getTime() is NaN, and the guard rejects it.
    expect(isBatchRepayEligible(inv, NOW)).toBe(false);
  });

  it("falls back to metadata.dueDate when terms.repaymentDate is empty", () => {
    const inv = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "" },
      metadata: { dueDate: "2020-01-01T00:00:00.000Z" },
    });
    expect(isBatchRepayEligible(inv, NOW)).toBe(true);
  });

  it("uses the current time by default when `now` is omitted", () => {
    const longPast = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "2000-01-01T00:00:00.000Z" },
    });
    expect(isBatchRepayEligible(longPast)).toBe(true);

    const farFuture = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "2999-01-01T00:00:00.000Z" },
    });
    expect(isBatchRepayEligible(farFuture)).toBe(false);
  });
});

describe("isBatchRepayEligible — repaymentDate timezone boundaries", () => {
  // Fixtures store repaymentDate as a date-only string ("YYYY-MM-DD", e.g.
  // "2025-02-01"). Per the ECMAScript Date spec, a *date-only* string parses as
  // UTC midnight — NOT local midnight. A date-*time* string without a zone
  // (e.g. "2025-02-01T00:00:00") parses as LOCAL time instead. That distinction
  // is the timezone edge that decides whether an invoice reads as "due" right
  // around midnight. The assertions below pin the absolute instant on both sides
  // of each boundary, so they hold regardless of the machine's TZ.

  it("anchors a date-only repaymentDate to UTC midnight", () => {
    const inv = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "2025-06-15" },
    });
    // Exactly UTC midnight → due === now → eligible.
    expect(isBatchRepayEligible(inv, new Date("2025-06-15T00:00:00.000Z"))).toBe(
      true
    );
    // One millisecond before UTC midnight → not yet due.
    expect(isBatchRepayEligible(inv, new Date("2025-06-14T23:59:59.999Z"))).toBe(
      false
    );
  });

  it("respects an explicit UTC offset on the repayment instant", () => {
    // Midnight at UTC+2 is 22:00 the previous day in UTC.
    const inv = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "2025-06-15T00:00:00+02:00" },
    });
    expect(isBatchRepayEligible(inv, new Date("2025-06-14T22:00:00.000Z"))).toBe(
      true
    );
    expect(isBatchRepayEligible(inv, new Date("2025-06-14T21:59:59.999Z"))).toBe(
      false
    );
  });

  it("compares absolute instants — equivalent times in different zones agree", () => {
    const now = new Date("2025-06-14T22:00:00.000Z");
    const asOffset = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "2025-06-15T00:00:00+02:00" },
    });
    const asUtc = makeInvoice({
      status: "fully_funded",
      terms: { repaymentDate: "2025-06-14T22:00:00.000Z" },
    });
    expect(isBatchRepayEligible(asOffset, now)).toBe(
      isBatchRepayEligible(asUtc, now)
    );
    expect(isBatchRepayEligible(asOffset, now)).toBe(true);
  });
});
