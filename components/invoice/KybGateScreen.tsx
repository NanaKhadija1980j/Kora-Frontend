"use client";

/**
 * KybGateScreen — Issue #489
 *
 * Interstitial screen rendered when the user tries to advance past step 2
 * (Financing Terms → Upload & Review) but their `kycStatus` is not `"verified"`.
 *
 * Status-specific messaging:
 *  - "none"     → Start Verification CTA → opens SynapsKycModal
 *  - "pending"  → In-review indicator + polling spinner
 *  - "rejected" → Re-verify CTA → reopens SynapsKycModal
 *
 * Once the status transitions to "verified" (either immediately or via the
 * `useKybStatusPoller` hook), `onVerified` is called and the wizard advances.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Shield, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SynapsKycModal } from "@/components/wallet/SynapsKycModal";
import { useWalletKycStatus } from "@/store/walletStore";
import { useKybStatusPoller } from "@/hooks/useKybStatusPoller";
import { cn } from "@/lib/utils";

interface KybGateScreenProps {
  /** Called when the user's kycStatus successfully transitions to "verified". */
  onVerified: () => void;
  /** Called when the user wants to go back to step 1. */
  onBack: () => void;
}

export function KybGateScreen({ onVerified, onBack }: KybGateScreenProps) {
  const kycStatus = useWalletKycStatus();
  const [modalOpen, setModalOpen] = useState(false);

  // Poll while pending so we auto-advance as soon as verification completes.
  useKybStatusPoller({
    enabled: kycStatus === "pending",
    onVerified,
  });

  // If status became "verified", trigger parent callback in an effect.
  useEffect(() => {
    if (kycStatus === "verified") {
      onVerified();
    }
  }, [kycStatus, onVerified]);

  if (kycStatus === "verified") {
    return null;
  }

  const isNone = kycStatus === "none";
  const isPending = kycStatus === "pending";
  const isRejected = kycStatus === "rejected";

  return (
    <>
      <motion.div
        key="kyb-gate"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 text-center backdrop-blur-md"
        data-testid="kyb-gate-screen"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-kora-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />

        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 120 }}
          className={cn(
            "mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border",
            isNone && "border-zinc-700 bg-zinc-900 text-zinc-400",
            isPending && "border-amber-500/30 bg-amber-500/10 text-amber-400",
            isRejected && "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {isPending ? (
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
          ) : isRejected ? (
            <ShieldAlert className="h-10 w-10" aria-hidden="true" />
          ) : (
            <Shield className="h-10 w-10" aria-hidden="true" />
          )}
        </motion.div>

        {/* Heading */}
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100">
          Business Verification Required
        </h2>

        {/* Status-specific subtitle */}
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 max-w-sm mx-auto">
          {isNone &&
            "To mint an invoice on Kora, your SME account must complete KYB verification. The process takes about 2 minutes."}
          {isPending &&
            "Your verification documents are under review. We'll automatically continue once approved — this page will refresh for you."}
          {isRejected &&
            "Your previous verification attempt was unsuccessful. Please re-submit with a clear, uncropped document."}
        </p>

        {/* Status badge */}
        {isPending && (
          <div
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-400"
            aria-live="polite"
            data-testid="kyb-pending-badge"
          >
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400" aria-hidden="true" />
            Checking verification status…
          </div>
        )}

        {/* Info card */}
        {!isPending && (
          <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 text-left space-y-2">
            <p className="text-xs font-semibold text-zinc-300">What you will need:</p>
            <ul className="space-y-1.5 text-xs text-zinc-500 list-disc list-inside">
              <li>Government-issued ID or business registration document</li>
              <li>Proof of business address</li>
              <li>Takes approximately 2 minutes</li>
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-1.5"
            data-testid="kyb-gate-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>

          {(isNone || isRejected) && (
            <Button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-kora-500 to-kora-600 hover:from-kora-600 hover:to-kora-700 text-white shadow-lg shadow-kora-500/15"
              data-testid="kyb-gate-cta"
            >
              {isRejected ? "Re-verify Business" : "Start Verification"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Compliance footnote */}
        <p className="mt-6 text-[11px] text-zinc-600 leading-relaxed max-w-xs mx-auto">
          Verification is powered by Synaps and required under global AML/KYB compliance standards.
        </p>
      </motion.div>

      <SynapsKycModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
