"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  FreighterModule,
  xBullModule,
  LobstrModule,
  AlbedoModule,
} from "@creit.tech/stellar-wallets-kit";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useWalletStore, useUIStore } from "@/store";
import { getConfiguredNetwork } from "@/store/walletStore";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAccountBalances,
  fundTestnetAccount,
  checkAccountExists,
  submitTransaction,
  waitForTransaction,
} from "@/lib/stellar/client";
import { buildTestnetUsdcMintTx } from "@/lib/stellar/contracts";
import {
  isTestnetUsdcFaucetEnabled,
  pollUsdcBalanceAfterMint,
} from "@/hooks/useUsdcBalance";
import { queryKeys } from "@/lib/queryKeys";
import { useInvoiceStore } from "@/store/invoiceStore";
import { env } from "@/lib/env";
import type { WalletProvider } from "@/types";

/** Default testnet USDC mint amount in stroops (7 decimals): 10,000 USDC. */
export const TESTNET_USDC_MINT_AMOUNT = BigInt("100000000000");

let kit: StellarWalletsKit | null = null;

const WALLET_NETWORK =
  env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? WalletNetwork.PUBLIC
    : WalletNetwork.TESTNET;

function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WALLET_NETWORK,
      selectedWalletId: FREIGHTER_ID,
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new LobstrModule(),
        new AlbedoModule(),
      ],
    });
  }
  return kit;
}

/**
 * Attempts a silent re-establishment of the wallet kit session by calling
 * getPublicKey() on the previously used provider.  Resolves to the recovered
 * public key on success, or throws if the extension is locked / unavailable.
 */
async function silentReconnect(provider: WalletProvider): Promise<string> {
  const walletKit = getKit();
  walletKit.setWallet(provider);
  // getPublicKey() will throw if the extension is locked or not installed.
  const publicKey = await walletKit.getPublicKey();
  return publicKey;
}

export function useWallet() {
  const {
    address,
    publicKey,
    isConnected,
    provider,
    balance,
    isVerified,
    verifiedAt,
    kitSessionActive,
    connect,
    disconnect,
    setBalance,
    setVerified,
    clearVerification,
    isVerificationExpired,
    updateActivity,
    isSessionExpired,
    setKitSessionActive,
    setNetwork,
  } = useWalletStore();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Local UI state for the reconnect prompt (stale-session banner in WalletButton)
  const [showReconnectPrompt, setShowReconnectPrompt] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // ── Silent reconnect on mount ──────────────────────────────────────────────
  // After a page refresh the zustand store rehydrates from localStorage and
  // reports isConnected=true, but the in-memory kit singleton is gone.  We
  // attempt a silent getPublicKey() call to restore the kit session without
  // requiring user interaction.  If the wallet extension is locked or missing
  // we surface the reconnect prompt instead.
  const silentReconnectAttemptedRef = useRef(false);

  useEffect(() => {
    // Only attempt once per mount, and only when the store says connected but
    // the kit session has not yet been established.
    if (!isConnected || kitSessionActive !== false) return;
    if (silentReconnectAttemptedRef.current) return;
    silentReconnectAttemptedRef.current = true;

    // Skip during mock / SSR contexts.
    if (typeof window === "undefined") return;
    if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
      setKitSessionActive(true);
      return;
    }

    // Mark as pending so UI shows a spinner rather than the stale badge.
    setKitSessionActive(null);

    const attemptSilentReconnect = async () => {
      if (!provider) {
        // No provider persisted — cannot reconnect silently, surface prompt.
        setKitSessionActive(false);
        setShowReconnectPrompt(true);
        return;
      }

      try {
        const recoveredKey = await silentReconnect(provider);
        // Verify the recovered key matches the persisted one.
        if (recoveredKey !== address) {
          // Address changed (user switched accounts) — treat as disconnected.
          useWalletStore.getState().disconnect();
          window.dispatchEvent(new CustomEvent("kora:session-expired"));
          return;
        }
        setKitSessionActive(true);
        setShowReconnectPrompt(false);
        // Refresh balance in the background — don't block the session restore.
        try {
          const raw = await getAccountBalances(recoveredKey);
          useWalletStore.getState().setBalance({
            xlm: raw.xlm,
            usdc: raw.usdc,
            eurc: raw.otherAssets.find((a) => a.code === "EURC")?.balance ?? "0",
          });
        } catch {
          // Non-critical — silently ignore balance fetch failures.
        }
      } catch {
        // Extension is locked or unavailable — show reconnect prompt.
        setKitSessionActive(false);
        setShowReconnectPrompt(true);
      }
    };

    attemptSilentReconnect();
  }, [isConnected, kitSessionActive, provider, address, setKitSessionActive]);

  // ── Manual reconnect (triggered from the reconnect prompt UI) ────────────
  const manualReconnect = useCallback(async (): Promise<void> => {
    if (!provider || !address) {
      // No persisted session — open the full connect modal.
      useUIStore.getState().setWalletModalOpen(true);
      return;
    }
    setIsReconnecting(true);
    setKitSessionActive(null);
    try {
      const recoveredKey = await silentReconnect(provider);
      if (recoveredKey !== address) {
        // Account changed — full disconnect + modal.
        useWalletStore.getState().disconnect();
        useUIStore.getState().setWalletModalOpen(true);
        return;
      }
      setKitSessionActive(true);
      setShowReconnectPrompt(false);
      // Refresh balance after manual reconnect.
      try {
        const raw = await getAccountBalances(recoveredKey);
        useWalletStore.getState().setBalance({
          xlm: raw.xlm,
          usdc: raw.usdc,
          eurc: raw.otherAssets.find((a) => a.code === "EURC")?.balance ?? "0",
        });
      } catch {
        // Non-critical.
      }
    } catch {
      // Still locked — keep the prompt visible; user needs to unlock.
      setKitSessionActive(false);
      setShowReconnectPrompt(true);
    } finally {
      setIsReconnecting(false);
    }
  }, [provider, address, setKitSessionActive]);

  // ── Debounced activity tracker ────────────────────────────────────────────
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleActivity = useCallback(() => {
    if (activityTimerRef.current) return;
    activityTimerRef.current = setTimeout(() => {
      activityTimerRef.current = null;
      updateActivity();
    }, 5_000);
  }, [updateActivity]);

  // Register global activity listeners when connected.
  useEffect(() => {
    if (!isConnected) return;
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, [isConnected, handleActivity]);

  // Check session expiry on page focus and on route change.
  useEffect(() => {
    if (!isConnected) return;
    const checkExpiry = () => {
      if (isSessionExpired()) {
        useWalletStore.getState().disconnect();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("kora:session-expired"));
        }
      }
    };
    checkExpiry();
    window.addEventListener("focus", checkExpiry);
    return () => window.removeEventListener("focus", checkExpiry);
  }, [isConnected, pathname, isSessionExpired]);

  // Clear the reconnect prompt state when the user fully disconnects.
  useEffect(() => {
    if (!isConnected) {
      setShowReconnectPrompt(false);
      setIsReconnecting(false);
      silentReconnectAttemptedRef.current = false;
    }
  }, [isConnected]);

  const connectWallet = useCallback(
    async (walletId: string = FREIGHTER_ID) => {
      const walletKit = getKit();
      walletKit.setWallet(walletId);

      const addr = await walletKit.getPublicKey();

      let bal = null;
      try {
        const raw = await getAccountBalances(addr);
        bal = {
          xlm: raw.xlm,
          usdc: raw.usdc,
          eurc: raw.otherAssets.find((a) => a.code === "EURC")?.balance ?? "0",
        };
      } catch {
        // Account may not be funded yet on testnet
      }

      let walletPassphrase: string | undefined;
      let walletNetwork: "testnet" | "mainnet" | "futurenet" = getConfiguredNetwork();
      try {
        const networkInfo = await (walletKit as any).getNetworkDetails?.();
        walletPassphrase = networkInfo?.networkPassphrase;
        const currentNetwork = (walletKit as any).network;
        if (currentNetwork === WalletNetwork.PUBLIC) {
          walletNetwork = "mainnet";
        } else if (currentNetwork === WalletNetwork.FUTURENET) {
          walletNetwork = "futurenet";
        } else {
          walletNetwork = "testnet";
        }
      } catch {
        // Some wallet implementations may not support getNetworkDetails
      }

      connect(walletId as WalletProvider, addr, addr, walletPassphrase);
      setNetwork(walletNetwork, walletPassphrase);
      if (bal) setBalance(bal);
      // Kit session is live immediately after a fresh connect.
      setKitSessionActive(true);
      setShowReconnectPrompt(false);
      try {
        const intended = useUIStore.getState().intendedDestination;
        if (intended) {
          useUIStore.getState().setIntendedDestination(null);
          router.push(intended);
        }
      } catch {
        // best-effort redirect
      }
    },
    [connect, setBalance, setKitSessionActive, setNetwork, router],
  );

  const disconnectWallet = useCallback(async () => {
    const walletAddress = address;
    kit = null;
    queryClient.clear();
    useInvoiceStore.setState({
      invoices: [],
      selectedInvoice: null,
      searchQuery: "",
      createDraft: { currency: "USDC" },
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem("kora-wallet");
    }
    disconnect();

    if (
      pathname?.startsWith("/dashboard") ||
      pathname === "/invoice/create" ||
      pathname?.startsWith("/invoice/create/")
    ) {
      router.push("/marketplace");
    }

    if (walletAddress) {
      await queryClient.invalidateQueries({
        predicate: (q) => JSON.stringify(q.queryKey).includes(walletAddress),
      });
    }
  }, [address, disconnect, pathname, queryClient, router]);

  /**
   * Signs an XDR transaction.  If the kit session is stale (kitSessionActive
   * is false), this method attempts a silent reconnect before signing.  If the
   * silent reconnect fails (extension locked), it surfaces the reconnect prompt
   * and throws `RECONNECT_REQUIRED` so the caller can gate the transaction.
   */
  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!isConnected) throw new Error("Wallet not connected");
      updateActivity();

      if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA || xdr.startsWith("mock_")) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return `${xdr}_signed`;
      }

      // If the kit session is stale, try to re-establish it transparently
      // before attempting to sign.
      const currentKitActive = useWalletStore.getState().kitSessionActive;
      if (!currentKitActive) {
        if (!provider) {
          setShowReconnectPrompt(true);
          throw new Error("RECONNECT_REQUIRED");
        }
        try {
          const recoveredKey = await silentReconnect(provider);
          if (recoveredKey !== address) {
            useWalletStore.getState().disconnect();
            throw new Error("Wallet account changed since last session");
          }
          setKitSessionActive(true);
          setShowReconnectPrompt(false);
        } catch (err: any) {
          if (err.message !== "Wallet account changed since last session") {
            setKitSessionActive(false);
            setShowReconnectPrompt(true);
          }
          throw new Error("RECONNECT_REQUIRED");
        }
      }

      const walletKit = getKit();
      const { result } = await walletKit.signTx({
        xdr,
        publicKeys: [address!],
        network: WALLET_NETWORK,
      });
      return result;
    },
    [isConnected, address, provider, setKitSessionActive, updateActivity],
  );

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const raw = await getAccountBalances(address);
      setBalance({
        xlm: raw.xlm,
        usdc: raw.usdc,
        eurc: raw.otherAssets.find((a) => a.code === "EURC")?.balance ?? "0",
      });
    } catch {
      // silently fail
    }
  }, [address, setBalance]);

  /**
   * One-click testnet USDC faucet for investor onboarding.
   * Gates on testnet only, mints via `buildTestnetUsdcMintTx`, then polls
   * until the Horizon USDC balance reflects the mint.
   */
  const mintTestnetUsdc = useCallback(
    async (amount: bigint = TESTNET_USDC_MINT_AMOUNT): Promise<number> => {
      if (!address) throw new Error("Wallet not connected");
      if (!isTestnetUsdcFaucetEnabled()) {
        throw new Error("USDC faucet is only available on testnet");
      }

      const previousBalance = balance?.usdc
        ? parseFloat(balance.usdc)
        : 0;

      // Ensure the account exists (Friendbot) before minting — ignore if already funded.
      try {
        const exists = await checkAccountExists(address);
        if (!exists) {
          await fundTestnetAccount(address);
        }
      } catch {
        // Best-effort; mint may still succeed if the account already exists.
      }

      if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
        const mockBalance = previousBalance + 10_000;
        setBalance({
          xlm: balance?.xlm ?? "10000",
          usdc: String(mockBalance),
          eurc: balance?.eurc ?? "0",
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.account.usdcBalance(address),
        });
        return mockBalance;
      }

      const usdcMintXdr = await buildTestnetUsdcMintTx(
        address,
        address,
        amount,
      );
      const signedUsdcMintXdr = await signTransaction(usdcMintXdr);
      const submit = await submitTransaction(signedUsdcMintXdr);
      if (submit.status === "ERROR") {
        throw new Error("USDC faucet transaction submission failed");
      }
      if (submit.hash) {
        await waitForTransaction(submit.hash);
      }

      const newBalance = await pollUsdcBalanceAfterMint(address, {
        previousBalance,
        minIncrease: 0,
      });

      setBalance({
        xlm: balance?.xlm ?? "0",
        usdc: String(newBalance),
        eurc: balance?.eurc ?? "0",
      });
      await refreshBalance();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.usdcBalance(address),
      });

      return newBalance;
    },
    [address, balance, queryClient, refreshBalance, setBalance, signTransaction],
  );

  const fundWalletOnTestnet = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");
    if (!isTestnetUsdcFaucetEnabled()) {
      throw new Error("Testnet funding is only available on testnet");
    }

    try {
      const exists = await checkAccountExists(address);
      if (!exists) {
        await fundTestnetAccount(address);
      }
    } catch {
      // Account may already be funded via Friendbot.
    }

    await mintTestnetUsdc();
  }, [address, mintTestnetUsdc]);

  const requestChallenge = useCallback(async (): Promise<string> => {
    try {
      const res = await fetch("/api/auth/challenge", { method: "POST" });
      if (!res.ok) throw new Error("Failed to request challenge");
      const data = await res.json();
      return data.challenge;
    } catch (error) {
      console.error("Error requesting challenge:", error);
      throw error;
    }
  }, []);

  const verifyOwnership = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address || !publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      const challenge = await requestChallenge();
      const walletKit = getKit();
      const { result: signature } = await (walletKit as any).signMessage({
        message: challenge,
        publicKey: publicKey,
      });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, signature, publicKey }),
      });

      if (!verifyRes.ok) throw new Error("Verification request failed");
      const verifyData = await verifyRes.json();

      if (verifyData.verified) {
        setVerified(true, verifyData.expiresAt);
        return true;
      } else {
        clearVerification();
        console.error("Verification failed:", verifyData.message);
        return false;
      }
    } catch (error) {
      console.error("Error during verification:", error);
      clearVerification();
      throw error;
    }
  }, [isConnected, address, publicKey, requestChallenge, setVerified, clearVerification]);

  const checkVerification = useCallback((): boolean => {
    if (!isConnected) return false;
    if (isVerificationExpired()) {
      clearVerification();
      return false;
    }
    return isVerified;
  }, [isConnected, isVerified, isVerificationExpired, clearVerification]);

  const refreshNetwork = useCallback(async () => {
    if (!isConnected || !provider) return;
    try {
      const walletKit = getKit();
      // Try to get network details
      let walletPassphrase: string | undefined;
      try {
        const networkInfo = await (walletKit as any).getNetworkDetails?.();
        walletPassphrase = networkInfo?.networkPassphrase;
      } catch {
        // ignore
      }
      // Map WalletNetwork to our WalletNetwork type
      const currentNetwork = (walletKit as any).network;
      let mappedNetwork: "testnet" | "mainnet" | "futurenet";
      if (currentNetwork === WalletNetwork.PUBLIC) {
        mappedNetwork = "mainnet";
      } else if (currentNetwork === WalletNetwork.FUTURENET) {
        mappedNetwork = "futurenet";
      } else {
        mappedNetwork = "testnet";
      }
      setNetwork(mappedNetwork, walletPassphrase);
    } catch {
      // ignore errors
    }
  }, [isConnected, provider, setNetwork]);

  const switchNetwork = useCallback(async () => {
    if (!isConnected || !provider) {
      throw new Error("Wallet not connected");
    }
    const walletKit = getKit();
    // Try to set network on the wallet kit
    try {
      await (walletKit as any).setNetwork?.(WALLET_NETWORK);
    } catch {
      // If setNetwork fails, just proceed to refresh
    }
    // Refresh the network state
    await refreshNetwork();
    // Also refresh balance to make sure we're on the right network
    await refreshBalance();
  }, [isConnected, provider, refreshNetwork, refreshBalance]);

  const requireVerification = useCallback(async (): Promise<void> => {
    if (!checkVerification()) {
      throw new Error("VERIFICATION_REQUIRED");
    }
  }, [checkVerification]);

  const verificationValid =
    isConnected && isVerified && !isVerificationExpired();

  return {
    address,
    publicKey,
    isConnected,
    provider,
    balance,
    isVerified: verificationValid,
    verifiedAt,
    /** Whether the in-memory kit session is established (null = reconnect pending). */
    kitSessionActive,
    /** Whether to show the "reconnect your wallet" prompt in the UI. */
    showReconnectPrompt,
    /** Whether a manual reconnect attempt is currently in progress. */
    isReconnecting,
    connectWallet,
    disconnectWallet,
    manualReconnect,
    fundWalletOnTestnet,
    mintTestnetUsdc,
    signTransaction,
    refreshBalance,
    refreshNetwork,
    switchNetwork,
    requestChallenge,
    verifyOwnership,
    checkVerification,
    requireVerification,
  };
}
