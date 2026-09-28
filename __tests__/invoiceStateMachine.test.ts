/**
 * Unit tests for lib/invoiceStateMachine.ts — Issue #381
 *
 * Covers:
 *  - getAllowedTransitions: valid and terminal statuses
 *  - isValidTransition: known-good, known-bad, cross-terminal
 *  - getTransition: returns correct definition or null
 *  - getBlockedReason: wallet not connected, not owner, invalid transition, happy path
 *  - STATUS_TO_CHAIN_INDEX: all statuses have an entry; cancelled = 7
 *  - isTerminalStatus: terminal and non-terminal statuses
 *  - contractMethod routing: cancel/repay/update_status assigned correctly
 */

import { describe, it, expect } from "vitest";
import {
  getAllowedTransitions,
  isValidTransition,
  getTransition,
  getBlockedReason,
  STATUS_TO_CHAIN_INDEX,
  TERMINAL_STATUSES,
  isTerminalStatus,
} from "@/lib/invoiceStateMachine";
import type { InvoiceStatus } from "@/types/invoice";

// ─── getAllowedTransitions ────────────────────────────────────────────────────

describe("getAllowedTransitions", () => {
  it("returns Mark-as-Funded and Cancel for listed", () => {
    const tx = getAllowedTransitions("listed");
    const targets = tx.map((t) => t.to);
    expect(targets).toContain("fully_funded");
    expect(targets).toContain("cancelled");
  });

  it("returns Mark-as-Funded and Cancel for partially_funded", () => {
    const tx = getAllowedTransitions("partially_funded");
    const targets = tx.map((t) => t.to);
    expect(targets).toContain("fully_funded");
    expect(targets).toContain("cancelled");
  });

  it("returns Mark-as-Repaid for fully_funded", () => {
    const tx = getAllowedTransitions("fully_funded");
    expect(tx).toHaveLength(1);
    expect(tx[0].to).toBe("repaid");
  });

  it("returns Mark-as-Repaid for active", () => {
    const tx = getAllowedTransitions("active");
    expect(tx).toHaveLength(1);
    expect(tx[0].to).toBe("repaid");
  });

  it.each<InvoiceStatus>(["repaid", "defaulted", "cancelled", "pending_mint", "draft"])(
    "returns [] for terminal status %s",
    (status) => {
      expect(getAllowedTransitions(status)).toEqual([]);
    }
  );
});

// ─── isValidTransition ────────────────────────────────────────────────────────

describe("isValidTransition", () => {
  it.each<[InvoiceStatus, InvoiceStatus]>([
    ["listed", "fully_funded"],
    ["listed", "cancelled"],
    ["partially_funded", "fully_funded"],
    ["partially_funded", "cancelled"],
    ["fully_funded", "repaid"],
    ["active", "repaid"],
  ])("allows %s → %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  it.each<[InvoiceStatus, InvoiceStatus]>([
    ["listed", "repaid"],
    ["listed", "active"],
    ["repaid", "cancelled"],
    ["cancelled", "listed"],
    ["defaulted", "repaid"],
    ["pending_mint", "listed"],
    ["fully_funded", "cancelled"],
  ])("blocks %s → %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
  });
});

// ─── getTransition ────────────────────────────────────────────────────────────

describe("getTransition", () => {
  it("returns a transition with correct fields for listed → cancelled", () => {
    const tx = getTransition("listed", "cancelled");
    expect(tx).not.toBeNull();
    expect(tx!.to).toBe("cancelled");
    expect(tx!.isDestructive).toBe(true);
    expect(tx!.contractMethod).toBe("cancel");
    expect(tx!.variant).toBe("destructive");
  });

  it("returns a transition with contractMethod=update_status for listed → fully_funded", () => {
    const tx = getTransition("listed", "fully_funded");
    expect(tx).not.toBeNull();
    expect(tx!.contractMethod).toBe("update_status");
    expect(tx!.isDestructive).toBe(false);
  });

  it("returns contractMethod=repay for fully_funded → repaid", () => {
    const tx = getTransition("fully_funded", "repaid");
    expect(tx).not.toBeNull();
    expect(tx!.contractMethod).toBe("repay");
  });

  it("returns null for an invalid transition", () => {
    expect(getTransition("repaid", "listed")).toBeNull();
    expect(getTransition("listed", "active")).toBeNull();
  });
});

// ─── getBlockedReason ────────────────────────────────────────────────────────

describe("getBlockedReason", () => {
  it("returns wallet message when wallet is not connected", () => {
    const reason = getBlockedReason("listed", "cancelled", false, false);
    expect(reason).toMatch(/connect your wallet/i);
  });

  it("returns owner message when caller is not the owner", () => {
    const reason = getBlockedReason("listed", "cancelled", false, true);
    expect(reason).toMatch(/owner/i);
  });

  it("returns invalid-transition message for state machine violation", () => {
    const reason = getBlockedReason("repaid", "listed", true, true);
    expect(reason).toMatch(/cannot transition/i);
  });

  it("returns null when transition is allowed and caller is the owner", () => {
    expect(getBlockedReason("listed", "cancelled", true, true)).toBeNull();
    expect(getBlockedReason("fully_funded", "repaid", true, true)).toBeNull();
    expect(getBlockedReason("listed", "fully_funded", true, true)).toBeNull();
  });

  it("wallet check takes precedence over owner check", () => {
    // walletConnected=false, isOwner=true — should still block with wallet msg
    const reason = getBlockedReason("listed", "cancelled", true, false);
    expect(reason).toMatch(/connect your wallet/i);
  });
});

// ─── STATUS_TO_CHAIN_INDEX ────────────────────────────────────────────────────

describe("STATUS_TO_CHAIN_INDEX", () => {
  it("maps cancelled to index 7", () => {
    expect(STATUS_TO_CHAIN_INDEX["cancelled"]).toBe(7);
  });

  it("maps all runtime statuses", () => {
    const expectedStatuses: InvoiceStatus[] = [
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
    for (const s of expectedStatuses) {
      expect(STATUS_TO_CHAIN_INDEX[s]).toBeDefined();
    }
  });

  it("draft has index -1 (no on-chain representation)", () => {
    expect(STATUS_TO_CHAIN_INDEX["draft"]).toBe(-1);
  });
});

// ─── isTerminalStatus ────────────────────────────────────────────────────────

describe("isTerminalStatus", () => {
  it.each<InvoiceStatus>(["repaid", "defaulted", "cancelled", "draft", "pending_mint"])(
    "identifies %s as terminal",
    (status) => {
      expect(isTerminalStatus(status)).toBe(true);
    }
  );

  it.each<InvoiceStatus>(["listed", "partially_funded", "fully_funded", "active"])(
    "identifies %s as non-terminal",
    (status) => {
      expect(isTerminalStatus(status)).toBe(false);
    }
  );
});

// ─── contractMethod completeness ─────────────────────────────────────────────

describe("contractMethod completeness", () => {
  it("every transition has a valid contractMethod", () => {
    const validMethods = new Set(["cancel", "update_status", "repay"]);
    const allStatuses: InvoiceStatus[] = [
      "listed",
      "partially_funded",
      "fully_funded",
      "active",
    ];
    for (const status of allStatuses) {
      for (const tx of getAllowedTransitions(status)) {
        expect(validMethods.has(tx.contractMethod)).toBe(true);
      }
    }
  });

  it("all cancel transitions are marked destructive", () => {
    const allStatuses: InvoiceStatus[] = [
      "listed",
      "partially_funded",
      "fully_funded",
      "active",
    ];
    for (const status of allStatuses) {
      for (const tx of getAllowedTransitions(status)) {
        if (tx.contractMethod === "cancel") {
          expect(tx.isDestructive).toBe(true);
        }
      }
    }
  });

  it("no repay or update_status transitions are destructive", () => {
    const allStatuses: InvoiceStatus[] = [
      "listed",
      "partially_funded",
      "fully_funded",
      "active",
    ];
    for (const status of allStatuses) {
      for (const tx of getAllowedTransitions(status)) {
        if (tx.contractMethod !== "cancel") {
          expect(tx.isDestructive).toBe(false);
        }
      }
    }
  });
});
