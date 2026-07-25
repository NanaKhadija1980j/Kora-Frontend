"use client";

import { useWalletStore } from "@/store";

/**
 * useNetworkValidation
 * 
 * Provides network validation state for disabling transaction-triggering buttons.
 * Returns true if there's a network mismatch (enum or passphrase).
 * 
 * Usage:
 *   const { isNetworkMismatch, errorMessage } = useNetworkValidation();
 *   <Button disabled={isNetworkMismatch} />
 */
export function useNetworkValidation() {
  const { isWrongNetwork, hasPassphraseMismatch } = useWalletStore();
  
  const isNetworkMismatch = isWrongNetwork() || hasPassphraseMismatch();
  
  let errorMessage = "";
  if (isNetworkMismatch) {
    if (hasPassphraseMismatch()) {
      errorMessage = "Wallet passphrase does not match the app network. Please switch your wallet to the correct network.";
    } else {
      errorMessage = "Wallet is connected to the wrong network. Please switch to the correct network.";
    }
  }

  return {
    isNetworkMismatch,
    errorMessage,
    isWrongNetwork: isWrongNetwork(),
    hasPassphraseMismatch: hasPassphraseMismatch(),
  };
}
