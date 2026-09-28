"use client";

/**
 * PendingTxQueuePanel — lists queued signed-XDR drafts and lets the user
 * retry or discard them individually.
 *
 * Drafts are signed XDR envelopes stored in IndexedDB by lib/xdrDraftQueue.ts.
 * They contain NO private keys — only the signed transaction envelope that can
 * be safely submitted to the RPC when the network returns.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Clock, RefreshCw, Trash2, WifiOff, CheckCircle2, AlertCircle, InboxIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  listQueuedXdrDrafts,
  removeQueuedXdrDraft,
  type QueuedXdrDraft,
} from "@/lib/xdrDraftQueue";
import { submitTransaction } from "@/lib/stellar/client";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";
import * as StellarSdk from "@stellar/stellar-sdk";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftStatus = "idle" | "retrying" | "success" | "error";

interface DraftState {
  draft: QueuedXdrDraft;
  status: DraftStatus;
  error?: string;
}

// ─── Per-draft submit helper ──────────────────────────────────────────────────

async function submitDraft(draft: QueuedXdrDraft): Promise<void> {
  if (draft.signedXdr.startsWith("mock_")) {
    // Dev / mock mode — simulate a short delay then succeed
    await new Promise<void>((r) => setTimeout(r, 800));
    return;
  }

  const tx = StellarSdk.TransactionBuilder.fromXDR(
    draft.signedXdr,
    env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
  );
  const result = await submitTransaction(draft.signedXdr);
  if (result.status === "ERROR") {
    throw new Error("Transaction submission failed");
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PendingTxQueuePanelProps {
  /** Expose a callback whenever the visible queue count changes (used for badges). */
  onCountChange?: (count: number) => void;
  /** Extra class names applied to the outer container. */
  className?: string;
}

export function PendingTxQueuePanel({
  onCountChange,
  className,
}: PendingTxQueuePanelProps) {
  const t = useTranslations("pendingQueue");
  const { isOnline } = useNetworkStatus();

  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep stable reference to the callback so the effect doesn't re-subscribe
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  // ── Load queue from IndexedDB ───────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const items = await listQueuedXdrDrafts();
      setDrafts((prev) => {
        // Preserve in-progress statuses across refreshes
        const prevById = new Map(prev.map((d) => [d.draft.id, d]));
        return items.map((draft) => prevById.get(draft.id) ?? { draft, status: "idle" });
      });
      onCountChangeRef.current?.(items.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Single-draft retry ──────────────────────────────────────────────────────

  const retryDraft = useCallback(
    async (id: string) => {
      setDrafts((prev) =>
        prev.map((d) => (d.draft.id === id ? { ...d, status: "retrying", error: undefined } : d))
      );

      const draftState = drafts.find((d) => d.draft.id === id);
      if (!draftState) return;

      try {
        await submitDraft(draftState.draft);
        // Mark success and remove from IndexedDB
        setDrafts((prev) => prev.map((d) => (d.draft.id === id ? { ...d, status: "success" } : d)));
        await removeQueuedXdrDraft(id);

        // Remove from list after a brief animation delay
        setTimeout(() => {
          setDrafts((prev) => {
            const next = prev.filter((d) => d.draft.id !== id);
            onCountChangeRef.current?.(next.length);
            return next;
          });
        }, 1200);

        toast.success(t("retrySuccess"));
      } catch (err) {
        const error = err instanceof Error ? err.message : t("retryFailed");
        setDrafts((prev) =>
          prev.map((d) => (d.draft.id === id ? { ...d, status: "error", error } : d))
        );
        toast.error(t("retryFailed"), { description: error });
      }
    },
    [drafts, t]
  );

  // ── Single-draft remove ─────────────────────────────────────────────────────

  const removeDraft = useCallback(
    async (id: string) => {
      await removeQueuedXdrDraft(id);
      setDrafts((prev) => {
        const next = prev.filter((d) => d.draft.id !== id);
        onCountChangeRef.current?.(next.length);
        return next;
      });
      toast.info(t("removed"));
    },
    [t]
  );

  // ── Retry all (only when online) ────────────────────────────────────────────

  const retryAll = useCallback(async () => {
    const idle = drafts.filter((d) => d.status === "idle" || d.status === "error");
    await Promise.allSettled(idle.map((d) => retryDraft(d.draft.id)));
  }, [drafts, retryDraft]);

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={cn("animate-pulse space-y-2", className)} aria-busy="true">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-zinc-800/60" />
        ))}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center",
          className
        )}
        data-testid="pending-queue-empty"
      >
        <InboxIcon className="h-8 w-8 text-zinc-600" aria-hidden="true" />
        <p className="text-sm text-zinc-400">{t("emptyState")}</p>
      </div>
    );
  }

  const retryableCount = drafts.filter(
    (d) => d.status === "idle" || d.status === "error"
  ).length;

  return (
    <div className={cn("space-y-3", className)} data-testid="pending-queue-panel">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {t("title", { count: drafts.length })}
        </p>

        {isOnline && retryableCount > 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={retryAll}
            className="h-6 gap-1 px-2 text-xs"
            data-testid="retry-all-button"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {t("retryAll")}
          </Button>
        )}
      </div>

      {/* Draft list */}
      <ul className="space-y-2" aria-label={t("listAriaLabel")}>
        {drafts.map(({ draft, status, error }) => (
          <li
            key={draft.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
              status === "success"
                ? "border-emerald-800/60 bg-emerald-950/30"
                : status === "error"
                  ? "border-red-800/60 bg-red-950/20"
                  : "border-zinc-800 bg-zinc-900/40"
            )}
            data-testid="queue-draft-item"
            data-draft-id={draft.id}
          >
            {/* Status icon */}
            <div className="mt-0.5 shrink-0">
              {status === "retrying" ? (
                <RefreshCw
                  className="h-4 w-4 animate-spin text-amber-400"
                  aria-label={t("statusRetrying")}
                />
              ) : status === "success" ? (
                <CheckCircle2
                  className="h-4 w-4 text-emerald-400"
                  aria-label={t("statusSuccess")}
                />
              ) : status === "error" ? (
                <AlertCircle
                  className="h-4 w-4 text-red-400"
                  aria-label={t("statusError")}
                />
              ) : (
                <Clock
                  className="h-4 w-4 text-zinc-500"
                  aria-label={t("statusPending")}
                />
              )}
            </div>

            {/* Body */}
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate font-medium text-zinc-200">
                {typeof draft.meta.type === "string"
                  ? t("txType", { type: draft.meta.type })
                  : t("unknownTx")}
              </p>

              {typeof draft.meta.invoiceId === "string" && (
                <p className="truncate text-xs text-zinc-500">
                  {t("invoiceLabel", { id: draft.meta.invoiceId })}
                </p>
              )}

              <p className="text-xs text-zinc-500">
                {t("queuedAt", {
                  time: formatDistanceToNow(draft.queuedAt, { addSuffix: true }),
                })}
                {draft.attempts > 0 && (
                  <span className="ml-1.5 text-zinc-600">
                    · {t("attempts", { count: draft.attempts })}
                  </span>
                )}
              </p>

              {error && status === "error" && (
                <p className="text-xs text-red-400">{error}</p>
              )}
            </div>

            {/* Actions */}
            {status !== "success" && (
              <div className="flex shrink-0 gap-1.5">
                {isOnline && (status === "idle" || status === "error") && (
                  <button
                    type="button"
                    onClick={() => void retryDraft(draft.id)}
                    className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    aria-label={t("retryAriaLabel")}
                    data-testid="retry-draft-button"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}

                {!isOnline && status === "idle" && (
                  <span
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-amber-500"
                    aria-label={t("offlineAriaLabel")}
                  >
                    <WifiOff className="h-3 w-3" aria-hidden="true" />
                    {t("waitingOnline")}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => void removeDraft(draft.id)}
                  disabled={status === "retrying"}
                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-40"
                  aria-label={t("removeAriaLabel")}
                  data-testid="remove-draft-button"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
