"use client";

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice } from "@/types";

interface CancelInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancelInvoiceDialog({
  invoice,
  open,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: CancelInvoiceDialogProps) {
  const t = useTranslations("cancelDialog");

  if (!invoice) return null;

  const { metadata, terms, funding, status } = invoice;
  const isFunded = funding.totalRaised > 0;
  const canCancel =
    status === "pending_mint" ||
    status === "draft" ||
    (status === "listed" && funding.totalRaised === 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.debtor")}</p>
                <p className="font-semibold text-foreground">{metadata.debtorName}</p>
              </div>
              <Badge variant="outline">{status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.invoiceAmount")}</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(metadata.amount, metadata.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.financingAmount")}</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(terms.financingAmount, metadata.currency)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.dueDate")}</p>
                <p className="font-semibold text-foreground">
                  {formatDate(metadata.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.fundedAmount")}</p>
                <p
                  className={`font-semibold ${
                    isFunded ? "text-amber-400" : "text-foreground"
                  }`}
                >
                  {formatCurrency(funding.totalRaised, metadata.currency)}
                </p>
              </div>
            </div>
          </div>

          {isFunded && (
            <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 border border-amber-500/20 dark:text-amber-400">
              <p className="font-semibold mb-1">⚠ {t("partiallyFunded")}</p>
              <p>
                {t("partiallyFundedDesc", {
                  amount: formatCurrency(funding.totalRaised, metadata.currency),
                })}
              </p>
            </div>
          )}

          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
            <p className="font-semibold mb-1">⚠ {t("effectsTitle")}</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>{t("effects.markedOnChain")}</li>
              <li>{t("effects.removedMarketplace")}</li>
              <li>{t("effects.investorsNotified")}</li>
              <li>{t("effects.ipfsCleanup")}</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t("keepInvoice")}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={loading || isFunded || !canCancel}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("cancelling")}
              </>
            ) : (
              t("cancelInvoice")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
