"use client";

import React from "react";
import { Download, FileText, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  Drawer,
  DrawerContent,
  DrawerSection,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { daysUntil, cn } from "@/lib/utils";
import { useFormatters } from "@/hooks/useFormatters";
import CountdownTimer from "@/components/ui/CountdownTimer";
import { RepaymentTimeline } from "@/components/invoice/RepaymentTimeline";
import type { InvoicePosition, InvestorPosition, Invoice } from "@/types";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

type PositionLike = InvoicePosition | InvestorPosition;

interface PositionDetailDrawerProps {
  position: PositionLike | null;
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
}

/**
 * PositionDetailDrawer shows full position details including yield accrual timeline.
 */
export function PositionDetailDrawer({
  position,
  invoice,
  open,
  onOpenChange,
  loading = false,
}: PositionDetailDrawerProps) {
  const { formatCurrency, formatDate, formatPercentage } = useFormatters();

  if (!position || !invoice) {
    return (
      <Drawer
        open={open && loading}
        onOpenChange={onOpenChange}
        title="Position Details"
        size="lg"
      >
        <DrawerContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  const daysRemaining = daysUntil(invoice.terms.repaymentDate);
  const roi = position.investedAmount > 0 
    ? ((position.expectedReturn / position.investedAmount) * 100)
    : 0;
  const roiStr = formatPercentage(roi, 2);

  const handleExportPDF = () => {
    const invoiceAmountStr = formatCurrency(invoice.metadata.amount, invoice.metadata.currency);
    const investedStr = formatCurrency(position.investedAmount, invoice.metadata.currency);
    const expectedStr = formatCurrency(position.expectedReturn, invoice.metadata.currency);
    // Use window.print() for PDF export
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      // Sever the opener link (noopener semantics) before writing content.
      printWindow.opener = null;
      printWindow.document.write(`
        <html>
          <head>
            <title>Position Details - ${escapeHtml(invoice.metadata.invoiceNumber)}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; margin-bottom: 20px; }
              .section { margin-bottom: 30px; }
              .section-title { font-weight: bold; font-size: 14px; color: #555; margin-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f0f0f0; }
            </style>
          </head>
          <body>
            <h1>Position Details Report</h1>
            <div class="section">
              <div class="section-title">Invoice Information</div>
              <table>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
                <tr>
                  <td>Invoice Number</td>
                  <td>${escapeHtml(invoice.metadata.invoiceNumber)}</td>
                </tr>
                <tr>
                  <td>Debtor</td>
                  <td>${escapeHtml(invoice.metadata.debtorName)}</td>
                </tr>
                <tr>
                  <td>Invoice Amount</td>
                  <td>${escapeHtml(invoiceAmountStr)}</td>
                </tr>
              </table>
            </div>
            <div class="section">
              <div class="section-title">Position Details</div>
              <table>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
                <tr>
                  <td>Invested Amount</td>
                  <td>${escapeHtml(investedStr)}</td>
                </tr>
                <tr>
                  <td>Expected Return</td>
                  <td>${escapeHtml(expectedStr)}</td>
                </tr>
                <tr>
                  <td>ROI</td>
                  <td>${escapeHtml(roiStr)}</td>
                </tr>
                <tr>
                  <td>Status</td>
                  <td>${escapeHtml(position.status)}</td>
                </tr>
              </table>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Position Details"
      size="lg"
    >
      <DrawerContent>
        {/* Key Metrics */}
        <DrawerSection title="Investment Summary" description="Your position details">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invested Amount
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {formatCurrency(position.investedAmount, invoice.metadata.currency)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Expected Return
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-400">
                {formatCurrency(position.expectedReturn, invoice.metadata.currency)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ROI
              </p>
              <p className="mt-1 text-lg font-bold text-primary">
                {roiStr}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </p>
              <p className="mt-1">
                <Badge
                  variant={
                    position.status === "active"
                      ? "info"
                      : position.status === "repaid"
                      ? "success"
                      : "danger"
                  }
                >
                  {position.status}
                </Badge>
              </p>
            </div>
          </div>
        </DrawerSection>

        {/* Dates */}
        <DrawerSection title="Key Dates" description="Investment and maturity timeline">
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Investment Date
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatDate(position.investedAt)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Maturity Date
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatDate(invoice.terms.repaymentDate)}
              </p>
              {daysRemaining > 0 && (
                <p className="mt-1 text-xs text-amber-400">
                  {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
                </p>
              )}
            </div>
          </div>
        </DrawerSection>

        {/* Repayment Timeline */}
        <DrawerSection
          title="Repayment Timeline"
          description="Lifecycle progress from funding to repayment"
        >
          <RepaymentTimeline
            fundedAt={position.investedAt}
            maturityDate={invoice.terms.repaymentDate}
            isRepaid={position.status === "repaid"}
            repaidAt={position.status === "repaid" ? invoice.updatedAt : undefined}
            yieldReceived={
              position.status === "repaid" && position.yieldEarned > 0
                ? formatCurrency(position.yieldEarned, invoice.metadata.currency)
                : undefined
            }
          />
        </DrawerSection>

        {/* Related Invoice */}
        <DrawerSection title="Related Invoice" description="View the original invoice">
          <Link href={`/marketplace/${invoice.id}`}>
            <Button variant="outline" className="w-full justify-start" asChild>
              <a>
                <FileText className="w-4 h-4 mr-2" />
                {invoice.metadata.invoiceNumber}
              </a>
            </Button>
          </Link>
          <div className="mt-3 rounded-lg border border-border p-3 bg-muted/30 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Debtor</span>
              <span className="font-medium">{invoice.metadata.debtorName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">
                {formatCurrency(invoice.metadata.amount, invoice.metadata.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">APR</span>
              <span className="font-medium text-primary">{formatPercentage(invoice.terms.apr, 2)}</span>
            </div>
          </div>
        </DrawerSection>

        {/* Yield Earned */}
        {position.yieldEarned > 0 && (
          <DrawerSection title="Yield Information" description="Current yield status">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-400">Yield Earned</p>
                  <p className="text-sm text-emerald-300 mt-0.5">
                    {formatCurrency(position.yieldEarned, invoice.metadata.currency)}
                  </p>
                </div>
              </div>
            </div>
          </DrawerSection>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button onClick={handleExportPDF} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Export as PDF
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
