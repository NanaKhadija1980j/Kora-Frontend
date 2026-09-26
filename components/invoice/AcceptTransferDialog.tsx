"use client";

import { useEffect } from "react";
import { AlertCircle, ArrowRight, Clock, Handshake, User } from "lucide-react";
import { cn, RISK_TIER_COLORS } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { TxLifecycleStatus } from "@/hooks/useTransaction";
import type { Invoice } from "@/types/invoice";

interface AcceptTransferDialogProps {
  item: {
    positionId: string;
    invoice: Invoice;
    expectedReturn: number;
    sellerAddress: string;
    remainingTenor: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Current lifecycle status of the accept-transfer transaction, if any. */
  status?: TxLifecycleStatus;
  /** Error surfaced by the flow (e.g. the NOT_IMPLEMENTED buyer-acceptance stub). */
  error?: string;
}

const PENDING_STATUSES: TxLifecycleStatus[] = [
  "building",
  "simulating",
  "signing",
  "submitting",
  "retrying",
  "polling",
];

export function AcceptTransferDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
  status,
  error,
}: AcceptTransferDialogProps) {
  const t = useTranslations("secondaryMarket.acceptDialog");

  // Close automatically once the transfer confirms on-chain — kept open on
  // failure so the inline NOT_IMPLEMENTED banner below stays visible.
  useEffect(() => {
    if (open && status === "confirmed") onOpenChange(false);
  }, [open, status, onOpenChange]);

  if (!item) return null;

  const currency = item.invoice?.metadata?.currency ?? "USDC";
  const isPending = status !== undefined && PENDING_STATUSES.includes(status);
  const isFailed = status === "failed" && Boolean(error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" aria-hidden />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Position Summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("positionLabel")}
                </p>
                <p
                  className="font-mono text-sm font-medium text-white"
                  data-testid="accept-transfer-invoice-number"
                >
                  {item.invoice?.metadata?.invoiceNumber ?? `Invoice ${item.positionId}`}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase",
                  RISK_TIER_COLORS[item.invoice?.riskTier] ?? "text-zinc-400 border-zinc-700"
                )}
              >
                {item.invoice?.riskTier}
              </Badge>
            </div>
            <div className="mt-3 text-xs">
              <span className="text-zinc-400 block text-[10px] uppercase tracking-wider">
                {t("expectedReturn")}
              </span>
              <span className="font-semibold text-white text-sm">
                {currency} {item.expectedReturn}
              </span>
            </div>
          </div>

          {/* Position Details */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {t("positionDetails")}
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary/80" />
                  {t("remainingTenor")}
                </span>
                <span className="font-medium text-white">{item.remainingTenor} days remaining</span>
              </div>

              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                  {t("fromAddress")}
                </span>
                <span className="font-mono text-[11px] text-zinc-300">
                  {item.sellerAddress.slice(0, 4)}...{item.sellerAddress.slice(-4)}
                </span>
              </div>
            </div>
          </div>

          {/* Graceful, actionable NOT_IMPLEMENTED / failure copy — no alert() */}
          {isFailed && (
            <div
              className="rounded-lg border border-warning/30 bg-warning/5 p-3"
              data-testid="accept-transfer-error-banner"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider">
                    {t("notImplementedTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("notImplementedHint")}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="accept-transfer-cancel">
            {t("cancel")}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
            }}
            disabled={isPending}
            data-testid="accept-transfer-confirm"
          >
            {isPending ? t("pending") : t("confirmAccept")}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
