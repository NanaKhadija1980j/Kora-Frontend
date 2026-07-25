"use client";

import React from "react";
import { 
  XCircle, 
  Download, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BatchActionToolbarProps {
  selectedCount: number;
  onCancel: () => void;
  onExport: () => void;
  isProcessing?: boolean;
  progress?: number; // 0-100
  processingLabel?: string;
}

export function BatchActionToolbar({
  selectedCount,
  onCancel,
  onExport,
  isProcessing = false,
  progress = 0,
  processingLabel = "Processing batch operations...",
}: BatchActionToolbarProps) {
  if (selectedCount === 0 && !isProcessing) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-8 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl backdrop-blur-md">
          {/* Progress Bar background for processing state */}
          {isProcessing && (
            <div 
              className="absolute bottom-0 left-0 h-1 bg-primary/20 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  selectedCount
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isProcessing ? processingLabel : `${selectedCount} Invoices Selected`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isProcessing 
                    ? `${Math.round(progress)}% completed` 
                    : "Select actions to perform in bulk"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isProcessing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 border-border bg-background hover:bg-muted"
                    onClick={onExport}
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9 gap-2"
                    onClick={onCancel}
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Cancel Invoices</span>
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Processing...
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface BatchResultSummaryProps {
  total: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
  onClose: () => void;
}

export function BatchResultSummary({
  total,
  successCount,
  failedCount,
  errors,
  onClose,
}: BatchResultSummaryProps) {
  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-center gap-8 py-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-success">{successCount}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Success</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-destructive">{failedCount}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Failed</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Failure Details
          </p>
          <div className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-2 space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start justify-between gap-4 p-2 rounded hover:bg-muted/50 text-xs">
                <span className="font-mono text-muted-foreground shrink-0">{err.id}</span>
                <span className="text-destructive text-right">{err.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Batch operation completed. {successCount} invoices were successfully processed. 
          {failedCount > 0 && " Some operations failed and may require manual intervention."}
        </p>
      </div>

      <Button className="w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}
