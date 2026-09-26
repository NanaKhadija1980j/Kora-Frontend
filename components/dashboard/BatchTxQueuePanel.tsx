"use client";

/**
 * BatchTxQueuePanel — Issue #730
 *
 * Displays the live state of a batch transaction queue alongside the
 * BatchActionToolbar. Each queued item (cancel/repay) shows its current
 * status — pending, processing, success, or failed — with accessible
 * live-region announcements.
 *
 * Integrates with the `createBatchTxQueue()` factory via a subscription
 * snapshot; the parent page owns the queue ref and passes snapshots down.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { BatchQueueItem, BatchQueueSnapshot, BatchItemStatus } from "@/lib/batch/txQueue";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchTxQueuePanelProps {
  /** Current snapshot from createBatchTxQueue().subscribe() */
  snapshot: BatchQueueSnapshot;
  /** Called when user clicks "Retry Failed" */
  onResumeFailed?: () => void;
  /** Called when user dismisses a fully completed (or all-failed) queue */
  onDismiss?: () => void;
  /** Additional class names for the panel root */
  className?: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusIcon(status: BatchItemStatus) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />;
    case "processing":
      return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" aria-hidden="true" />;
    case "skipped":
      return <Clock className="h-4 w-4 text-zinc-500 shrink-0" aria-hidden="true" />;
    default:
      // pending
      return <Clock className="h-4 w-4 text-zinc-500 shrink-0" aria-hidden="true" />;
  }
}

function statusLabel(status: BatchItemStatus): string {
  switch (status) {
    case "success":   return "Success";
    case "failed":    return "Failed";
    case "processing": return "Processing…";
    case "skipped":   return "Skipped";
    default:          return "Pending";
  }
}

function statusRowClass(status: BatchItemStatus): string {
  switch (status) {
    case "success":   return "bg-emerald-950/30 border-emerald-800/30";
    case "failed":    return "bg-destructive/5 border-destructive/20";
    case "processing": return "bg-primary/5 border-primary/20";
    default:          return "bg-zinc-900/40 border-zinc-800/40";
  }
}

function actionIcon(action: BatchQueueItem["action"]) {
  return action === "repay"
    ? <Banknote className="h-3 w-3 text-zinc-500 shrink-0" aria-hidden="true" />
    : <XCircle className="h-3 w-3 text-zinc-500 shrink-0" aria-hidden="true" />;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Batch transaction progress"
    >
      <motion.div
        className="absolute inset-y-0 left-0 bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BatchTxQueuePanel({
  snapshot,
  onResumeFailed,
  onDismiss,
  className,
}: BatchTxQueuePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { items, isRunning, processed, successCount, failedCount } = snapshot;
  const total = items.length;
  const percent = total > 0 ? (processed / total) * 100 : 0;

  // Accessible live-region: announce status changes
  const liveRef = useRef<HTMLDivElement>(null);
  const prevProcessed = useRef(processed);
  useEffect(() => {
    if (processed !== prevProcessed.current) {
      prevProcessed.current = processed;
    }
  }, [processed]);

  const isDone = !isRunning && total > 0 && processed === total;
  const hasFailures = failedCount > 0;
  const allSuccess = isDone && failedCount === 0;

  // Don't render when there's nothing to show
  if (total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-md overflow-hidden",
        className,
      )}
      data-testid="batch-tx-queue-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 min-w-0">
          {isRunning && (
            <Loader2
              className="h-4 w-4 text-primary animate-spin shrink-0"
              aria-hidden="true"
            />
          )}
          {isDone && allSuccess && (
            <CheckCircle2
              className="h-4 w-4 text-emerald-400 shrink-0"
              aria-hidden="true"
            />
          )}
          {isDone && hasFailures && (
            <XCircle
              className="h-4 w-4 text-destructive shrink-0"
              aria-hidden="true"
            />
          )}

          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">
              {isRunning
                ? "Processing Batch…"
                : isDone
                  ? allSuccess
                    ? "Batch Complete"
                    : `Batch Done — ${failedCount} failed`
                  : "Queued Batch Operations"}
            </p>
            <p className="text-xs text-zinc-500">
              {successCount} / {total} succeeded
              {hasFailures ? ` · ${failedCount} failed` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDone && hasFailures && onResumeFailed && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResumeFailed}
              className="h-7 gap-1 border-zinc-700 text-xs"
              data-testid="batch-panel-retry-btn"
            >
              <RotateCcw className="h-3 w-3" />
              Retry {failedCount} failed
            </Button>
          )}
          {isDone && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
              data-testid="batch-panel-dismiss-btn"
            >
              Dismiss
            </Button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center justify-center h-6 w-6 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
            aria-label={collapsed ? "Expand queue panel" : "Collapse queue panel"}
            data-testid="batch-panel-collapse-btn"
          >
            {collapsed
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar — always visible */}
      {(isRunning || isDone) && (
        <div className="px-4 pt-2 pb-1">
          <ProgressBar percent={percent} />
          {isRunning && (
            <p className="mt-1 text-[11px] text-zinc-600">
              {Math.round(percent)}% complete
            </p>
          )}
        </div>
      )}

      {/* Live status items — collapsible */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Accessible live region for screen-reader announcements */}
            <div
              ref={liveRef}
              role="status"
              aria-live="polite"
              aria-atomic="false"
              className="sr-only"
              data-testid="batch-panel-live-region"
            >
              {isRunning
                ? `Processing ${processed} of ${total} batch transactions`
                : isDone
                  ? `Batch complete: ${successCount} succeeded, ${failedCount} failed`
                  : `${total} batch operations queued`}
            </div>

            <ul
              className="max-h-52 overflow-y-auto divide-y divide-zinc-800/40 px-2 py-1"
              data-testid="batch-panel-item-list"
              aria-label="Batch transaction queue items"
            >
              {items.map((item) => (
                <li
                  key={`${item.action}-${item.id}`}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border my-0.5 px-3 py-2 text-xs transition-colors",
                    statusRowClass(item.status),
                  )}
                  data-testid={`batch-item-${item.id}`}
                  data-status={item.status}
                >
                  {/* Status icon */}
                  {statusIcon(item.status)}

                  {/* Label + action */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {actionIcon(item.action)}
                      <span className="font-mono text-zinc-300 truncate">{item.label}</span>
                    </div>
                    {item.error && (
                      <p
                        className="mt-0.5 text-[11px] text-destructive/90 line-clamp-2"
                        title={item.error}
                      >
                        {item.error}
                      </p>
                    )}
                    {item.txHash && (
                      <p className="mt-0.5 text-[11px] text-zinc-600 font-mono truncate">
                        {item.txHash.slice(0, 12)}…
                      </p>
                    )}
                  </div>

                  {/* Status label */}
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-medium capitalize",
                      item.status === "success" && "text-emerald-400",
                      item.status === "failed" && "text-destructive",
                      item.status === "processing" && "text-primary",
                      (item.status === "pending" || item.status === "skipped") && "text-zinc-500",
                    )}
                  >
                    {statusLabel(item.status)}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
