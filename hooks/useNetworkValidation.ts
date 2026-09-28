"use client";

import { useCallback, useMemo } from "react";
import { useWalletStore } from "@/store";
import { env } from "@/lib/env";
import { getConfiguredNetwork } from "@/store/walletStore";

export type MismatchType = "network" | "passphrase" | "both" | null;

/**
 * useNetworkValidation
 *
 * Provides network validation state for the network mismatch wizard.
 * Returns mismatch details, the env passphrase, and helper actions
 * to re-verify after a manual wallet network switch.
 */
export function useNetworkValidation() {
  const { isWrongNetwork, hasPassphraseMismatch, walletPassphrase, network, isConnected } =
    useWalletStore();

  const mismatchType: MismatchType = useMemo(() => {
    const wrongNet = isWrongNetwork();
    const wrongPass = hasPassphraseMismatch();
    if (wrongNet && wrongPass) return "both";
    if (wrongNet) return "network";
    if (wrongPass) return "passphrase";
    return null;
  }, [isWrongNetwork, hasPassphraseMismatch]);

  const isNetworkMismatch = mismatchType !== null;

  const expectedNetwork = getConfiguredNetwork();
  const expectedPassphrase = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;

  let errorMessage = "";
  if (isNetworkMismatch) {
    if (mismatchType === "passphrase") {
      errorMessage =
        "Wallet passphrase does not match the app network. Please switch your wallet to the correct network.";
    } else if (mismatchType === "network") {
      errorMessage =
        "Wallet is connected to the wrong network. Please switch to the correct network.";
    } else {
      errorMessage =
        "Wallet network and passphrase both mismatch. Please switch your wallet to the correct network.";
    }
  }

  /**
   * Re-checks the wallet store after the user has manually switched networks
   * in their wallet extension. Returns true if the mismatch is resolved.
   */
  const reVerify = useCallback((): boolean => {
    const currentWrongNet = useWalletStore.getState().isWrongNetwork();
    const currentWrongPass = useWalletStore.getState().hasPassphraseMismatch();
    return !currentWrongNet && !currentWrongPass;
  }, []);

  return {
    isNetworkMismatch,
    errorMessage,
    mismatchType,
    isWrongNetwork: isWrongNetwork(),
    hasPassphraseMismatch: hasPassphraseMismatch(),
    walletPassphrase,
    expectedPassphrase,
    currentNetwork: network,
    expectedNetwork,
    isCorrectNetwork: !isNetworkMismatch,
    reVerify,
  };
}