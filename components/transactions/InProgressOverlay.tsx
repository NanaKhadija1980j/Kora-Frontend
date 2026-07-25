"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

/**
 * InProgressOverlay
 * Full-screen dimmed modal overlay shown during wallet signing step
 * Features:
 * - Spinner with "Waiting for wallet signature..." message
 * - Cancel button to abort transaction
 * - Prevents interaction with page below
 * - Escape key handler (optional, can be disabled)
 */
export function InProgressOverlay() {
  const { txState, setTxState } = useUIStore();
  const isSigningStage = txState.status === "signing";

  const handleCancel = () => {
    setTxState({ status: "idle" });
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <AnimatePresence>
      {isSigningStage && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onKeyDown={handleEscape}
          role="dialog"
          aria-modal="true"
          aria-labelledby="signing-title"
          aria-describedby="signing-description"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative flex flex-col items-center justify-center gap-6 rounded-2xl bg-card border border-border p-8 shadow-2xl max-w-sm w-full mx-4"
          >
            {/* Spinner */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-transparent blur-lg" />
              <Loader2 className="h-12 w-12 text-primary relative z-10" />
            </motion.div>

            {/* Text */}
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 id="signing-title" className="text-lg font-semibold text-foreground">
                Waiting for Signature
              </h2>
              <p id="signing-description" className="text-sm text-muted-foreground max-w-xs">
                Complete the signature request in your wallet extension or app
              </p>
            </div>

            {/* Tips */}
            <div className="w-full rounded-lg bg-muted/50 border border-border/50 p-3 space-y-1.5">
              <p className="text-xs font-medium text-foreground">Tips:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Check your wallet extension or app window</li>
                <li>Review transaction details before approving</li>
                <li>Keep this window open during signing</li>
              </ul>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel transaction signing"
              className={cn(
                "w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                "border border-border/50 hover:border-border",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
