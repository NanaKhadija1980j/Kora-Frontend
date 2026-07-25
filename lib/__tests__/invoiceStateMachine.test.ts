import { describe, it, expect } from "vitest";
import {
  getAllowedTransitions,
  isValidTransition,
  getBlockedReason,
  STATUS_TO_CHAIN_INDEX,
} from "../invoiceStateMachine";
import type { InvoiceStatus } from "@/types/invoice";

// ─── getAllowedTransitions ────────────────────────────────────────────────────

describe("getAllowedTransitions", () => {
  it("listed → [fully_funded, cancelled]", () => {
    const targets = getAllowedTransitions("listed").map((t) => t.to);
    expect(targets).toContain("fully_funded");
    expect(targets).toContain("cancelled");
    expect(targets).toHaveLength(2);
  });

  it("partially_funded → [fully_funded, cancelled]", () => {
    const targets = getAllowedTransitions("partially_funded").map((t) => t.to);
    expect(targets).toContain("fully_funded");
    expect(targets).toContain("cancelled");
    expect(targets).toHaveLength(2);
  });

  it("fully_funded → [repaid]", () => {
    const targets = getAllowedTransitions("fully_funded").map((t) => t.to);
    expect(targets).toEqual(["repaid"]);
  });

  it("active → [repaid]", () => {
    const targets = getAllowedTransitions("active").map((t) => t.to);
    expect(targets).toEqual(["repaid"]);
  });

  it("terminal states return empty array", () => {
    const terminals: InvoiceStatus[] = ["repaid", "defaulted", "cancelled", "pending_mint", "draft"];
    for (const s of terminals) {
      expect(getAllowedTransitions(s)).toHaveLength(0);
    }
  });
});

// ─── isValidTransition ────────────────────────────────────────────────────────

describe("isValidTransition", () => {
  it("allows listed → fully_funded", () => {
    expect(isValidTransition("listed", "fully_funded")).toBe(true);
  });

  it("allows listed → cancelled", () => {
    expect(isValidTransition("listed", "cancelled")).toBe(true);
  });

  it("allows partially_funded → fully_funded", () => {
    expect(isValidTransition("partially_funded", "fully_funded")).toBe(true);
  });

  it("allows partially_funded → cancelled", () => {
    expect(isValidTransition("partially_funded", "cancelled")).toBe(true);
  });

  it("allows fully_funded → repaid", () => {
    expect(isValidTransition("fully_funded", "repaid")).toBe(true);
  });

  it("allows active → repaid", () => {
    expect(isValidTransition("active", "repaid")).toBe(true);
  });

  it("blocks listed → repaid (skipping steps)", () => {
    expect(isValidTransition("listed", "repaid")).toBe(false);
  });

  it("blocks repaid → listed (backward)", () => {
    expect(isValidTransition("repaid", "listed")).toBe(false);
  });

  it("blocks cancelled → listed (backward from terminal)", () => {
    expect(isValidTransition("cancelled", "listed")).toBe(false);
  });

  it("blocks fully_funded → cancelled", () => {
    expect(isValidTransition("fully_funded", "cancelled")).toBe(false);
  });

  it("blocks active → cancelled", () => {
    expect(isValidTransition("active", "cancelled")).toBe(false);
  });

  it("blocks pending_mint transitions", () => {
    expect(isValidTransition("pending_mint", "listed")).toBe(false);
    expect(isValidTransition("pending_mint", "cancelled")).toBe(false);
  });
});

// ─── getBlockedReason ─────────────────────────────────────────────────────────

describe("getBlockedReason", () => {
  it("returns null for valid transition by owner", () => {
    expect(getBlockedReason("listed", "fully_funded", true)).toBeNull();
  });

  it("returns null for cancel by owner", () => {
    expect(getBlockedReason("listed", "cancelled", true)).toBeNull();
  });

  it("returns ownership error when not owner (even valid transition)", () => {
    const reason = getBlockedReason("listed", "fully_funded", false);
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/owner/i);
  });

  it("returns invalid transition error for illegal state jump", () => {
    const reason = getBlockedReason("listed", "repaid", true);
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/Cannot transition/i);
  });

  it("ownership check takes priority over transition check", () => {
    const reason = getBlockedReason("listed", "repaid", false);
    expect(reason).toMatch(/owner/i);
  });
});

// ─── STATUS_TO_CHAIN_INDEX ────────────────────────────────────────────────────

describe("STATUS_TO_CHAIN_INDEX", () => {
  it("maps all expected statuses", () => {
    expect(STATUS_TO_CHAIN_INDEX["listed"]).toBe(1);
    expect(STATUS_TO_CHAIN_INDEX["partially_funded"]).toBe(2);
    expect(STATUS_TO_CHAIN_INDEX["fully_funded"]).toBe(3);
    expect(STATUS_TO_CHAIN_INDEX["active"]).toBe(4);
    expect(STATUS_TO_CHAIN_INDEX["repaid"]).toBe(5);
    expect(STATUS_TO_CHAIN_INDEX["defaulted"]).toBe(6);
    expect(STATUS_TO_CHAIN_INDEX["cancelled"]).toBe(7);
  });

  it("draft has no on-chain representation (-1)", () => {
    expect(STATUS_TO_CHAIN_INDEX["draft"]).toBe(-1);
  });
});
