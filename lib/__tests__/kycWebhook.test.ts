/**
 * Synaps webhook parsing and signature verification — Issue #694.
 *
 * The route tests cover the HTTP surface; these pin the pure decisions
 * underneath it, where the status mapping and the MAC comparison live.
 */

import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";

import {
  isStellarAddress,
  mapSynapsStatus,
  parseSynapsWebhook,
  verifySynapsSignature,
} from "@/lib/kycWebhook";

const WALLET = "GBQXFQ2PVCFP2LOJ3XPMBLM5R2LSCVJKGHGXAWWVQCLDWKZVKKPFDANJ";
const SECRET = "synaps-test-secret";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    event: "identity.verified",
    session_id: "sess_1",
    status: "APPROVED",
    alias: WALLET,
    ...overrides,
  };
}

describe("mapSynapsStatus", () => {
  it("maps the approval states to verified", () => {
    expect(mapSynapsStatus("APPROVED")).toBe("verified");
    expect(mapSynapsStatus("VERIFIED")).toBe("verified");
  });

  it("maps the terminal failure states to rejected", () => {
    expect(mapSynapsStatus("REJECTED")).toBe("rejected");
    expect(mapSynapsStatus("CANCELLED")).toBe("rejected");
  });

  it("maps the in-flight states to pending", () => {
    expect(mapSynapsStatus("SUBMITTED")).toBe("pending");
    expect(mapSynapsStatus("PENDING")).toBe("pending");
    expect(mapSynapsStatus("PROCESSING")).toBe("pending");
  });

  it("maps a reset session back to none", () => {
    expect(mapSynapsStatus("RESET")).toBe("none");
  });

  it("normalises case and surrounding whitespace", () => {
    expect(mapSynapsStatus("  approved ")).toBe("verified");
    expect(mapSynapsStatus("rEjEcTeD")).toBe("rejected");
  });

  it("falls back to none for an unknown state", () => {
    // Synaps adds states over time; an unknown one must degrade, not throw.
    expect(mapSynapsStatus("SOMETHING_NEW")).toBe("none");
    expect(mapSynapsStatus("")).toBe("none");
  });
});

describe("isStellarAddress", () => {
  it("accepts a 56-character G-address", () => {
    expect(isStellarAddress(WALLET)).toBe(true);
  });

  it("rejects a contract address", () => {
    expect(
      isStellarAddress("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4")
    ).toBe(false);
  });

  it("rejects wrong lengths, lowercase, and non-strings", () => {
    expect(isStellarAddress(WALLET.slice(0, 55))).toBe(false);
    expect(isStellarAddress(WALLET.toLowerCase())).toBe(false);
    expect(isStellarAddress(undefined)).toBe(false);
    expect(isStellarAddress(12345)).toBe(false);
  });
});

describe("parseSynapsWebhook", () => {
  it("reduces a valid payload to the facts the route acts on", () => {
    const result = parseSynapsWebhook(valid());

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toMatchObject({
      event: "identity.verified",
      sessionId: "sess_1",
      walletAddress: WALLET,
      synapsStatus: "APPROVED",
      kycStatus: "verified",
    });
  });

  it("prefers session_id but accepts user_id", () => {
    const both = parseSynapsWebhook(valid({ user_id: "user_1" }));
    expect(both.ok && both.value.sessionId).toBe("sess_1");

    const only = parseSynapsWebhook(valid({ session_id: undefined, user_id: "user_1" }));
    expect(only.ok && only.value.sessionId).toBe("user_1");
  });

  it("resolves no wallet when the alias is not a Stellar address", () => {
    const result = parseSynapsWebhook(valid({ alias: "customer-42" }));
    expect(result.ok && result.value.walletAddress).toBeNull();
  });

  it("resolves no wallet when the alias is absent", () => {
    const result = parseSynapsWebhook(valid({ alias: undefined }));
    expect(result.ok && result.value.walletAddress).toBeNull();
  });

  it("ignores unknown extra fields rather than rejecting the payload", () => {
    const result = parseSynapsWebhook(valid({ tenant: "kora", nested: { a: 1 } }));
    expect(result.ok).toBe(true);
  });

  it("rejects non-object bodies", () => {
    for (const body of [null, undefined, 42, "string", true, [valid()]]) {
      expect(parseSynapsWebhook(body).ok).toBe(false);
    }
  });

  it("rejects a payload with no event", () => {
    expect(parseSynapsWebhook(valid({ event: undefined })).ok).toBe(false);
    expect(parseSynapsWebhook(valid({ event: "" })).ok).toBe(false);
  });

  it("rejects a payload with no status", () => {
    expect(parseSynapsWebhook(valid({ status: undefined })).ok).toBe(false);
  });

  it("rejects a payload with neither session_id nor user_id", () => {
    const result = parseSynapsWebhook(
      valid({ session_id: undefined, user_id: undefined })
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/session_id or user_id/i);
  });

  it("rejects wrongly typed fields", () => {
    expect(parseSynapsWebhook(valid({ status: 42 })).ok).toBe(false);
    expect(parseSynapsWebhook(valid({ event: { a: 1 } })).ok).toBe(false);
  });

  it("never echoes a field value in the rejection message", () => {
    // The message is returned to the caller, so it must not become a leak.
    const result = parseSynapsWebhook(valid({ alias: "secret-alias", status: undefined }));
    expect(!result.ok && result.error).not.toContain("secret-alias");
  });
});

describe("verifySynapsSignature", () => {
  const body = JSON.stringify(valid());
  const good = createHmac("sha256", SECRET).update(body, "utf8").digest("hex");

  it("reports a missing header", () => {
    expect(verifySynapsSignature(body, null, SECRET)).toBe("missing");
    expect(verifySynapsSignature(body, "", SECRET)).toBe("missing");
  });

  it("reports 'unverified' when no secret is configured", () => {
    // Dev/mock posture: the header is present but nothing can check it, and
    // that must not be reported as a successful verification.
    expect(verifySynapsSignature(body, "anything", undefined)).toBe("unverified");
    expect(verifySynapsSignature(body, "anything", "")).toBe("unverified");
  });

  it("accepts a correct HMAC", () => {
    expect(verifySynapsSignature(body, good, SECRET)).toBe("valid");
  });

  it("accepts uppercase hex and the sha256= prefix", () => {
    expect(verifySynapsSignature(body, good.toUpperCase(), SECRET)).toBe("valid");
    expect(verifySynapsSignature(body, `sha256=${good}`, SECRET)).toBe("valid");
    expect(verifySynapsSignature(body, `  ${good}  `, SECRET)).toBe("valid");
  });

  it("rejects an HMAC from a different secret", () => {
    const forged = createHmac("sha256", "attacker").update(body, "utf8").digest("hex");
    expect(verifySynapsSignature(body, forged, SECRET)).toBe("invalid");
  });

  it("rejects a signature for different bytes", () => {
    expect(verifySynapsSignature(body + " ", good, SECRET)).toBe("invalid");
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // `timingSafeEqual` throws on unequal lengths — the helper must not.
    expect(verifySynapsSignature(body, "abc", SECRET)).toBe("invalid");
    expect(verifySynapsSignature(body, good + "00", SECRET)).toBe("invalid");
  });
});
