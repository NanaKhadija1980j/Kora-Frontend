/**
 * Integration tests for POST /api/auth/verify
 *
 * Covers:
 *  - CSRF guard
 *  - Missing required fields (400)
 *  - Invalid public key (crypto error path → 200 verified:false)
 *  - Bad signature (verified:false, no error thrown to client)
 *  - Valid signature from a real Stellar keypair (verified:true)
 *  - Expired challenge (> 5 min old timestamp)
 *  - Malformed challenge format
 *  - Session expiry field is ~1 hour in the future on success
 *  - markWalletVerified is called after successful verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Keypair used for all signature tests. */
const keypair = StellarSdk.Keypair.random();
const publicKey = keypair.publicKey();

/** Sign a challenge string the same way the route's Keypair.verify() expects. */
function signChallenge(challenge: string): string {
  const sig = keypair.sign(Buffer.from(challenge, "utf-8"));
  return Buffer.from(sig).toString("base64");
}

/** Build a challenge string in the exact format the route produces. */
function buildChallenge(ts = Date.now()): string {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  return `Kora Protocol authentication: ${ts}:${nonce}`;
}

/** Build a CSRF-passing POST request with a JSON body. */
function makeRequest(body: unknown): NextRequest {
  const token = crypto.randomUUID();
  const headers = new Headers({
    "content-type": "application/json",
    cookie: `${CSRF_COOKIE}=${token}`,
    [CSRF_HEADER]: token,
  });
  return new NextRequest("http://localhost/api/auth/verify", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Build a request with no CSRF credentials. */
function noCsrfRequest(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost/api/auth/verify", {
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/verify", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // ── CSRF guard ─────────────────────────────────────────────────────────────

  it("returns 403 when CSRF header is absent", async () => {
    const { POST } = await import("../route");
    const res = await POST(noCsrfRequest());
    expect(res.status).toBe(403);
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it("returns 400 when body is missing all required fields", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.verified).toBe(false);
    expect(body.message).toMatch(/missing/i);
  });

  it("returns 400 when challenge is missing", async () => {
    const { POST } = await import("../route");
    const challenge = buildChallenge();
    const res = await POST(
      makeRequest({ signature: signChallenge(challenge), publicKey }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.verified).toBe(false);
  });

  it("returns 400 when publicKey is missing", async () => {
    const { POST } = await import("../route");
    const challenge = buildChallenge();
    const res = await POST(
      makeRequest({ challenge, signature: signChallenge(challenge) }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.verified).toBe(false);
  });

  it("returns 400 when signature is missing", async () => {
    const { POST } = await import("../route");
    const challenge = buildChallenge();
    const res = await POST(makeRequest({ challenge, publicKey }));
    expect(res.status).toBe(400);
  });

  // ── Signature verification ──────────────────────────────────────────────────

  it("returns verified:false for a wrong (random) signature", async () => {
    const { POST } = await import("../route");
    const challenge = buildChallenge();
    const wrongSig = Buffer.from(crypto.randomUUID()).toString("base64");
    const res = await POST(
      makeRequest({ challenge, signature: wrongSig, publicKey }),
    );
    // Route returns 200 with verified:false (not an HTTP error)
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(false);
    expect(body.expiresAt).toBe(0);
  });

  it("returns verified:false for a signature from a different keypair", async () => {
    const { POST } = await import("../route");
    const other = StellarSdk.Keypair.random();
    const challenge = buildChallenge();
    const wrongSig = Buffer.from(
      other.sign(Buffer.from(challenge, "utf-8")),
    ).toString("base64");
    const res = await POST(
      makeRequest({ challenge, signature: wrongSig, publicKey }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(false);
  });

  it("returns verified:false for an invalid publicKey format", async () => {
    const { POST } = await import("../route");
    const challenge = buildChallenge();
    const res = await POST(
      makeRequest({
        challenge,
        signature: signChallenge(challenge),
        publicKey: "NOT_A_VALID_KEY",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(false);
  });

  // ── Challenge freshness ─────────────────────────────────────────────────────

  it("returns verified:false with expired-message when challenge is > 5 min old", async () => {
    const { POST } = await import("../route");
    const oldTs = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const challenge = buildChallenge(oldTs);
    const res = await POST(
      makeRequest({ challenge, signature: signChallenge(challenge), publicKey }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(false);
    expect(body.message).toMatch(/expired/i);
  });

  it("returns verified:false when challenge format is wrong (no timestamp prefix)", async () => {
    const { POST } = await import("../route");
    const badChallenge = "not-a-valid-challenge-format";
    const res = await POST(
      makeRequest({
        challenge: badChallenge,
        signature: signChallenge(badChallenge),
        publicKey,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(false);
    // Could be "Invalid challenge format" or "Signature verification failed" depending
    // on whether crypto rejects the signature first — both are valid rejection reasons.
    expect(body.message).toBeDefined();
  });

  // ── Successful verification ─────────────────────────────────────────────────

  it("returns verified:true and a future expiresAt for a valid fresh signature", async () => {
    const { POST } = await import("../route");
    const challenge = buildChallenge();
    const before = Date.now();
    const res = await POST(
      makeRequest({ challenge, signature: signChallenge(challenge), publicKey }),
    );
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);

    // Session must expire roughly 1 hour in the future
    const oneHourMs = 60 * 60 * 1000;
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + oneHourMs - 500);
    expect(body.expiresAt).toBeLessThanOrEqual(after + oneHourMs + 500);
  });

  it("calls markWalletVerified after successful verification", async () => {
    // Spy on markWalletVerified before the route module is imported
    const verifiedSessions = await import("@/lib/verifiedSessions");
    const spy = vi.spyOn(verifiedSessions, "markWalletVerified");

    const { POST } = await import("../route");
    const challenge = buildChallenge();
    await POST(
      makeRequest({ challenge, signature: signChallenge(challenge), publicKey }),
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(publicKey, expect.any(Number));
  });

  it("does NOT call markWalletVerified when signature is invalid", async () => {
    const verifiedSessions = await import("@/lib/verifiedSessions");
    const spy = vi.spyOn(verifiedSessions, "markWalletVerified");

    const { POST } = await import("../route");
    const challenge = buildChallenge();
    const badSig = Buffer.from("bad").toString("base64");
    await POST(makeRequest({ challenge, signature: badSig, publicKey }));

    expect(spy).not.toHaveBeenCalled();
  });
});
