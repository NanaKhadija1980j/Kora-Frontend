/**
 * Unit tests for the CSRF double-submit cookie helpers (Issue #808).
 *
 * The double-submit pattern is only safe if *every* rejection path is
 * covered: a missing cookie, a missing header, and a mismatch must each be
 * rejected independently. A change that only checks one of the two halves
 * would silently accept a request an attacker can forge, so these tests pin
 * all three 403 branches plus the single success branch.
 *
 * `verifyCsrf` returns `null` on success and a 403 `NextResponse` on
 * failure, so most assertions are on the returned response.
 */

import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { verifyCsrf, issueCsrfToken, CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";

const URL = "http://localhost/api/auth/verify";

/**
 * Build a mutating request carrying an optional cookie value and header
 * value. Passing `undefined` for either omits it entirely, which is how a
 * browser behaves when a session has no token yet.
 */
function createRequest(options: { cookie?: string; header?: string } = {}): NextRequest {
  const headers = new Headers();
  if (options.header !== undefined) headers.set(CSRF_HEADER, options.header);
  if (options.cookie !== undefined) {
    headers.set("cookie", `${CSRF_COOKIE}=${options.cookie}`);
  }
  return new NextRequest(URL, { method: "POST", headers });
}

/** Read the JSON body of a NextResponse, which verifyCsrf returns on failure. */
async function bodyOf(response: NextResponse): Promise<Record<string, string>> {
  return (await response.json()) as Record<string, string>;
}

describe("csrf constants", () => {
  it("uses the documented cookie and header names", () => {
    expect(CSRF_COOKIE).toBe("__kora_csrf");
    expect(CSRF_HEADER).toBe("x-kora-csrf");
  });
});

describe("verifyCsrf — success", () => {
  it("returns null when the header matches the cookie", () => {
    const token = "test-csrf-token-123";
    expect(verifyCsrf(createRequest({ cookie: token, header: token }))).toBeNull();
  });

  it("accepts a UUID-shaped token", () => {
    const token = crypto.randomUUID();
    expect(verifyCsrf(createRequest({ cookie: token, header: token }))).toBeNull();
  });

  it("is case-insensitive about the header name, per HTTP semantics", () => {
    // The browser client may send `X-Kora-CSRF`; Headers normalises lookup.
    const token = "case-token";
    const headers = new Headers({
      "X-KORA-CSRF": token,
      cookie: `${CSRF_COOKIE}=${token}`,
    });
    const request = new NextRequest(URL, { method: "POST", headers });
    expect(verifyCsrf(request)).toBeNull();
  });

  it("accepts a cookie sent alongside unrelated cookies", () => {
    const token = "multi-cookie-token";
    const headers = new Headers({
      [CSRF_HEADER]: token,
      cookie: `session=abc; ${CSRF_COOKIE}=${token}; theme=dark`,
    });
    const request = new NextRequest(URL, { method: "POST", headers });
    expect(verifyCsrf(request)).toBeNull();
  });

  it("is a pure check — the same request can be verified repeatedly", () => {
    // The helper must not consume or mutate the token; a retry of an
    // idempotent request has to keep working.
    const token = "retry-token";
    const request = createRequest({ cookie: token, header: token });
    expect(verifyCsrf(request)).toBeNull();
    expect(verifyCsrf(request)).toBeNull();
  });
});

describe("verifyCsrf — missing cookie", () => {
  it("returns 403 when no cookie is present at all", async () => {
    const response = verifyCsrf(createRequest({ header: "some-token" }));
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
    expect(await bodyOf(response!)).toEqual({ error: "CSRF token missing" });
  });

  it("returns 403 when the header is also absent", async () => {
    // Neither half present — still the "missing" branch, not a mismatch.
    const response = verifyCsrf(createRequest());
    expect(response!.status).toBe(403);
    expect(await bodyOf(response!)).toEqual({ error: "CSRF token missing" });
  });

  it("returns 403 when the cookie exists but carries an empty value", async () => {
    // An empty cookie is a real failure mode: the client stored "" and then
    // sent it back. It must not be treated as a valid token.
    const response = verifyCsrf(createRequest({ cookie: "", header: "" }));
    expect(response!.status).toBe(403);
    expect(await bodyOf(response!)).toEqual({ error: "CSRF token missing" });
  });
});

describe("verifyCsrf — missing header", () => {
  it("returns 403 when the cookie is present but the header is not", async () => {
    // This is the exact shape of a cross-origin CSRF attempt: the browser
    // attaches the cookie automatically, but the attacker cannot read the
    // HttpOnly value to set the header.
    const response = verifyCsrf(createRequest({ cookie: "cookie-only-token" }));
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
    expect(await bodyOf(response!)).toEqual({ error: "CSRF token missing" });
  });

  it("returns 403 when a different cookie name carries the token", async () => {
    const token = "wrong-name-token";
    const headers = new Headers({
      [CSRF_HEADER]: token,
      cookie: `csrf=${token}`,
    });
    const request = new NextRequest(URL, { method: "POST", headers });
    expect(verifyCsrf(request)!.status).toBe(403);
  });
});

describe("verifyCsrf — mismatch", () => {
  it("returns 403 when the header does not match the cookie", async () => {
    const response = verifyCsrf(
      createRequest({ cookie: "cookie-token", header: "header-token" })
    );
    expect(response!.status).toBe(403);
    expect(await bodyOf(response!)).toEqual({ error: "CSRF token mismatch" });
  });

  it("rejects a header that only shares a prefix with the cookie", async () => {
    // Guards against a future `startsWith` comparison sneaking in.
    const response = verifyCsrf(
      createRequest({ cookie: "abcdef123", header: "abcdef123456extra" })
    );
    expect(response!.status).toBe(403);
    expect(await bodyOf(response!)).toEqual({ error: "CSRF token mismatch" });
  });

  it("rejects a cookie that is a prefix of the header", () => {
    const response = verifyCsrf(
      createRequest({ cookie: "abcdef", header: "abcdef123" })
    );
    expect(response!.status).toBe(403);
  });

  it("rejects a stale token after rotation", async () => {
    // GET /api/auth/csrf issues a fresh token, invalidating the old one.
    const rotated = verifyCsrf(
      createRequest({ cookie: "new-token", header: "old-token" })
    );
    expect(rotated!.status).toBe(403);
    expect(await bodyOf(rotated!)).toEqual({ error: "CSRF token mismatch" });
  });

  it("is case-sensitive, so a single flipped character is rejected", () => {
    const response = verifyCsrf(
      createRequest({ cookie: "AbCdEf-123", header: "abcdef-123" })
    );
    expect(response!.status).toBe(403);
  });
});

describe("issueCsrfToken", () => {
  it("returns a token and sets it as an HttpOnly cookie", () => {
    const response = NextResponse.json({ ok: true });
    const token = issueCsrfToken(response);

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${CSRF_COOKIE}=${token}`);
    expect(setCookie).toContain("HttpOnly");
  });

  it("scopes the cookie to SameSite=Strict and the whole origin", () => {
    const response = NextResponse.json({ ok: true });
    issueCsrfToken(response);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("SameSite=strict");
    expect(setCookie).toContain("Path=/");
  });

  it("does not set a maxAge, so the token dies with the browser session", () => {
    const response = NextResponse.json({ ok: true });
    issueCsrfToken(response);

    expect(response.headers.get("set-cookie") ?? "").not.toContain("Max-Age");
  });

  it("issues a different token on every call", () => {
    const first = issueCsrfToken(NextResponse.json({ ok: true }));
    const second = issueCsrfToken(NextResponse.json({ ok: true }));
    expect(first).not.toBe(second);
  });

  it("produces a token that verifyCsrf accepts when submitted back", () => {
    const response = NextResponse.json({ ok: true });
    const token = issueCsrfToken(response);

    // The round trip the client actually performs: take the token from the
    // issue response, send it as header + cookie on a mutating request.
    expect(verifyCsrf(createRequest({ cookie: token, header: token }))).toBeNull();
  });

  it("rejects the previous token after a rotation", async () => {
    const previous = issueCsrfToken(NextResponse.json({ ok: true }));
    const current = issueCsrfToken(NextResponse.json({ ok: true }));

    const response = verifyCsrf(createRequest({ cookie: current, header: previous }));
    expect(response!.status).toBe(403);
    expect(await bodyOf(response!)).toEqual({ error: "CSRF token mismatch" });
  });
});
