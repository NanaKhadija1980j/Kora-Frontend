import { describe, expect, it } from "vitest";
import {
  STATUS_TO_CHAIN_INDEX,
  getAllowedTransitions,
  getBlockedReason,
  isValidTransition,
  canAmend,
  getAmendBlockedReason,
  sanitizeAmendment,
  AMENDMENT_ELIGIBLE_STATUSES,
  AMENDABLE_FIELDS,
} from "../invoiceStateMachine";
import type { InvoiceStatus } from "@/types/invoice";

const ALL_STATUSES: readonly InvoiceStatus[] = [
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

const EXPECTED_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: [],
  pending_mint: [],
  listed: ["fully_funded", "cancelled"],
  partially_funded: ["fully_funded", "cancelled"],
  fully_funded: ["repaid"],
  active: ["repaid"],
  repaid: [],
  defaulted: [],
  cancelled: [],
};

describe("invoiceStateMachine", () => {
  describe("getAllowedTransitions", () => {
    it.each(ALL_STATUSES)(
      "returns the exact allowed transitions for %s",
      (from) => {
        const targets = getAllowedTransitions(from).map((transition) => transition.to);
        expect(targets).toEqual([...EXPECTED_TRANSITIONS[from]]);
      },
    );

    it("keeps action metadata stable for every valid transition", () => {
      const metadata = Object.fromEntries(
        ALL_STATUSES.flatMap((from) =>
          getAllowedTransitions(from).map((transition) => [
            `${from}->${transition.to}`,
            {
              label: transition.label,
              variant: transition.variant,
              description: transition.description,
            },
          ]),
        ),
      );

      expect(metadata).toEqual({
        "listed->fully_funded": {
          label: "Mark as Funded",
          variant: "default",
          description:
            "Marks this invoice as fully funded. Investors will be notified.",
        },
        "listed->cancelled": {
          label: "Cancel Invoice",
          variant: "destructive",
          description:
            "Cancels this invoice and refunds any invested amount.",
        },
        "partially_funded->fully_funded": {
          label: "Mark as Funded",
          variant: "default",
          description:
            "Marks this invoice as fully funded. Investors will be notified.",
        },
        "partially_funded->cancelled": {
          label: "Cancel Invoice",
          variant: "destructive",
          description:
            "Cancels this invoice and refunds any invested amount.",
        },
        "fully_funded->repaid": {
          label: "Mark as Repaid",
          variant: "default",
          description:
            "Marks repayment complete and triggers yield distribution to investors.",
        },
        "active->repaid": {
          label: "Mark as Repaid",
          variant: "default",
          description:
            "Marks repayment complete and triggers yield distribution to investors.",
        },
      });
    });
  });

  describe("isValidTransition", () => {
    it("accepts every allowed transition and rejects every other transition", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          const expected = EXPECTED_TRANSITIONS[from].includes(to);
          expect(isValidTransition(from, to)).toBe(expected);
        }
      }
    });

    it("never allows self-transitions", () => {
      for (const status of ALL_STATUSES) {
        expect(isValidTransition(status, status)).toBe(false);
      }
    });

    it("treats every terminal state as non-transitioning", () => {
      const terminalStates: InvoiceStatus[] = [
        "draft",
        "pending_mint",
        "repaid",
        "defaulted",
        "cancelled",
      ];

      for (const from of terminalStates) {
        for (const to of ALL_STATUSES) {
          expect(isValidTransition(from, to)).toBe(false);
        }
      }
    });
  });

  describe("getBlockedReason", () => {
    it("returns null for every valid owner transition", () => {
      for (const from of ALL_STATUSES) {
        for (const to of EXPECTED_TRANSITIONS[from]) {
          expect(getBlockedReason(from, to, true)).toBeNull();
        }
      }
    });

    it("returns the ownership error for every non-owner attempt", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          expect(getBlockedReason(from, to, false)).toBe(
            "Only the invoice owner can trigger status changes.",
          );
        }
      }
    });

    it("returns a precise invalid-transition message for every illegal owner transition", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          if (EXPECTED_TRANSITIONS[from].includes(to)) continue;

          expect(getBlockedReason(from, to, true)).toBe(
            `Cannot transition from "${from}" to "${to}".`,
          );
        }
      }
    });
  });

  describe("STATUS_TO_CHAIN_INDEX", () => {
    it("maps each status to the expected on-chain index", () => {
      expect(STATUS_TO_CHAIN_INDEX).toEqual({
        draft: -1,
        pending_mint: 0,
        listed: 1,
        partially_funded: 2,
        fully_funded: 3,
        active: 4,
        repaid: 5,
        defaulted: 6,
        cancelled: 7,
      });
    });
  });
});

// ─── Amendment tests (#568) ───────────────────────────────────────────────────

describe("invoice amendment (#568)", () => {
  describe("canAmend", () => {
    it("returns true for listed", () => {
      expect(canAmend("listed")).toBe(true);
    });

    it("returns true for partially_funded", () => {
      expect(canAmend("partially_funded")).toBe(true);
    });

    it.each([
      "fully_funded",
      "active",
      "repaid",
      "defaulted",
      "cancelled",
      "draft",
      "pending_mint",
    ] as InvoiceStatus[])(
      "returns false for %s",
      (status) => {
        expect(canAmend(status)).toBe(false);
      }
    );

    it("AMENDMENT_ELIGIBLE_STATUSES matches canAmend for all statuses", () => {
      for (const status of ALL_STATUSES) {
        expect(canAmend(status)).toBe(AMENDMENT_ELIGIBLE_STATUSES.has(status));
      }
    });
  });

  describe("getAmendBlockedReason", () => {
    it("returns null when owner and status is eligible", () => {
      expect(getAmendBlockedReason("listed", true)).toBeNull();
      expect(getAmendBlockedReason("partially_funded", true)).toBeNull();
    });

    it("returns wallet message when not connected", () => {
      expect(getAmendBlockedReason("listed", true, false)).toMatch(/wallet/i);
    });

    it("returns ownership message for non-owner", () => {
      expect(getAmendBlockedReason("listed", false)).toMatch(/owner/i);
    });

    it("returns status message for ineligible status", () => {
      const reason = getAmendBlockedReason("fully_funded", true);
      expect(reason).not.toBeNull();
      expect(reason).toMatch(/fully funded/i);
    });

    it("funded invoices cannot amend critical fields — blocked at fully_funded", () => {
      expect(getAmendBlockedReason("fully_funded", true)).not.toBeNull();
      expect(getAmendBlockedReason("active", true)).not.toBeNull();
      expect(getAmendBlockedReason("repaid", true)).not.toBeNull();
    });
  });

  describe("sanitizeAmendment", () => {
    it("keeps only amendable fields", () => {
      const result = sanitizeAmendment({
        description: "Updated memo",
        category: "technology",
        amount: 99999,          // should be stripped
        discountRate: 0.5,      // should be stripped
        dueDate: "2030-01-01",  // should be stripped
        walletAddress: "GABC",  // should be stripped
      });
      expect(result).toEqual({
        description: "Updated memo",
        category: "technology",
      });
    });

    it("returns empty object when no amendable fields are present", () => {
      expect(sanitizeAmendment({ amount: 5000, dueDate: "2030-01-01" })).toEqual({});
    });

    it("handles empty input without throwing", () => {
      expect(sanitizeAmendment({})).toEqual({});
    });

    it("AMENDABLE_FIELDS contains only description and category", () => {
      expect([...AMENDABLE_FIELDS].sort()).toEqual(["category", "description"]);
    });

    it("strips non-string values for amendable keys", () => {
      const result = sanitizeAmendment({
        description: 42,    // not a string — should be excluded
        category: "energy",
      });
      expect(result).toEqual({ category: "energy" });
    });
  });
});
