import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletBalance, WalletNetwork, WalletProvider } from "@/types";
import { env } from "@/lib/env";
import { createPersistentJSONStorage } from "./storageAdapter";

const EMPTY_BALANCE: WalletBalance = {
  xlm: "0",
  usdc: "0",
  eurc: "0",
};

/** Session expires after 24 hours of inactivity. Change this constant to adjust. */
export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function getConfiguredNetwork(): WalletNetwork {
  return (env.NEXT_PUBLIC_STELLAR_NETWORK as WalletNetwork) || "testnet";
}

type WalletStoreState = {
  status: "disconnected" | "connecting" | "connected";
  address: string | null;
  publicKey: string | null;
  isConnected: boolean;
  provider: WalletProvider | null;
  network: WalletNetwork;
  balance: WalletBalance | null;
  isVerified: boolean;
  verifiedAt: number | null;
  lastActivityAt: number | null;
  addressBook: { id: string; address: string; label: string }[];
  walletPassphrase: string | null;
  /**
   * Tracks whether the in-memory StellarWalletsKit session is active.
   *
   * After a page refresh the kit singleton is destroyed and must call
   * getPublicKey() again before signing works.  This flag starts as `false`
   * on every page load; `useWallet` sets it to `true` once silent reconnect
   * succeeds, or `null` when the reconnect attempt is still pending.
   *
   * - `null`  → reconnect in-progress (show spinner / loading state)
   * - `false` → kit session absent (stale — show reconnect prompt)
   * - `true`  → kit session active (fully operational)
   */
  kitSessionActive: boolean | null;
};

type WalletStoreActions = {
  connect: (provider: WalletProvider, address: string, publicKey: string, walletPassphrase?: string) => void;
  disconnect: () => void;
  setBalance: (balance: WalletBalance) => void;
  setVerified: (isVerified: boolean, verifiedAt?: number) => void;
  clearVerification: () => void;
  isVerificationExpired: () => boolean;
  isWrongNetwork: () => boolean;
  hasPassphraseMismatch: () => boolean;
  updateActivity: () => void;
  isSessionExpired: () => boolean;
  /** Mark the in-memory kit session as active/inactive/pending. */
  setKitSessionActive: (active: boolean | null) => void;
  addAddressBookEntry: (address: string, label?: string) => void;
  updateAddressBookEntry: (id: string, updates: { address?: string; label?: string }) => void;
  removeAddressBookEntry: (id: string) => void;
  setNetwork: (network: WalletNetwork, walletPassphrase?: string) => void;
};

type WalletStore = WalletStoreState & WalletStoreActions;

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      status: "disconnected",
      address: null,
      publicKey: null,
      isConnected: false,
      provider: null,
      network: getConfiguredNetwork(),
      balance: null,
      isVerified: false,
      verifiedAt: null,
      lastActivityAt: null,
      addressBook: [],
      walletPassphrase: null,
      kitSessionActive: false,

      connect: (provider, address, publicKey, walletPassphrase) =>
        set({
          status: "connected",
          provider,
          address,
          publicKey,
          balance: EMPTY_BALANCE,
          isConnected: true,
          walletPassphrase: walletPassphrase || null,
          lastActivityAt: Date.now(),
          // Kit session is presumed active on fresh connect; caller may
          // override immediately if this is a silent re-establishment.
          kitSessionActive: true,
        }),

      disconnect: () =>
        set({
          status: "disconnected",
          address: null,
          publicKey: null,
          isConnected: false,
          provider: null,
          balance: null,
          isVerified: false,
          verifiedAt: null,
          lastActivityAt: null,
          walletPassphrase: null,
          kitSessionActive: false,
        }),

      setBalance: (balance) =>
        set((state) => (state.status === "connected" ? { balance } : {})),

      setVerified: (isVerified, verifiedAt) =>
        set({ isVerified, verifiedAt: verifiedAt || Date.now() }),

      clearVerification: () =>
        set({ isVerified: false, verifiedAt: null }),

      isVerificationExpired: () => {
        const state = get();
        if (!state.isVerified || !state.verifiedAt) return true;
        const EXPIRY_TIME = 60 * 60 * 1000; // 1 hour
        return Date.now() - state.verifiedAt > EXPIRY_TIME;
      },

      isWrongNetwork: () => {
        const state = get();
        const expectedNetwork = getConfiguredNetwork();
        return state.isConnected && state.network !== expectedNetwork;
      },

      hasPassphraseMismatch: () => {
        const state = get();
        if (!state.isConnected || !state.walletPassphrase) return false;
        return state.walletPassphrase !== env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
      },

      updateActivity: () =>
        set({ lastActivityAt: Date.now() }),

      isSessionExpired: () => {
        const state = get();
        if (!state.isConnected || !state.lastActivityAt) return false;
        return Date.now() - state.lastActivityAt > SESSION_EXPIRY_MS;
      },

      setKitSessionActive: (active) =>
        set({ kitSessionActive: active }),

      addAddressBookEntry: (address, label = "") =>
        set((s) => ({
          addressBook: [
            ...s.addressBook,
            { id: String(Date.now()) + Math.random().toString(36).slice(2, 8), address, label },
          ],
        })),

      updateAddressBookEntry: (id, updates) =>
        set((s) => ({
          addressBook: s.addressBook.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),

      removeAddressBookEntry: (id) =>
        set((s) => ({ addressBook: s.addressBook.filter((e) => e.id !== id) })),
        
      setNetwork: (network, walletPassphrase) =>
        set((s) => ({
          network,
          walletPassphrase: walletPassphrase ?? s.walletPassphrase,
        })),
    }),
    {
      name: "kora-wallet",
      storage: createPersistentJSONStorage(),
      partialize: (s) => ({
        address: s.address,
        publicKey: s.publicKey,
        provider: s.provider,
        network: s.network,
        isVerified: s.isVerified,
        verifiedAt: s.verifiedAt,
        lastActivityAt: s.lastActivityAt,
        addressBook: s.addressBook,
        walletPassphrase: s.walletPassphrase,
      }),
    }
  )
);

// ── Granular selector hooks ───────────────────────────────────────────────────
// Use these instead of subscribing to the full store. Each hook re-renders
// its consumer only when its specific slice changes, preventing unrelated
// store updates (e.g. balance polling) from cascading to the full Navbar.

export const useWalletIsConnected = () =>
  useWalletStore((s: WalletStore) => s.isConnected);

export const useWalletAddress = () =>
  useWalletStore((s: WalletStore) => s.address);

export const useWalletBalance = () =>
  useWalletStore((s: WalletStore) => s.balance);

export const useWalletNetwork = () =>
  useWalletStore((s: WalletStore) => s.network);
