"use client";

import { useState } from "react";
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
import { getAllowedTransitions, getBlockedReason } from "@/lib/invoiceStateMachine";
import type { Invoice } from "@/types";
import type { InvoiceStatus } from "@/types/invoice";
import type { StatusTransition } from "@/lib/invoiceStateMachine";

interface StatusTransitionButtonsProps {
  invoice: Invoice;
  walletAddress: string | null;
  onTransition: (invoice: Invoice, to: InvoiceStatus) => Promise<void>;
  isLoading: boolean;
}

interface ConfirmState {
  transition: StatusTransition;
  invoice: Invoice;
}

export function StatusTransitionButtons({
  invoice,
  walletAddress,
  onTransition,
  isLoading,
}: StatusTransitionButtonsProps) {
  const t = useTranslations("statusTransition");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const transitions = getAllowedTransitions(invoice.status);
  if (transitions.length === 0) return null;

  const isOwner = !!walletAddress && walletAddress === invoice.ownerAddress;

  return (
    <>
      <TooltipPrimitive.Provider delayDuration={200}>
        <div className="flex items-center gap-1.5">
          {transitions.map((tx) => {
            const blockedReason = getBlockedReason(invoice.status, tx.to, isOwner);
            const isBlocked = blockedReason !== null;

            return (
              <TooltipPrimitive.Root key={tx.to}>
                <TooltipPrimitive.Trigger asChild>
                  <span className={isBlocked ? "cursor-not-allowed" : undefined}>
                    <Button
                      size="sm"
                      variant={tx.variant}
                      disabled={isBlocked || isLoading}
                      onClick={() => setConfirm({ transition: tx, invoice })}
                      aria-label={tx.label}
                    >
                      {tx.label}
                    </Button>
                  </span>
                </TooltipPrimitive.Trigger>
                {isBlocked && (
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      sideOffset={6}
                      className="z-50 max-w-xs rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md"
                    >
                      {blockedReason}
                      <TooltipPrimitive.Arrow className="fill-popover" />
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                )}
              </TooltipPrimitive.Root>
            );
          })}
        </div>
      </TooltipPrimitive.Provider>

      <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        {confirm && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("confirmTitle", { label: confirm.transition.label })}</DialogTitle>
              <DialogDescription>{confirm.transition.description}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("confirmBody", {
                invoiceNumber: confirm.invoice.metadata.invoiceNumber,
                from: confirm.invoice.status.replace(/_/g, " "),
                to: confirm.transition.to.replace(/_/g, " "),
              })}
            </p>
            <p className="text-xs text-muted-foreground">{t("onChainWarning")}</p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirm(null)}
                disabled={isLoading}
              >
                {t("goBack")}
              </Button>
              <Button
                variant={confirm.transition.variant}
                className="flex-1"
                disabled={isLoading}
                onClick={async () => {
                  await onTransition(confirm.invoice, confirm.transition.to);
                  setConfirm(null);
                }}
              >
                {isLoading ? t("processing") : t("confirm")}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
