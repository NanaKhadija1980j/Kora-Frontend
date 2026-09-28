"use client";

import { useCallback, useRef } from "react";
import { useWallet } from "./useWallet";
import { useVerification } from "@/components/wallet/VerificationProvider";

export interface VerificationPromptState {
  isOpen: boolean;
  actionType: "invoice-creation" | "funding" | "repayment" | "claim" | null;
  onConfirm: (() => Promise<void>) | null;
  onCancel: (() => void) | null;
}

/**
 * Hook for protecting actions that require wallet verification.
 * Provides a wrapper to verify ownership before executing sensitive operations.
 */
export function useVerifiedAction() {
  const wallet = useWallet();
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);

  let requireVerificationCtx: ((actionType: string) => Promise<void>) | undefined;
  try {
    const ctx = useVerification();
    requireVerificationCtx = ctx.requireVerification;
  } catch {
    // Outside provider context — fallback to manual verifyAndRetry flow
  }

  const executeProtectedAction = useCallback(
    async (
      action: () => Promise<void>,
      actionType: "invoice-creation" | "funding" | "repayment" | "claim"
    ): Promise<{ requiresVerification: boolean; error?: string }> => {
      try {
        // Check if wallet is connected
        if (!wallet.isConnected) {
          return { requiresVerification: false, error: "Wallet not connected" };
        }

        // Store pending action
        pendingActionRef.current = action;

        // Check if verification is valid
        if (!wallet.checkVerification()) {
          if (requireVerificationCtx) {
            // Trigger prompt via VerificationProvider
            await requireVerificationCtx(actionType);
            // After successful verification, execute action
            await action();
            pendingActionRef.current = null;
            return { requiresVerification: false };
          }
          // Signal that verification is needed
          return { requiresVerification: true };
        }

        // Verification is valid, execute the action
        await action();
        pendingActionRef.current = null;
        return { requiresVerification: false };
      } catch (error) {
        console.error(`Error during protected action (${actionType}):`, error);
        return {
          requiresVerification: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [wallet, requireVerificationCtx]
  );

  const verifyAndRetry = useCallback(async (): Promise<boolean> => {
    try {
      await wallet.verifyOwnership();
      if (pendingActionRef.current) {
        await pendingActionRef.current();
        pendingActionRef.current = null;
      }
      return true;
    } catch (error) {
      console.error("Verification failed:", error);
      return false;
    }
  }, [wallet]);

  const getPendingAction = useCallback(() => pendingActionRef.current, []);

  const clearPendingAction = useCallback(() => {
    pendingActionRef.current = null;
  }, []);

  return {
    executeProtectedAction,
    verifyAndRetry,
    getPendingAction,
    clearPendingAction,
    checkVerification: wallet.checkVerification,
    isVerified: wallet.isVerified,
  };
}
