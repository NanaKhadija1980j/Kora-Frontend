"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Coins,
  FileText,
  Download,
  Trash2,
  X,
  Copy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTransactionHistoryStore } from "@/store/transactionHistoryStore";
import { StellarTxLink } from "@/components/ui/stellar-tx-link";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTransactionDetails } from "@/lib/stellar/client";
import type { TransactionRecord } from "@/store/transactionHistoryStore";
import { cn } from "@/lib/utils";

/**
 * TransactionHistoryDrawer
 * Slide-in panel (right side) showing recent transactions
 * Features:
 * - Lists last N transactions with status, hash, timestamp, type
 * - Status badges: pending (spinner), confirmed (checkmark), failed (error)
 * - Shows amount, asset code, description
 * - Export to CSV button
 * - Clear history button
 * - Click tx to view details (optional, shows full hash + copy button)
 */

interface TransactionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limit?: number;
}

const TX_TYPE_LABELS: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  mint_invoice: {
    label: "Mint Invoice",
    icon: <FileText className="h-3.5 w-3.5" />,
    color: "text-blue-500",
  },
  fund_invoice: {
    label: "Fund Invoice",
    icon: <Coins className="h-3.5 w-3.5" />,
    color: "text-green-500",
  },
  repay_invoice: {
    label: "Repay Invoice",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-purple-500",
  },
  claim_yield: {
    label: "Claim Yield",
    icon: <Coins className="h-3.5 w-3.5" />,
    color: "text-yellow-500",
  },
  transfer: {
    label: "Transfer",
    icon: <ChevronRight className="h-3.5 w-3.5" />,
    color: "text-indigo-500",
  },
  other: {
    label: "Transaction",
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-gray-500",
  },
};

function TransactionRow({
  tx,
  onSelect,
}: {
  tx: TransactionRecord;
  onSelect: (tx: TransactionRecord) => void;
}) {
  const typeConfig = TX_TYPE_LABELS[tx.type] || TX_TYPE_LABELS.other;
  const isConfirmed = tx.status === "confirmed";
  const isFailed = tx.status === "failed";
  const isPending = tx.status === "pending";

  const timeString = new Date(tx.timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(tx)}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ backgroundColor: "var(--color-muted-hover)" }}
      className="w-full text-left px-4 py-3 rounded-lg border border-border/50 hover:border-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className={cn("shrink-0 mt-0.5", typeConfig.color)}>
            {typeConfig.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">
                {typeConfig.label}
              </span>
              {isPending && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Clock className="h-3 w-3 text-primary flex-shrink-0" />
                </motion.div>
              )}
              {isConfirmed && (
                <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
              )}
              {isFailed && (
                <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
              )}
            </div>

            {/* Hash + Details */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StellarTxLink hash={tx.hash} chars={8} size="sm" />
              {tx.amount && (
                <>
                  <span>•</span>
                  <span>
                    {tx.amount} {tx.assetCode || ""}
                  </span>
                </>
              )}
              <span>•</span>
              <span>{timeString}</span>
            </div>

            {/* Description or Error */}
            {tx.description && (
              <p className="text-xs text-muted-foreground truncate">
                {tx.description}
              </p>
            )}
            {tx.error && (
              <p className="text-xs text-destructive truncate">{tx.error}</p>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </motion.button>
  );
}

function TransactionDetail({
  tx,
  onClose,
}: {
  tx: TransactionRecord;
  onClose: () => void;
}) {
  const typeConfig = TX_TYPE_LABELS[tx.type] || TX_TYPE_LABELS.other;
  const dateObj = new Date(tx.timestamp);

  // Only fetch details for confirmed transactions — cache forever (staleTime: Infinity)
  const { data: details, isLoading: loadingDetails } = useQuery({
    queryKey: ["tx-details", tx.hash],
    queryFn: () => fetchTransactionDetails(tx.hash),
    enabled: tx.status === "confirmed" && !tx.hash.startsWith("mock_"),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000, // keep in cache 24h
    retry: 1,
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="absolute inset-0 bg-background rounded-lg border border-border p-4 flex flex-col gap-4 overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Transaction Details</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close transaction details"
          className="rounded-md p-1 hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Type */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Type</p>
        <div className="flex items-center gap-2">
          <div className={cn("", typeConfig.color)}>{typeConfig.icon}</div>
          <span className="text-sm text-foreground">{typeConfig.label}</span>
        </div>
      </div>

      {/* Hash */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Transaction Hash
        </p>
        <div className="flex items-center gap-2 bg-muted/50 rounded px-2.5 py-1.5 border border-border/50">
          <span className="text-xs font-mono text-foreground flex-1 break-all">
            {tx.hash}
          </span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(tx.hash)}
            aria-label="Copy hash"
            className="shrink-0 rounded p-1 hover:bg-muted transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Status</p>
        <div className="flex items-center gap-2">
          {tx.status === "confirmed" && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          {tx.status === "failed" && (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          {tx.status === "pending" && (
            <Clock className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm text-foreground capitalize">
            {tx.status}
          </span>
        </div>
      </div>

      {/* Amount */}
      {tx.amount && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Amount</p>
          <p className="text-sm text-foreground font-medium">
            {tx.amount} {tx.assetCode}
          </p>
        </div>
      )}

      {/* Date */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Date & Time</p>
        <p className="text-sm text-foreground">{dateObj.toLocaleString()}</p>
      </div>

      {/* ── Enriched Horizon details ─────────────────────────────────────────── */}
      {tx.status === "confirmed" && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            On-chain Details
          </p>

          {loadingDetails ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : details ? (
            <div className="space-y-2 text-sm">
              <DetailRow label="Ledger" value={String(details.ledger)} />
              <DetailRow
                label="Fee Paid"
                value={`${details.feeXlm.toFixed(7)} XLM (${details.feePaid} stroops)`}
              />
              <DetailRow
                label="Confirmed At"
                value={new Date(details.createdAt).toLocaleString()}
              />
              <DetailRow
                label="Operations"
                value={String(details.operationCount)}
              />
              {details.memo && <DetailRow label="Memo" value={details.memo} />}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Details unavailable</p>
          )}
        </div>
      )}

      {/* Description */}
      {tx.description && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Description
          </p>
          <p className="text-sm text-foreground">{tx.description}</p>
        </div>
      )}

      {/* Error */}
      {tx.error && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Error</p>
          <p className="text-sm text-destructive bg-destructive/10 rounded px-2.5 py-1.5 border border-destructive/20">
            {tx.error}
          </p>
        </div>
      )}

      {/* Links */}
      <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-border/50">
        <a
          href={`https://stellar.expert/explorer/${process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "public" : "testnet"}/tx/${tx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
        >
          View on Explorer
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </motion.div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right break-all">{value}</span>
    </div>
  );
}

export function TransactionHistoryDrawer({
  open,
  onOpenChange,
  limit = 15,
}: TransactionHistoryDrawerProps) {
  const allTransactions = useTransactionHistoryStore((s) => s.transactions);
  const transactions = useMemo(
    () => allTransactions.slice(0, limit),
    [allTransactions, limit],
  );
  const clearHistory = useTransactionHistoryStore((s) => s.clearHistory);
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  const handleExport = () => {
    if (transactions.length === 0) return;

    const csv = [
      [
        "Hash",
        "Type",
        "Status",
        "Amount",
        "Asset",
        "Timestamp",
        "Description",
        "Error",
      ],
      ...transactions.map((tx) => [
        tx.hash,
        tx.type,
        tx.status,
        tx.amount || "",
        tx.assetCode || "",
        new Date(tx.timestamp).toISOString(),
        tx.description || "",
        tx.error || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kora-transactions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearHistory = () => {
    if (
      window.confirm("Clear all transaction history? This cannot be undone.")
    ) {
      clearHistory();
      setSelectedTx(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 bg-black/20"
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ opacity: 0, x: 384 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 384 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-background border-l border-border shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border/50">
              <h2
                id="drawer-title"
                className="text-lg font-semibold text-foreground"
              >
                Transactions
              </h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close transaction history"
                className="rounded-lg p-2 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {selectedTx ? (
                <TransactionDetail
                  tx={selectedTx}
                  onClose={() => setSelectedTx(null)}
                />
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No transactions yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transactions will appear here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <TransactionRow
                      key={tx.hash}
                      tx={tx}
                      onSelect={(selected) => setSelectedTx(selected)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {transactions.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={handleExport}
                  aria-label="Export transactions to CSV"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  aria-label="Clear transaction history"
                  className="flex items-center justify-center px-3 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
