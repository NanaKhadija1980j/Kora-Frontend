"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { useWallet } from "@/hooks/useWallet";
import { VerificationModal } from "./VerificationModal";

interface VerificationContextType {
  requireVerification: (actionType: string) => Promise<void>;
  isVerified: boolean;
  isLoading: boolean;
}

const VerificationContext = createContext<VerificationContextType | null>(null);

export function VerificationProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionType, setActionType] = useState<string>("");
  const [challengeMessage, setChallengeMessage] = useState<string | undefined>(undefined);
  const [verificationPromise, setVerificationPromise] = useState<{
    resolve: () => void;
    reject: (reason: Error) => void;
  } | null>(null);

  const requireVerification = useCallback(
    async (type: string): Promise<void> => {
      // Skip if already verified within the current session
      if (wallet.checkVerification()) {
        return;
      }

      setActionType(type);
      setError(null);

      // Pre-fetch the challenge so we can show the message to the user before they sign
      let prefetchedChallenge: string | undefined;
      try {
        prefetchedChallenge = await wallet.requestChallenge();
        setChallengeMessage(prefetchedChallenge);
      } catch {
        // Non-fatal: modal will just not show the message preview
        setChallengeMessage(undefined);
      }

      return new Promise((resolve, reject) => {
        setVerificationPromise({ resolve, reject });
        setIsOpen(true);
      });
    },
    [wallet]
  );

  const handleVerify = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await wallet.verifyOwnership();
      setIsOpen(false);
      setChallengeMessage(undefined);
      verificationPromise?.resolve();
      setVerificationPromise(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed. Please try again.";
      setError(message);
      // Don't reject the promise on error — let the user retry
    } finally {
      setIsLoading(false);
    }
  }, [wallet, verificationPromise]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setChallengeMessage(undefined);
    verificationPromise?.reject(new Error("Verification cancelled"));
    setVerificationPromise(null);
  }, [verificationPromise]);

  // Clear if wallet disconnects while modal is open
  useEffect(() => {
    if (!wallet.isConnected && isOpen) {
      handleCancel();
    }
  }, [wallet.isConnected, isOpen, handleCancel]);

  return (
    <VerificationContext.Provider
      value={{
        requireVerification,
        isVerified: wallet.isVerified,
        isLoading,
      }}
    >
      {children}
      <VerificationModal
        isOpen={isOpen}
        isLoading={isLoading}
        error={error ?? undefined}
        actionType={actionType}
        challengeMessage={challengeMessage}
        onVerify={handleVerify}
        onCancel={handleCancel}
      />
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error("useVerification must be used within VerificationProvider");
  }
  return context;
}
