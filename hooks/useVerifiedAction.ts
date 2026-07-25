"use client";

import { useCallback, useRef } from "react";
import { useWallet } from "./useWallet";

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

        // Check if verification is still valid
        if (!wallet.checkVerification()) {
          // Store the pending action and signal that verification is needed
          pendingActionRef.current = action;
          return { requiresVerification: true };
        }

        // Verification is valid, execute the action
        await action();
        return { requiresVerification: false };
      } catch (error) {
        console.error(`Error during protected action (${actionType}):`, error);
        return {
          requiresVerification: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [wallet]
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
