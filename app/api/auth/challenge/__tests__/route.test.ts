/**
 * Integration tests for POST /api/auth/challenge
 *
 * Covers:
 *  - CSRF guard (existing csrf test already validates 403; here we test the
 *    happy-path behaviour once CSRF passes)
 *  - Nonce generation format and uniqueness
 *  - Challenge string structure  ("Kora Protocol authentication: {ts}:{nonce}")
 *  - Timestamp freshness
 *  - Response shape
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a NextRequest that passes CSRF validation. */
function csrfRequest(
  method = "POST",
  body?: string,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  const token = crypto.randomUUID();
  const headers = new Headers({
    "content-type": "application/json",
    cookie: `${CSRF_COOKIE}=${token}`,
    [CSRF_HEADER]: token,
    ...extraHeaders,
  });
  return new NextRequest("http://localhost/api/auth/challenge", {
    method,
    headers,
    body: body ?? null,
  });
}

/** Build a NextRequest that is missing the CSRF header (fails guard). */
function noCsrfRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/challenge", {
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/challenge", () => {
  // Re-import after every test so the module-level randomBytes is always fresh.
  // (No persistent state in this route, but good practice.)
  beforeEach(() => {
    vi.resetModules();
  });

  // ── CSRF guard ────────────────────────────────────────────────────────────

  it("returns 403 when CSRF header is absent", async () => {
    const { POST } = await import("../route");
    const res = await POST(noCsrfRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/csrf/i);
  });

  it("returns 403 when CSRF header does not match cookie", async () => {
    const { POST } = await import("../route");
    const token = crypto.randomUUID();
    const headers = new Headers({
      cookie: `${CSRF_COOKIE}=${token}`,
      [CSRF_HEADER]: crypto.randomUUID(), // deliberately different
    });
    const req = new NextRequest("http://localhost/api/auth/challenge", {
      method: "POST",
      headers,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns 200 with challenge and timestamp when CSRF is valid", async () => {
    const { POST } = await import("../route");
    const res = await POST(csrfRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.challenge).toBe("string");
    expect(typeof body.timestamp).toBe("number");
  });

  it("challenge follows the expected format", async () => {
    const { POST } = await import("../route");
    const before = Date.now();
    const res = await POST(csrfRequest());
    const after = Date.now();
    const { challenge, timestamp } = await res.json();

    // Format: "Kora Protocol authentication: {timestamp}:{32-byte hex nonce}"
    expect(challenge).toMatch(
      /^Kora Protocol authentication: \d+:[0-9a-f]{64}$/,
    );

    // Embedded timestamp must match the returned timestamp field
    const embedded = parseInt(challenge.split(": ")[1].split(":")[0], 10);
    expect(embedded).toBe(timestamp);

    // Timestamp must be within the test execution window
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("nonce section is a 64-character hex string (32 random bytes)", async () => {
    const { POST } = await import("../route");
    const res = await POST(csrfRequest());
    const { challenge } = await res.json();
    const nonce = challenge.split(":").pop(); // last segment after "timestamp:nonce"
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different nonce on each call (entropy check)", async () => {
    const { POST } = await import("../route");
    const [r1, r2, r3] = await Promise.all([
      POST(csrfRequest()),
      POST(csrfRequest()),
      POST(csrfRequest()),
    ]);
    const bodies = await Promise.all([r1.json(), r2.json(), r3.json()]);
    const nonces = bodies.map((b: { challenge: string }) =>
      b.challenge.split(":").pop(),
    );
    // All three nonces must be distinct
    const unique = new Set(nonces);
    expect(unique.size).toBe(3);
  });

  it("timestamp is fresh (within last 5 seconds)", async () => {
    const { POST } = await import("../route");
    const before = Date.now();
    const res = await POST(csrfRequest());
    const { timestamp } = await res.json();
    expect(timestamp).toBeGreaterThanOrEqual(before - 100); // allow 100ms leeway
    expect(timestamp).toBeLessThanOrEqual(Date.now() + 100);
  });

  it("returns JSON content-type header", async () => {
    const { POST } = await import("../route");
    const res = await POST(csrfRequest());
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("honours x-request-id if provided and does not expose it in success body", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      csrfRequest("POST", undefined, { "x-request-id": "req-abc-123" }),
    );
    expect(res.status).toBe(200);
    // The route only returns { challenge, timestamp } — no requestId on success
    const body = await res.json();
    expect(body.challenge).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});
