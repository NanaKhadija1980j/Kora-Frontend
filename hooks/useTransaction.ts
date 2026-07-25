"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "./useToast";
import type { NotificationPreferenceType } from "./useToast";
import { useWallet } from "./useWallet";
import { useNetworkValidation } from "./useNetworkValidation";
import { rpc, submitTransaction, BadSequenceError, sequenceManager } from "@/lib/stellar/client";
import { env } from "@/lib/env";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useUIStore } from "@/store/uiStore";
import { useTransactionHistoryStore } from "@/store/transactionHistoryStore";
import type { ServiceError } from "@/types";

export type TxLifecycleStatus =
  | "idle"
  | "building"
  | "simulating"
  | "signing"
  | "submitting"
  | "retrying"
  | "polling"
  | "confirmed"
  | "failed";

async function buildAndSign(
  buildFn: () => Promise<string>,
  signTransaction: (xdr: string) => Promise<string>,
  setStage: (stage: TxLifecycleStatus) => void
): Promise<string> {
  setStage("building");
  const unsignedXdr = await buildFn();
  setStage("signing");
  return signTransaction(unsignedXdr);
}

interface TxState {
  status: TxLifecycleStatus;
  txHash?: string;
  error?: string;
}

/** Parsed simulation result exposed to the preview dialog. */
export interface SimulationPreview {
  /** Fee in stroops (1 XLM = 10_000_000 stroops) */
  feeStroops: number;
  /** Fee in XLM */
  feeXlm: number;
  /** Resource fee in stroops */
  resourceFee: number;
  /** CPU instructions consumed */
  cpuInstructions: number;
  /** Memory bytes consumed */
  memoryBytes: number;
  /** Read bytes */
  readBytes: number;
  /** Write bytes */
  writeBytes: number;
  /** Human-readable error if simulation failed */
  error?: string;
}

const TOAST_ID = "kora-tx";
const MAX_POLL_ATTEMPTS = 30;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const SIMULATION_TIMEOUT_MS = 10_000;

async function pollWithBackoff(hash: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (Date.now() > deadline) throw new Error("Transaction timed out after 5 minutes");

    const result = await rpc.getTransaction(hash);
    if (result.status === "SUCCESS") return hash;
    if (result.status === "FAILED") throw new Error("Transaction failed on-chain");

    const delay = Math.min(1000 * 2 ** attempt, 16_000);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error(`Transaction not confirmed after ${MAX_POLL_ATTEMPTS} attempts`);
}

/**
 * Parse a successful simulation result into a SimulationPreview.
 */
function parseSimulationPreview(
  sim: StellarSdk.rpc.Api.SimulateTransactionSuccessResponse
): SimulationPreview {
  const feeStroops = parseInt(sim.minResourceFee ?? "0", 10);
  const feeXlm = feeStroops / 10_000_000;

  const resources = (sim as any).transactionData?.resources?.() ?? null;

  let cpuInstructions = 0;
  let memoryBytes = 0;
  let readBytes = 0;
  let writeBytes = 0;

  try {
    if (resources) {
      cpuInstructions = resources.instructions?.() ?? 0;
      memoryBytes = resources.readBytes?.() ?? 0; // Soroban SDK naming varies
      readBytes = resources.readBytes?.() ?? 0;
      writeBytes = resources.writeBytes?.() ?? 0;
    }
    // Fallback: try sorobanData path
    const sorobanData = (sim as any).sorobanData;
    if (sorobanData) {
      const r = sorobanData.resources();
      cpuInstructions = Number(r.instructions());
      readBytes = Number(r.readBytes());
      writeBytes = Number(r.writeBytes());
    }
  } catch {
    // Resource parsing is best-effort; leave zeros if unavailable
  }

  return { feeStroops, feeXlm, resourceFee: feeStroops, cpuInstructions, memoryBytes, readBytes, writeBytes };
}

export function useTransaction() {
  const [state, setState] = useState<TxState>({ status: "idle" });
  const [simulationPreview, setSimulationPreview] = useState<SimulationPreview | null>(null);
  const { signTransaction, publicKey } = useWallet();
  const { isNetworkMismatch, errorMessage } = useNetworkValidation();
  const toast = useToast();
  const t = useTranslations("transaction");
  const setTxState = useUIStore((s) => s.setTxState);
  const addTransaction = useTransactionHistoryStore((s) => s.addTransaction);
  const updateTransactionStatus = useTransactionHistoryStore((s) => s.updateTransactionStatus);

  const setStage = useCallback(
    (status: TxLifecycleStatus, extra?: Partial<TxState>) => {
      setState((s) => ({ ...s, status, ...extra }));
      if (status === "retrying") {
        setTxState({ status: "submitting" });
      } else {
        setTxState({ status } as any);
      }
      // Show loading toast for in-progress stages
      const inProgress: TxLifecycleStatus[] = ["building", "simulating", "signing", "submitting", "polling"];
      if (inProgress.includes(status)) {
        const labels: Record<string, string> = {
          building: t("building"),
          simulating: t("simulating"),
          signing: t("signing"),
          submitting: t("submitting"),
          polling: t("polling"),
        };
        toast.loading(labels[status] ?? status, TOAST_ID, "txConfirmed");
      }
    },
    [t, toast, setTxState]
  );

  const execute = useCallback(
    async (
      buildFn: () => Promise<string>,
      options?: {
        onSuccess?: (hash: string) => void;
        successMessage?: string;
        successNotificationType?: NotificationPreferenceType;
        onError?: (err: unknown) => void;
        /** Called with the simulation preview; must resolve true to proceed */
        onSimulationPreview?: (preview: SimulationPreview) => Promise<boolean>;
        txType?: string;
        txDescription?: string;
        txAmount?: string;
        txAssetCode?: string;
      }
    ): Promise<string | null> => {
      try {
        // Check network first
        if (isNetworkMismatch) {
          throw new Error(errorMessage);
        }
        
        // 1. Build
        setStage("building");
        const unsignedXdr = await buildFn();

        // 2. Simulate (skip for mock XDRs)
        if (!unsignedXdr.startsWith("mock_")) {
          setStage("simulating");

          const tx = StellarSdk.TransactionBuilder.fromXDR(
            unsignedXdr,
            env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
          );

          // Race simulation against a 10-second timeout
          const simPromise = rpc.simulateTransaction(tx);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Simulation timed out after 10 seconds. Please try again.")),
              SIMULATION_TIMEOUT_MS
            )
          );

          const sim = await Promise.race([simPromise, timeoutPromise]);

          if (StellarSdk.rpc.Api.isSimulationError(sim)) {
            const preview: SimulationPreview = {
              feeStroops: 0,
              feeXlm: 0,
              resourceFee: 0,
              cpuInstructions: 0,
              memoryBytes: 0,
              readBytes: 0,
              writeBytes: 0,
              error: sim.error,
            };
            setSimulationPreview(preview);

            // If caller wants to show the preview dialog, let them handle the error
            if (options?.onSimulationPreview) {
              await options.onSimulationPreview(preview);
            }
            throw new Error(`Simulation failed: ${sim.error}`);
          }

          // Parse successful simulation
          const preview = parseSimulationPreview(
            sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse
          );
          setSimulationPreview(preview);

          // If caller provided a preview handler, wait for user confirmation
          if (options?.onSimulationPreview) {
            const proceed = await options.onSimulationPreview(preview);
            if (!proceed) {
              setState({ status: "idle" });
              toast.dismiss(TOAST_ID);
              return null;
            }
          }
        }

        // 3. Sign
        setStage("signing");
        let signedXdr: string;
        if (unsignedXdr.startsWith("mock_")) {
          signedXdr = unsignedXdr;
        } else {
          signedXdr = await signTransaction(unsignedXdr);
        }

        // 4. Submit
        setStage("submitting");
        let hash: string;

        if (signedXdr.startsWith("mock_")) {
          await new Promise((r) => setTimeout(r, 800));
          hash = Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join("");
        } else {
          const result = await submitTransaction(signedXdr);
          if (result.status === "ERROR") throw new Error("Transaction submission failed");
          hash = result.hash;
        }

        // Add to history as pending
        addTransaction({
          hash,
          type: (options?.txType as any) || "other",
          status: "pending",
          description: options?.txDescription,
          amount: options?.txAmount,
          assetCode: options?.txAssetCode,
        });

        // 5. Poll
        setStage("polling", { txHash: hash });
        if (!signedXdr.startsWith("mock_")) {
          await pollWithBackoff(hash);
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }

        // ── Phase 5: done ──────────────────────────────────────────────────
        setState({ status: "confirmed", txHash: hash });
        setTxState({ status: "confirmed", txHash: hash });
        updateTransactionStatus(hash, "confirmed");
        toast.success(
          options?.successMessage ?? t("confirmed"),
          hash,
          TOAST_ID,
          options?.successNotificationType ?? "txConfirmed"
        );

        options?.onSuccess?.(hash);
        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : t("failed");
        setState({ status: "failed", error: message });
        setTxState({ status: "failed", error: { code: "TRANSACTION_FAILED", message } });
        
        // Update history if we have a hash
        if (state.txHash) {
          updateTransactionStatus(state.txHash, "failed", message);
        }
        
        toast.error(
          t("failed"),
          message,
          () => setState({ status: "idle" }),
          TOAST_ID,
          "txConfirmed"
        );
        options?.onError?.(err);
        return null;
      }
    },
    [signTransaction, setStage, setTxState, addTransaction, updateTransactionStatus, t, toast, state.txHash, isNetworkMismatch, errorMessage]
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
    setSimulationPreview(null);
    setTxState({ status: "idle" });
  }, [setTxState]);

  return {
    execute,
    reset,
    status: state.status,
    txHash: state.txHash,
    error: state.error,
    simulationPreview,
  };
}
