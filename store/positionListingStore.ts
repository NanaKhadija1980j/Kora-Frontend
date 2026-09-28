import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PositionListing } from "@/types";
import { createPersistentJSONStorage } from "./storageAdapter";

/** Extended listing metadata tracked client-side for seller analytics. */
export interface PositionListingMeta extends PositionListing {
  /** ISO 8601 — set when a listing is first created. Preserved on updates. */
  listedAt: string;
  /** ISO 8601 — the invoice's underlying repayment date (used for tenor calc). */
  repaymentDate?: string;
  /** The invoice token/id this position is tied to, for depth grouping. */
  invoiceTokenId?: string;
  /** Whether the on-chain owner has been confirmed to still hold this position. */
  ownershipConfirmed?: boolean;
  /** ISO 8601 — last time ownership was validated. */
  ownershipCheckedAt?: string;
}

interface PositionListingState {
  /** Keyed by position id (InvestorPosition.id / InvoicePosition.invoiceId). */
  listings: Record<string, PositionListingMeta>;
  listPosition: (listing: PositionListingMeta) => void;
  unlistPosition: (positionId: string) => void;
  getListing: (positionId: string) => PositionListingMeta | undefined;
  /**
   * Mark a listing as stale (ownership transferred away) and remove it.
   * Returns the removed listing so callers can surface a toast.
   */
  removeStale: (positionId: string) => PositionListingMeta | undefined;
  /**
   * Reconcile a set of position IDs that the current investor still holds.
   * Any persisted listing whose positionId is NOT in `ownedPositionIds` is
   * removed and returned as stale so the caller can notify the user.
   */
  reconcileListings: (ownedPositionIds: string[]) => PositionListingMeta[];
  /** Mark ownership as confirmed for a position id. */
  confirmOwnership: (positionId: string) => void;
  /**
   * Get all listings grouped by invoice token id.
   * Used for order-book depth rendering on invoice detail pages.
   */
  getListingsByInvoiceToken: (tokenId: string) => PositionListingMeta[];
}

export const usePositionListingStore = create<PositionListingState>()(
  persist(
    (set, get) => ({
      listings: {},

      listPosition: (listing) =>
        set((state) => {
          const existing = state.listings[listing.positionId];
          return {
            listings: {
              ...state.listings,
              [listing.positionId]: {
                ...listing,
                // Preserve original list time if re-listing at a new price.
                listedAt: existing?.listedAt ?? listing.listedAt,
                ownershipConfirmed: true,
                ownershipCheckedAt: new Date().toISOString(),
              },
            },
          };
        }),

      unlistPosition: (positionId) =>
        set((state) => {
          const next = { ...state.listings };
          delete next[positionId];
          return { listings: next };
        }),

      getListing: (positionId) => get().listings[positionId],

      removeStale: (positionId) => {
        const removed = get().listings[positionId];
        if (!removed) return undefined;
        set((state) => {
          const next = { ...state.listings };
          delete next[positionId];
          return { listings: next };
        });
        return removed;
      },

      reconcileListings: (ownedPositionIds) => {
        const ownedSet = new Set(ownedPositionIds);
        const stale: PositionListingMeta[] = [];
        const current = get().listings;

        Object.values(current).forEach((listing) => {
          if (!ownedSet.has(listing.positionId)) {
            stale.push(listing);
          }
        });

        if (stale.length > 0) {
          set((state) => {
            const next = { ...state.listings };
            stale.forEach((l) => delete next[l.positionId]);
            return { listings: next };
          });
        }

        return stale;
      },

      confirmOwnership: (positionId) =>
        set((state) => {
          const listing = state.listings[positionId];
          if (!listing) return state;
          return {
            listings: {
              ...state.listings,
              [positionId]: {
                ...listing,
                ownershipConfirmed: true,
                ownershipCheckedAt: new Date().toISOString(),
              },
            },
          };
        }),

      getListingsByInvoiceToken: (tokenId) => {
        const all = Object.values(get().listings);
        return all.filter((l) => l.invoiceTokenId === tokenId);
      },
    }),
    {
      name: "kora-position-listings",
      storage: createPersistentJSONStorage(),
    }
  )
);