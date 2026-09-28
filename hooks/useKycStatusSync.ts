"use client";

/**
 * useKycStatusSync — Issue #694.
 *
 * Bridges the Synaps webhook to the UI. `POST /api/webhooks/kyc` records a
 * status server-side; this polls `GET /api/webhooks/kyc` for the connected
 * wallet, writes any change into `walletStore`, and invalidates the
 * funding-gate queries that read it — so an investor who finishes verification
 * in the Synaps tab sees the wallet KYC tab flip without a hard refresh.
 *
 * Precedence rule: a server record only wins once it exists. The mock
 * `SynapsKycModal` writes straight to the store, and the endpoint answers
 * `"none"` for a wallet it has never seen — applying that blindly would walk a
 * locally-verified investor backwards on the first poll.
 */

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys, getInvalidationKeys } from "@/lib/queryKeys";
import { useWalletAddress, useWalletKycStatus, useWalletStore } from "@/store/walletStore";
import type { KycStatus } from "@/lib/kycWebhook";

/** Matches the KYC modal's own cadence; a webhook lands in seconds, not minutes. */
export const KYC_POLL_INTERVAL_MS = 4_000;

const VALID_STATUSES: readonly KycStatus[] = ["none", "pending", "verified", "rejected"];

function isKycStatus(value: unknown): value is KycStatus {
  return typeof value === "string" && (VALID_STATUSES as readonly string[]).includes(value);
}

export interface KycStatusSnapshot {
  kycStatus: KycStatus;
  updatedAt: number | null;
}

/** Read the webhook-recorded status for a wallet. */
export async function fetchKycStatus(address: string): Promise<KycStatusSnapshot> {
  const response = await fetch(
    `/api/webhooks/kyc?address=${encodeURIComponent(address)}`,
    { headers: { accept: "application/json" }, cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`KYC status request failed with ${response.status}`);
  }

  const body = await response.json();
  const status = body?.data?.kycStatus;

  return {
    kycStatus: isKycStatus(status) ? status : "none",
    updatedAt: typeof body?.data?.updatedAt === "number" ? body.data.updatedAt : null,
  };
}

interface UseKycStatusSyncOptions {
  /** Polling is active only while this is `true`. Defaults to `true`. */
  enabled?: boolean;
  /** Called once each time the status transitions to `"verified"`. */
  onVerified?: () => void;
  /** Called on every applied transition, including rejected and pending. */
  onStatusChange?: (status: KycStatus) => void;
}

export function useKycStatusSync({
  enabled = true,
  onVerified,
  onStatusChange,
}: UseKycStatusSyncOptions = {}) {
  const address = useWalletAddress();
  const kycStatus = useWalletKycStatus();
  const setKycStatus = useWalletStore((s) => s.setKycStatus);
  const queryClient = useQueryClient();

  // Keep callbacks fresh without making them re-trigger the effect.
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const active = enabled && Boolean(address);

  const query = useQuery({
    queryKey: address ? queryKeys.kyc.status(address) : queryKeys.kyc.all,
    queryFn: () => fetchKycStatus(address as string),
    enabled: active,
    // Stop hitting the endpoint once there is nothing left to wait for.
    refetchInterval: (q) =>
      q.state.data?.kycStatus === "verified" ? false : KYC_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 1,
  });

  const serverStatus = query.data?.kycStatus;

  useEffect(() => {
    if (!active || !address) return;
    // "none" means the webhook has said nothing yet — see the precedence note.
    if (!serverStatus || serverStatus === "none") return;
    if (serverStatus === kycStatus) return;

    setKycStatus(serverStatus);
    onStatusChangeRef.current?.(serverStatus);
    if (serverStatus === "verified") onVerifiedRef.current?.();

    // The funding gate keys off KYC, so every list and detail that renders it
    // has to re-evaluate — not just the status query itself.
    for (const key of getInvalidationKeys("kyc_status_changed", { address })) {
      queryClient.invalidateQueries({ queryKey: key as unknown[] });
    }
  }, [active, address, serverStatus, kycStatus, setKycStatus, queryClient]);

  return {
    kycStatus,
    serverStatus: serverStatus ?? null,
    isPolling: active && kycStatus !== "verified",
    isError: query.isError,
    refresh: query.refetch,
  };
}

export default useKycStatusSync;
