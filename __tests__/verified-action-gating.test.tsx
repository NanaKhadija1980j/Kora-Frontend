import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook as baseRenderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWalletStore } from "@/store/walletStore";
import { useVerifiedAction } from "@/hooks/useVerifiedAction";
import { verifyCsrf, CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";
import { NextRequest } from "next/server";

// `useVerifiedAction` composes `useWallet`, which reaches for the app router and
// the query client. Neither exists in a bare jsdom render.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard/investor",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock env. `useVerifiedAction` reaches `lib/stellar/client`, which builds its
// RPC and Horizon singletons at module load — the URLs must be present or the
// whole suite fails to collect.
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  },
}));

vi.mock("@/components/wallet/VerificationProvider", () => ({
  useVerification: () => ({
    requireVerification: vi.fn(async () => {
      // Simulate successful verification flow in tests
      const store = useWalletStore.getState();
      store.setVerified(true, Date.now() + 3600000);
    }),
    isVerified: useWalletStore.getState().isVerified,
    isLoading: false,
  }),
}));

/** renderHook with the QueryClientProvider `useWallet` expects. */
function renderHook<T>(cb: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return baseRenderHook(cb, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("Verified Action Gating Integration Tests", () => {
  beforeEach(() => {
    useWalletStore.getState().disconnect();
    useWalletStore.setState({
      address: "GABC1234567890TESTADDRESS",
      publicKey: "GABC1234567890TESTADDRESS",
      isConnected: true,
      provider: "freighter",
      isVerified: false,
      verifiedAt: null,
      verificationExpiresAt: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. CSRF Validation on Auth Routes ──────────────────────────────────────
  describe("CSRF Validation", () => {
    function createRequest(headers: Record<string, string> = {}): NextRequest {
      const h = new Headers(headers);
      return new NextRequest("http://localhost/api/auth/verify", { method: "POST", headers: h });
    }

    it("returns 403 when CSRF header x-kora-csrf is missing", () => {
      const req = createRequest();
      const res = verifyCsrf(req);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    });

    it("returns null (valid) when header matches cookie", () => {
      const token = "test-csrf-token-123";
      const h = new Headers({
        [CSRF_HEADER]: token,
        cookie: `${CSRF_COOKIE}=${token}`,
      });
      const req = new NextRequest("http://localhost/api/auth/verify", { method: "POST", headers: h });
      const res = verifyCsrf(req);
      expect(res).toBeNull();
    });
  });

  // ─── 2. Action Protection (Mint, Fund, Repay) ─────────────────────────────
  describe("Protected Actions Execution", () => {
    it("blocks unverified connected users and triggers verification prompt", async () => {
      const { result } = renderHook(() => useVerifiedAction());
      const actionSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(actionSpy, "invoice-creation");
      });

      // User was initially unverified, but prompt ran and verified them, then executed action
      expect(actionSpy).toHaveBeenCalledOnce();
      expect(useWalletStore.getState().isVerified).toBe(true);
    });

    it("blocks action when wallet is completely disconnected", async () => {
      useWalletStore.getState().disconnect();
      const { result } = renderHook(() => useVerifiedAction());
      const actionSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(actionSpy, "funding");
      });

      expect(res.requiresVerification).toBe(false);
      expect(res.error).toBe("Wallet not connected");
      expect(actionSpy).not.toHaveBeenCalled();
    });

    it("executes protected action directly when user is already verified", async () => {
      useWalletStore.getState().setVerified(true, Date.now() + 3600000);

      const { result } = renderHook(() => useVerifiedAction());
      const actionSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(actionSpy, "repayment");
      });

      expect(res.requiresVerification).toBe(false);
      expect(actionSpy).toHaveBeenCalledOnce();
    });
  });

  // ─── 2b. Investor Yield Claim (Issue #681) ────────────────────────────────
  //
  // Claiming yield moves funds and now runs through the same gate as SME
  // repayment. These pin the "claim" action type specifically, so the gating
  // cannot be dropped from the claim path while the others keep their coverage.
  describe("Investor yield claim gating", () => {
    it("prompts an unverified investor before running the claim", async () => {
      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {});

      expect(useWalletStore.getState().isVerified).toBe(false);

      await act(async () => {
        await result.current.executeProtectedAction(claimSpy, "claim");
      });

      // The prompt ran, verified the session, and only then released the claim.
      expect(useWalletStore.getState().isVerified).toBe(true);
      expect(claimSpy).toHaveBeenCalledOnce();
    });

    it("runs the claim with no extra prompt when the session is already valid", async () => {
      useWalletStore.getState().setVerified(true, Date.now() + 3_600_000);
      const verifiedAt = useWalletStore.getState().verifiedAt;

      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(claimSpy, "claim");
      });

      expect(res.requiresVerification).toBe(false);
      expect(claimSpy).toHaveBeenCalledOnce();
      // A fresh prompt would have re-stamped the session.
      expect(useWalletStore.getState().verifiedAt).toBe(verifiedAt);
    });

    it("re-prompts when the claim is attempted on an expired session", async () => {
      // Two hours past the one-hour verification window.
      useWalletStore.getState().setVerified(true, Date.now() - 2 * 60 * 60 * 1000);
      expect(useWalletStore.getState().isVerificationExpired()).toBe(true);

      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {});

      await act(async () => {
        await result.current.executeProtectedAction(claimSpy, "claim");
      });

      expect(useWalletStore.getState().isVerified).toBe(true);
      expect(claimSpy).toHaveBeenCalledOnce();
    });

    it("blocks the claim outright when no wallet is connected", async () => {
      useWalletStore.getState().disconnect();

      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(claimSpy, "claim");
      });

      expect(res.error).toBe("Wallet not connected");
      expect(claimSpy).not.toHaveBeenCalled();
    });

    it("reports a failing claim as an error rather than a verification prompt", async () => {
      useWalletStore.getState().setVerified(true, Date.now() + 3_600_000);

      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {
        throw new Error("insufficient position balance");
      });

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(claimSpy, "claim");
      });

      expect(res.requiresVerification).toBe(false);
      expect(res.error).toBe("insufficient position balance");
    });
  });

  // ─── 3. Session Expiry & Re-verification ──────────────────────────────────
  describe("Session Expiry & Re-verify Prompt", () => {
    it("reports a lapsed verification as expired", () => {
      // `verifiedAt` is when the wallet proved ownership; the session lapses an
      // hour later, so a stamp two hours old is past it.
      useWalletStore.getState().setVerified(true, Date.now() - 2 * 60 * 60 * 1000);

      expect(useWalletStore.getState().isVerificationExpired()).toBe(true);
    });

    it("treats a fresh verification as still valid", () => {
      useWalletStore.getState().setVerified(true, Date.now());

      expect(useWalletStore.getState().isVerificationExpired()).toBe(false);
    });

    it("prompts for re-verification when session is expired upon action attempt", async () => {
      const expiredTimestamp = Date.now() - 1000;
      useWalletStore.getState().setVerified(true, expiredTimestamp);

      const { result } = renderHook(() => useVerifiedAction());
      const actionSpy = vi.fn(async () => {});

      await act(async () => {
        await result.current.executeProtectedAction(actionSpy, "funding");
      });

      expect(useWalletStore.getState().isVerified).toBe(true);
      expect(actionSpy).toHaveBeenCalledOnce();
    });
  });
});
