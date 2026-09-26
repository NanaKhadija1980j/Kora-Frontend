import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVerifiedAction } from "@/hooks/useVerifiedAction";

const { useWalletMock, useVerificationMock } = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
  useVerificationMock: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => useWalletMock(),
}));

vi.mock("@/components/wallet/VerificationProvider", () => ({
  useVerification: () => useVerificationMock(),
}));

interface WalletMock {
  isConnected: boolean;
  isVerified: boolean;
  checkVerification: ReturnType<typeof vi.fn>;
  verifyOwnership: ReturnType<typeof vi.fn>;
}

function makeWallet(overrides: Partial<WalletMock> = {}): WalletMock {
  return {
    isConnected: true,
    isVerified: false,
    checkVerification: vi.fn().mockReturnValue(false),
    verifyOwnership: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Simulate being mounted outside <VerificationProvider>: `useVerification` throws. */
function noProviderContext() {
  useVerificationMock.mockImplementation(() => {
    throw new Error("useVerification must be used within VerificationProvider");
  });
}

type ProtectedActionResult = { requiresVerification: boolean; error?: string };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useVerifiedAction", () => {
  describe("wallet-not-connected branch", () => {
    it("returns an error and never runs the action when disconnected", async () => {
      useWalletMock.mockReturnValue(makeWallet({ isConnected: false }));
      const { result } = renderHook(() => useVerifiedAction());
      const action = vi.fn(async () => {});

      let res: ProtectedActionResult | undefined;
      await act(async () => {
        res = await result.current.executeProtectedAction(action, "funding");
      });

      expect(res!.requiresVerification).toBe(false);
      expect(res!.error).toBe("Wallet not connected");
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe("executeProtectedAction wrapper branches", () => {
    it("runs the action directly when verification is already valid", async () => {
      useWalletMock.mockReturnValue(
        makeWallet({
          isVerified: true,
          checkVerification: vi.fn().mockReturnValue(true),
        })
      );
      const { result } = renderHook(() => useVerifiedAction());
      const action = vi.fn(async () => {});

      let res: ProtectedActionResult | undefined;
      await act(async () => {
        res = await result.current.executeProtectedAction(action, "repayment");
      });

      expect(res!.requiresVerification).toBe(false);
      expect(action).toHaveBeenCalledOnce();
    });

    it("prompts via VerificationProvider before running when unverified", async () => {
      const requireVerification = vi.fn(async () => {});
      useWalletMock.mockReturnValue(makeWallet());
      useVerificationMock.mockReturnValue({
        requireVerification,
        isVerified: false,
        isLoading: false,
      });

      const { result } = renderHook(() => useVerifiedAction());
      const action = vi.fn(async () => {});

      await act(async () => {
        await result.current.executeProtectedAction(action, "invoice-creation");
      });

      expect(requireVerification).toHaveBeenCalledWith("invoice-creation");
      expect(action).toHaveBeenCalledOnce();
    });

    it("defers the action with requiresVerification:true when outside the provider", async () => {
      useWalletMock.mockReturnValue(makeWallet());
      noProviderContext();

      const { result } = renderHook(() => useVerifiedAction());
      const action = vi.fn(async () => {});

      let res: ProtectedActionResult | undefined;
      await act(async () => {
        res = await result.current.executeProtectedAction(action, "claim");
      });

      expect(res!.requiresVerification).toBe(true);
      expect(res!.error).toBeUndefined();
      expect(action).not.toHaveBeenCalled();
      // The action is stashed so verifyAndRetry can run it later.
      expect(result.current.getPendingAction()).toBe(action);
    });

    it("reports a thrown action error without swallowing it", async () => {
      useWalletMock.mockReturnValue(
        makeWallet({
          isVerified: true,
          checkVerification: vi.fn().mockReturnValue(true),
        })
      );
      const { result } = renderHook(() => useVerifiedAction());
      const action = vi.fn(async () => {
        throw new Error("insufficient balance");
      });

      let res: ProtectedActionResult | undefined;
      await act(async () => {
        res = await result.current.executeProtectedAction(action, "funding");
      });

      expect(res!.requiresVerification).toBe(false);
      expect(res!.error).toBe("insufficient balance");
    });
  });

  describe("verifyAndRetry", () => {
    it("verifies ownership then runs the stashed action", async () => {
      const verifyOwnership = vi.fn(async () => {});
      useWalletMock.mockReturnValue(makeWallet({ verifyOwnership }));
      noProviderContext();

      const { result } = renderHook(() => useVerifiedAction());
      const action = vi.fn(async () => {});

      await act(async () => {
        await result.current.executeProtectedAction(action, "funding");
      });

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.verifyAndRetry();
      });

      expect(ok).toBe(true);
      expect(verifyOwnership).toHaveBeenCalledOnce();
      expect(action).toHaveBeenCalledOnce();
      expect(result.current.getPendingAction()).toBeNull();
    });

    it("returns false when ownership verification fails", async () => {
      const verifyOwnership = vi.fn(async () => {
        throw new Error("verification rejected");
      });
      useWalletMock.mockReturnValue(makeWallet({ verifyOwnership }));
      noProviderContext();

      const { result } = renderHook(() => useVerifiedAction());
      const action = vi.fn(async () => {});

      await act(async () => {
        await result.current.executeProtectedAction(action, "funding");
      });

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.verifyAndRetry();
      });

      expect(ok).toBe(false);
      expect(action).not.toHaveBeenCalled();
      // The pending action is kept so the caller can retry again.
      expect(result.current.getPendingAction()).toBe(action);
    });

    it("returns true when there is no pending action to run", async () => {
      const verifyOwnership = vi.fn(async () => {});
      useWalletMock.mockReturnValue(makeWallet({ verifyOwnership }));

      const { result } = renderHook(() => useVerifiedAction());

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.verifyAndRetry();
      });

      expect(ok).toBe(true);
      expect(verifyOwnership).toHaveBeenCalledOnce();
    });
  });

  describe("pending action helpers", () => {
    it("clearPendingAction drops a stashed action", async () => {
      useWalletMock.mockReturnValue(makeWallet());
      noProviderContext();

      const { result } = renderHook(() => useVerifiedAction());
      const action = vi.fn(async () => {});

      await act(async () => {
        await result.current.executeProtectedAction(action, "funding");
      });
      expect(result.current.getPendingAction()).toBe(action);

      act(() => {
        result.current.clearPendingAction();
      });

      expect(result.current.getPendingAction()).toBeNull();
    });
  });
});
