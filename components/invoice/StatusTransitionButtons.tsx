"use client";

/**
 * StatusTransitionButtons — renders owner-only action buttons for valid invoice
 * status transitions and wires each button to the correct on-chain contract call.
 *
 * Routing logic (matches invoiceStateMachine contractMethod):
 *   "cancel"        → invoiceContract.cancelInvoice  (dedicated cancel endpoint)
 *   "repay"         → marketplaceContract.repayInvoice
 *   "update_status" → invoiceContract.updateStatus   (generic status bump)
 *
 * Guard order:
 *   1. Wallet not connected → all buttons disabled with tooltip
 *   2. Not the invoice owner → all buttons disabled with tooltip
 *   3. Transition not in state machine → button hidden (getAllowedTransitions)
 *
 * Destructive transitions (isDestructive=true) always open a confirmation dialog
 * before any on-chain call is fired. Non-destructive transitions confirm inline.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  getAllowedTransitions,
  getBlockedReason,
  STATUS_TO_CHAIN_INDEX,
} from "@/lib/invoiceStateMachine";
import { useTransaction } from "@/hooks/useTransaction";
import { useTxSimulation } from "@/hooks/useTxSimulation";
import { TxSimulationPreview } from "@/components/invoice/TxSimulationPreview";
import { queryKeys } from "@/lib/queryKeys";
import { CancelInvoiceDialog } from "@/components/invoice/CancelInvoiceDialog";
import type { Invoice, CancellationReason } from "@/types";
import type { InvoiceStatus } from "@/types/invoice";
import type { StatusTransition } from "@/lib/invoiceStateMachine";

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatusTransitionButtonsProps {
  invoice: Invoice;
  /** Connected wallet address — null means wallet not connected. */
  walletAddress: string | null;
  /**
   * Optional callback fired after a transition is confirmed on-chain.
   * Receives the invoice and the new status so parents can refresh local state.
   */
  onSuccess?: (invoice: Invoice, newStatus: InvoiceStatus) => void;
  /** Legacy prop kept for backwards compat — prefer onSuccess. */
  onTransition?: (invoice: Invoice, to: InvoiceStatus) => Promise<void>;
  /** Set to true while a parent-managed async op is running. */
  isLoading?: boolean;
}

// ─── Inline confirm state (non-destructive transitions) ───────────────────────

interface InlineConfirm {
  transition: StatusTransition;
  invoice: Invoice;
}

// ─── Contract method map ──────────────────────────────────────────────────────

/**
 * Exhaustive map from a transition's contractMethod to the on-chain call it
 * dispatches. Typing this against `StatusTransition["contractMethod"]` means a
 * new contract method added to the state machine fails type-check here until a
 * handler is provided — no `as any` escape hatch required.
 */
type ContractMethod = StatusTransition["contractMethod"];

type ContractCall = (
  tokenId: string,
  walletAddress: string,
  transition: StatusTransition
) => Promise<unknown>;

const CONTRACT_METHOD_HANDLERS: Record<ContractMethod, ContractCall> = {
  cancel: async (tokenId, walletAddress) => {
    const { invoiceContract } = await import("@/lib/stellar/contracts");
    return invoiceContract.cancelInvoice(BigInt(tokenId), walletAddress);
  },
  repay: async (tokenId, walletAddress) => {
    const { marketplaceContract } = await import("@/lib/stellar/contracts");
    return marketplaceContract.repayInvoice({ tokenId: BigInt(tokenId) }, walletAddress);
  },
  update_status: async (tokenId, walletAddress, transition) => {
    const chainIndex = STATUS_TO_CHAIN_INDEX[transition.to];
    if (chainIndex < 0) {
      throw new Error(`Status "${transition.to}" has no on-chain representation.`);
    }
    const { invoiceContract } = await import("@/lib/stellar/contracts");
    return invoiceContract.updateStatus(BigInt(tokenId), chainIndex, walletAddress);
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusTransitionButtons({
  invoice,
  walletAddress,
  onSuccess,
  onTransition,
  isLoading: externalLoading = false,
}: StatusTransitionButtonsProps) {
  const t = useTranslations("statusTransition");
  const queryClient = useQueryClient();
  const { execute, status: txStatus } = useTransaction();
  const { simulationDialogProps, onSimulationPreview } = useTxSimulation();

  // Inline confirm dialog (non-destructive, e.g. "Mark as Funded")
  const [inlineConfirm, setInlineConfirm] = useState<InlineConfirm | null>(null);
  // Dedicated cancel dialog (destructive)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>();

  const isTxPending =
    txStatus === "signing" || txStatus === "submitting" || txStatus === "polling";
  const isDisabled = externalLoading || isTxPending;

  const isConnected = walletAddress !== null && walletAddress !== "";
  const isOwner = isConnected && walletAddress === invoice.ownerAddress;

  const transitions = getAllowedTransitions(invoice.status);
  if (transitions.length === 0) return null;

  // ── Core on-chain dispatcher ─────────────────────────────────────────────

  async function fireTransition(
    transition: StatusTransition,
    cancelReason?: CancellationReason,
    cancelNotes?: string
  ) {
    if (!walletAddress) return;

    if (onTransition) {
      await onTransition(invoice, transition.to);
      return;
    }

    const tokenId = invoice.tokenId;

    await execute(
      async () => {
        // Exhaustive dispatch: every contractMethod has a typed handler.
        const handler = CONTRACT_METHOD_HANDLERS[transition.contractMethod];
        return handler(tokenId, walletAddress, transition);
      },
      {
        successMessage: `Invoice ${transition.to.replace(/_/g, " ")} successfully`,
        onSimulationPreview,
        txType: transition.contractMethod === "cancel" ? "cancel_invoice" : undefined,
        cancelReason: cancelReason,
        cancelNotes: cancelNotes,
        onSuccess: () => {
          // Invalidate relevant TanStack Query caches so the UI refreshes
          queryClient.invalidateQueries({
            queryKey: queryKeys.invoices.byOwner(invoice.ownerAddress),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.invoices.detail(invoice.id),
          });
          onSuccess?.(invoice, transition.to);
        },
      }
    );
  }

  // ── Button click handler ─────────────────────────────────────────────────

  function handleClick(transition: StatusTransition) {
    if (transition.contractMethod === "cancel") {
      setCancelError(undefined);
      setCancelDialogOpen(true);
    } else {
      // Non-destructive: show inline confirm dialog
      setInlineConfirm({ transition, invoice });
    }
  }

  // ── Cancel dialog confirm ────────────────────────────────────────────────

  async function handleCancelConfirm(reason: CancellationReason, notes?: string) {
    const cancelTransition = transitions.find((t) => t.contractMethod === "cancel");
    if (!cancelTransition) return;
    setCancelError(undefined);
    try {
      await fireTransition(cancelTransition, reason, notes);
      setCancelDialogOpen(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Cancellation failed. Please try again.");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <TooltipPrimitive.Provider delayDuration={200}>
        <div className="flex items-center gap-1.5">
          {transitions.map((tx) => {
            const blockedReason = getBlockedReason(
              invoice.status,
              tx.to,
              isOwner,
              isConnected
            );
            const isBlocked = blockedReason !== null;

            return (
              <TooltipPrimitive.Root key={tx.to}>
                <TooltipPrimitive.Trigger asChild>
                  <span className={isBlocked ? "cursor-not-allowed" : undefined}>
                    <Button
                      size="sm"
                      variant={tx.variant}
                      disabled={isBlocked || isDisabled}
                      onClick={() => handleClick(tx)}
                      aria-label={tx.label}
                      data-testid={`status-btn-${tx.to}`}
                    >
                      {tx.label}
                    </Button>
                  </span>
                </TooltipPrimitive.Trigger>
                {isBlocked && (
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      side="top"
                      className="z-50 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
                    >
                      {blockedReason}
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                )}
              </TooltipPrimitive.Root>
            );
          })}
        </div>
      </TooltipPrimitive.Provider>

      {/* Non-destructive inline confirm */}
      <Dialog
        open={inlineConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setInlineConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inlineConfirm?.transition.label}</DialogTitle>
            <DialogDescription>
              {t("confirmDescription", { status: inlineConfirm?.transition.to ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInlineConfirm(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={isDisabled}
              onClick={async () => {
                const pending = inlineConfirm;
                if (!pending) return;
                setInlineConfirm(null);
                await fireTransition(pending.transition);
              }}
            >
              {t("confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Destructive cancel dialog */}
      <CancelInvoiceDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelConfirm}
        error={cancelError}
      />

      <TxSimulationPreview {...simulationDialogProps} />
    </>
  );
}
