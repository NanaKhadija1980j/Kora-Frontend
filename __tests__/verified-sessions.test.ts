/**
 * Unit tests for the verified-wallet session registry (Issue #810).
 *
 * `lib/verifiedSessions.ts` is the in-memory allow-list that upload token
 * verification consults, so that pinning can only be authorized for a wallet
 * that actually completed the /api/auth/challenge -> /api/auth/verify
 * signature flow.
 *
 * The module keeps a module-level `Map`, so each test re-imports it after
 * `vi.resetModules()` to get a clean registry. That way "an unknown wallet is
 * unverified" is genuinely a first read, not a leftover entry from a previous
 * test that would hide a regression.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type * as VerifiedSessions from "@/lib/verifiedSessions";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const WALLET_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const WALLET_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBQJ";

/**
 * Load a pristine copy of the module. The registry is module state, so a
 * fresh import is the only way to assert on a truly empty store.
 */
async function freshRegistry(): Promise<typeof VerifiedSessions> {
  vi.resetModules();
  return (await import("@/lib/verifiedSessions")) as typeof VerifiedSessions;
}

describe("lib/verifiedSessions", () => {
  let sessions: typeof VerifiedSessions;

  beforeEach(async () => {
    sessions = await freshRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("unverified wallets", () => {
    it("reports a wallet that was never marked as not verified", () => {
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });

    it("does not treat an empty address as verified", () => {
      expect(sessions.isWalletVerified("")).toBe(false);
    });

    it("does not treat a lookalike address as verified", () => {
      // Keys are exact strings; a prefix must not match.
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      expect(sessions.isWalletVerified(WALLET_A.slice(0, 20))).toBe(false);
    });

    it("is case-sensitive about the address", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      expect(sessions.isWalletVerified(WALLET_A.toLowerCase())).toBe(false);
    });
  });

  describe("markWalletVerified", () => {
    it("makes a freshly marked wallet verified", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);
    });

    it("returns nothing — it is a void writer", () => {
      expect(sessions.markWalletVerified(WALLET_A, Date.now() + HOUR)).toBeUndefined();
    });

    it("keeps wallets independent of one another", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      expect(sessions.isWalletVerified(WALLET_B)).toBe(false);
    });

    it("overwrites the expiry when the same wallet verifies again", () => {
      // A re-verification must extend the session, not be ignored because an
      // entry already exists.
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      const extended = Date.now() + 2 * HOUR;
      sessions.markWalletVerified(WALLET_A, extended);

      vi.useFakeTimers();
      vi.setSystemTime(extended - 1);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);
    });

    it("lets a re-verification shorten a long session", () => {
      const soon = Date.now() + 5_000;
      sessions.markWalletVerified(WALLET_A, Date.now() + 2 * HOUR);
      sessions.markWalletVerified(WALLET_A, soon);

      vi.useFakeTimers();
      vi.setSystemTime(soon + 1);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });

    it("can re-verify a wallet after it expired", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() - 1);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);

      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);
    });
  });

  describe("isWalletVerified — live sessions", () => {
    it("accepts a session expiring well in the future", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);
    });

    it("accepts a session that expires on the next tick", () => {
      const expiresAt = Date.now() + 1000;
      sessions.markWalletVerified(WALLET_A, expiresAt);

      vi.useFakeTimers();
      vi.setSystemTime(expiresAt);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);
    });

    it("reports many wallets verified at once", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      sessions.markWalletVerified(WALLET_B, Date.now() + HOUR);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);
      expect(sessions.isWalletVerified(WALLET_B)).toBe(true);
    });
  });

  describe("isWalletVerified — expiry", () => {
    it("rejects a session that expired one millisecond ago", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() - 1);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });

    it("rejects a session that expired long ago", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() - 2 * HOUR);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });

    it("keeps rejecting after expiry on repeated reads", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() - 1);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });

    it("tracks the clock rather than a snapshot taken at mark time", () => {
      const expiresAt = Date.now() + HOUR;
      sessions.markWalletVerified(WALLET_A, expiresAt);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);

      // Jump past the expiry without touching the registry.
      vi.useFakeTimers();
      vi.setSystemTime(expiresAt + 1);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });

    it("does not expire an unrelated wallet when one lapses", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() - 1);
      sessions.markWalletVerified(WALLET_B, Date.now() + HOUR);

      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
      expect(sessions.isWalletVerified(WALLET_B)).toBe(true);
    });
  });

  describe("expired-entry deletion", () => {
    it("removes the entry when a lapsed session is read", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() - 1);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);

      // A re-read is also false, which it would be either way — the observable
      // proof of deletion is that re-marking works without a stale expiry
      // winning the comparison.
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);
    });

    it("does not evict live sessions while pruning a lapsed one", () => {
      sessions.markWalletVerified(WALLET_A, Date.now() - 1);
      sessions.markWalletVerified(WALLET_B, Date.now() + HOUR);

      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
      expect(sessions.isWalletVerified(WALLET_B)).toBe(true);
    });

    it("keeps working across a long lapse with no reads in between", () => {
      // The map is never swept on a timer, so a lapsed entry can sit stale
      // until it is consulted. It must still be rejected, not resurrected.
      sessions.markWalletVerified(WALLET_A, Date.now() + HOUR);

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 10 * HOUR);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });
  });

  describe("degenerate expiry values", () => {
    it("treats an expiry of 0 as falsy and therefore unverified", () => {
      // `if (!expiresAt) return false` short-circuits before the clock is
      // even consulted, so a 0 expiry never becomes a valid session.
      sessions.markWalletVerified(WALLET_A, 0);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });

    it("rejects a NaN expiry rather than letting it through", () => {
      // NaN is falsy, so the `!expiresAt` guard rejects it. The competing
      // path would be `Date.now() > NaN`, which is false — i.e. a naive
      // removal of the guard would read this as a *valid* session, so the
      // guard is what keeps it out.
      sessions.markWalletVerified(WALLET_A, Number.NaN);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });

    it("accepts an infinite expiry as a session that never lapses", () => {
      sessions.markWalletVerified(WALLET_A, Number.POSITIVE_INFINITY);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(true);
    });

    it("rejects a negative expiry immediately", () => {
      // Negative is truthy, so this falls through to the clock comparison and
      // is caught there.
      sessions.markWalletVerified(WALLET_A, -1);
      expect(sessions.isWalletVerified(WALLET_A)).toBe(false);
    });
  });
});
