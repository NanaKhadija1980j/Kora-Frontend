"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PlusCircle, TrendingUp, FileText, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { RepaymentDialog } from "@/components/invoice/RepaymentDialog";
import { DashboardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BatchResultSummary } from "@/components/dashboard/BatchActionToolbar";
import {
  prepareCancelInvoice,
  submitAndConfirm,
  fetchInvoicesByOwner,
} from "@/services/invoiceService";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import type { DataTableProps } from "@/types/table";

const BatchActionToolbar = dynamic(
  () => import("@/components/dashboard/BatchActionToolbar").then((m) => m.BatchActionToolbar),
  { ssr: false, loading: () => <div className="h-14 w-full animate-pulse rounded-xl bg-zinc-900/40 border border-zinc-800" /> }
);

const DataTable = dynamic<DataTableProps<Invoice>>(
  () => import("@/components/ui/data-table").then((m) => m.DataTable),
  { ssr: false, loading: () => <DashboardSkeleton statCount={4} tableRows={5} tableCols={8} /> }
);
import { useWallet } from "@/hooks/useWallet";
import { useSMEInvoices } from "@/hooks/useInvoices";
import { useTransaction } from "@/hooks/useTransaction";
import { useTxSimulation } from "@/hooks/useTxSimulation";
import { TxSimulationPreview } from "@/components/invoice/TxSimulationPreview";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useMaturityReminder } from "@/hooks/useMaturityReminder";
import { prepareRepayInvoice } from "@/services/invoiceService";
import { useUIStore, useInvoiceStore } from "@/store";
import { MOCK_INVOICES } from "@/services/mockData";
import {
  formatCurrency,
  formatDate,
  formatApr,
  cn,
} from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/invoice/InvoiceStatusBadge";
import { DebtorDisplay } from "@/components/invoice/DebtorDisplay";
import type { Invoice } from "@/types";
import type { InvoiceStatus } from "@/types/invoice";
import type { ColumnDef } from "@/types/table";
import EmptyState from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import ShareInvoiceButton from "@/components/invoice/ShareInvoiceButton";

// ─── Skeleton for stats grid while data loads ─────────────────────────────────

function StatsGridSkeleton() {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Stats grid — suspends until invoices are loaded ─────────────────────────

function SMEStatsGrid({ address }: { address: string }) {
  const { data: rawData } = useSuspenseQuery({
    queryKey: queryKeys.invoices.byOwner(address),
    queryFn: () => fetchInvoicesByOwner(address),
    staleTime: 30_000,
  });

  const myInvoices: Invoice[] = (rawData ?? []).filter(
    (inv: Invoice) => inv.ownerAddress === address
  );

  const stats = [
    {
      label: "Total Financed",
      value: formatCurrency(myInvoices.reduce((s, i) => s + i.funding.totalRaised, 0), "USDC", true),
      change: "12.4% this month",
      changePositive: true,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Active Invoices",
      value: myInvoices.filter((i) => ["listed", "partially_funded", "fully_funded"].includes(i.status)).length.toString(),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "Pending Repayment",
      value: formatCurrency(
        myInvoices.filter((i) => i.status === "fully_funded").reduce((s, i) => s + i.metadata.amount, 0),
        "USDC",
        true
      ),
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Repayment Rate",
      value: "100%",
      change: "All-time",
      changePositive: true,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
  ];

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
        >
          <StatCard {...stat} />
        </motion.div>
      ))}
    </div>
  );
}


export default function SMEDashboardPage() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const queryClient = useQueryClient();
  const invoicesQuery = useSMEInvoices(address ?? undefined);
  const { execute, status: txStatus } = useTransaction();
  const { simulationDialogProps, onSimulationPreview } = useTxSimulation();
  const { data: usdcBalance = 0 } = useUsdcBalance(address ?? undefined);

  const [repayTarget, setRepayTarget] = useState<Invoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  } | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const myInvoices: Invoice[] = (invoicesQuery.data || MOCK_INVOICES).filter(
    (inv: Invoice) => inv.ownerAddress === address
  );

  useMaturityReminder(
    myInvoices.filter((invoice) => ["listed", "partially_funded", "fully_funded"].includes(invoice.status))
  );

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <EmptyState
          variant="no-invoices"
          title="Connect your wallet"
          description="Connect to view and manage your invoices"
          cta={{ label: "Connect Wallet", onClick: () => setWalletModalOpen(true) }}
        />
      </div>
    );
  }

  const handleRepay = async (inv: Invoice) => {
    if (!address) return;

    const rollback = () => {
      useInvoiceStore.getState().rollbackInvoiceStatus(inv.id);
      queryClient.setQueryData(queryKeys.invoices.byOwner(address), (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((invoice: Invoice) =>
            invoice.id === inv.id ? { ...invoice, status: inv.status } : invoice
          );
        }
        if (old?.data) {
          return {
            ...old,
            data: old.data.map((invoice: Invoice) =>
              invoice.id === inv.id ? { ...invoice, status: inv.status } : invoice
            ),
          };
        }
        return old;
      });
    };

    useInvoiceStore.getState().updateInvoiceStatus(inv.id, "repaid");
    queryClient.setQueryData(queryKeys.invoices.byOwner(address), (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return old.map((invoice: Invoice) =>
          invoice.id === inv.id ? { ...invoice, status: "repaid" } : invoice
        );
      }
      if (old?.data) {
        return {
          ...old,
          data: old.data.map((invoice: Invoice) =>
            invoice.id === inv.id ? { ...invoice, status: "repaid" } : invoice
          ),
        };
      }
      return old;
    });

    const txHash = await execute(
      () => prepareRepayInvoice(inv.tokenId, address, inv.ownerAddress),
      {
        successMessage: "Yield distributed to investors",
        successNotificationType: "yieldAvailable",
        onSimulationPreview,
        onError: rollback,
        onSuccess: () => {
          invoicesQuery.refetch();
          setRepayTarget(null);
        },
      }
    );

    if (!txHash) {
      rollback();
    }
  };

  const handleCancel = async (inv: Invoice) => {
    if (!address) return;
    await execute(
      async () => {
        const unsignedXdr = await prepareCancelInvoice(inv.tokenId, address);
        return unsignedXdr;
      },
      {
        successMessage: "Invoice cancellation submitted",
        onSimulationPreview,
        onSuccess: () => {
          invoicesQuery.refetch();
        },
      }
    );
  };

  const handleBatchCancel = async () => {
    if (!address || selectedIds.length === 0) return;

    // Only Active-status invoices may be batch-cancelled per spec constraint
    const eligible = myInvoices.filter(
      (inv) =>
        selectedIds.includes(inv.id) &&
        inv.status === "active"
    );

    if (eligible.length === 0) {
      toast.error(
        "No eligible invoices selected. Only invoices in Active status can be batch-cancelled."
      );
      return;
    }

    // Open confirmation dialog — the user must confirm before any action fires
    setCancelConfirmOpen(true);
  };

  /** Called after the user clicks "Confirm" in the cancel confirmation dialog */
  const executeBatchCancel = async () => {
    if (!address || selectedIds.length === 0) return;
    setCancelConfirmOpen(false);

    const invoicesToCancel = myInvoices.filter(
      (inv) =>
        selectedIds.includes(inv.id) &&
        inv.status === "active"
    );

    setIsBatchProcessing(true);
    setBatchProgress(0);

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (let i = 0; i < invoicesToCancel.length; i++) {
      const inv = invoicesToCancel[i];
      try {
        const unsignedXdr = await prepareCancelInvoice(inv.tokenId, address);
        await submitAndConfirm(unsignedXdr);
        successCount++;
      } catch (err) {
        failedCount++;
        errors.push({
          id: inv.metadata.invoiceNumber,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
      setBatchProgress(((i + 1) / invoicesToCancel.length) * 100);
    }

    setIsBatchProcessing(false);
    setSelectedIds([]);
    setBatchResults({
      total: invoicesToCancel.length,
      success: successCount,
      failed: failedCount,
      errors,
    });
    invoicesQuery.refetch();
  };

  const handleBatchExport = () => {
    const selectedInvoices = myInvoices.filter((inv) => selectedIds.includes(inv.id));
    if (selectedInvoices.length === 0) return;

    const headers = [
      "Invoice Number", "Debtor", "Amount", "Currency", 
      "APR", "Status", "Due Date", "Created At"
    ];

    const rows = selectedInvoices.map(inv => [
      inv.metadata.invoiceNumber,
      inv.metadata.debtorName,
      inv.metadata.amount,
      inv.metadata.currency,
      inv.terms.apr,
      inv.status,
      inv.metadata.dueDate,
      inv.createdAt
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `invoices_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedInvoices.length} invoices to CSV`);
  };

  return (
    <ErrorBoundary>
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SME Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your invoice financing</p>
        </div>
        <Link href="/invoice/create">
          <Button>
            <PlusCircle className="h-4 w-4" /> New Invoice
          </Button>
        </Link>
      </div>

      {address && (
        <Suspense fallback={<StatsGridSkeleton />}>
          <SMEStatsGrid address={address} />
        </Suspense>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>My Invoices</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
          <DataTable
            data={myInvoices}
            enableSelection={true}
            onSelectionChange={setSelectedIds}
            columns={(() => {
              const cols: ColumnDef<Invoice>[] = [
                {
                  id: "invoice",
                  header: "Invoice",
                  accessor: (row) => row.metadata.invoiceNumber,
                  cell: (row) => (
                    <div>
                      <p className="font-medium text-foreground">{row.metadata.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{row.metadata.category}</p>
                    </div>
                  ),
                },
                {
                  id: "debtor",
                  header: "Debtor",
                  accessor: (row) => row.metadata.debtorName,
                  cell: (row) => <DebtorDisplay invoice={row} isFunded={true} />,
                },
                {
                  id: "amount",
                  header: "Amount",
                  accessor: (row) => row.metadata.amount,
                  cell: (row) => (
                    <span className="font-medium text-foreground">
                      {formatCurrency(row.metadata.amount, row.metadata.currency, true)}
                    </span>
                  ),
                },
                {
                  id: "apr",
                  header: "APR",
                  accessor: (row) => row.terms.apr,
                  cell: (row) => <span className="font-medium text-primary">{formatApr(row.terms.apr)}</span>,
                },
                {
                  id: "progress",
                  header: "Progress",
                  accessor: (row) => row.funding.fundingProgress,
                  cell: (row) => (
                    <div className="w-32 space-y-1">
                      <Progress value={row.funding.fundingProgress * 100} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{Math.round(row.funding.fundingProgress * 100)}%</p>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: "Status",
                  accessor: (row) => row.status,
                  cell: (row) => (
                    <InvoiceStatusBadge status={row.status} />
                  ),
                },
                {
                  id: "due",
                  header: "Due Date",
                  accessor: (row) => row.terms.repaymentDate,
                  cell: (row) => (
                    <span className="text-xs text-muted-foreground">{formatDate(row.terms.repaymentDate)}</span>
                  ),
                },
                {
                  id: "actions",
                  header: "",
                  sortable: false,
                  cell: (row) => {
                    const isDue = new Date(row.terms.repaymentDate) <= new Date();
                    const canRepay = row.status === "fully_funded" && isDue;
                    const canCancel = (row.status === "listed" || row.status === "pending_mint") && row.funding.totalRaised === 0;

                    return (
                      <div className="flex items-center gap-2">
                        {canRepay && (
                          <Button size="sm" onClick={() => setRepayTarget(row)}>
                            Repay
                          </Button>
                        )}
                        {canCancel && (
                          <Button size="sm" variant="ghost" onClick={() => handleCancel(row)}>
                            Cancel
                          </Button>
                        )}
                        <div className="flex items-center gap-2">
                          <ShareInvoiceButton id={row.id} invoiceTitle={row.metadata.invoiceNumber} summary={row.metadata.description} />
                          <Link href={`/marketplace/${row.id}`} className="text-xs text-primary hover:opacity-80">
                            View →
                          </Link>
                        </div>
                      </div>
                    );
                  },
                },
              ];
              return cols;
            })()}
            pageSize={5}
            bulkActions={
              <Button type="button" variant="outline" size="sm">
                Export selected
              </Button>
            }
            isLoading={invoicesQuery.isLoading}
            emptyState={{
              title: "No invoices yet",
              message: "Create your first invoice to start raising liquidity.",
              illustration: <FileText className="h-10 w-10 text-muted-foreground" />,
            }}
          />
        </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {myInvoices.some((i) => i.status === "fully_funded") && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-warning">Repayment Due Soon</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You have invoices approaching their repayment date. Ensure sufficient USDC balance.
            </p>
          </div>
        </motion.div>
          )}
        </div>
      </div>

      <RepaymentDialog
        invoice={repayTarget}
        open={!!repayTarget}
        onOpenChange={(open) => { if (!open) setRepayTarget(null); }}
        onConfirm={handleRepay}
        isLoading={txStatus !== "idle" && txStatus !== "confirmed" && txStatus !== "failed"}
        insufficientBalance={
          !!repayTarget &&
          usdcBalance <
            repayTarget.funding.totalRaised * (1 + repayTarget.terms.discountRate)
        }
      />

      <BatchActionToolbar
        selectedCount={selectedIds.length}
        onCancel={handleBatchCancel}
        onExport={handleBatchExport}
        isProcessing={isBatchProcessing}
        progress={batchProgress}
        processingLabel={`Cancelling ${selectedIds.length} invoices...`}
      />

      <Dialog open={!!batchResults} onOpenChange={(open) => !open && setBatchResults(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Operation Summary</DialogTitle>
          </DialogHeader>
          {batchResults && (
            <BatchResultSummary
              total={batchResults.total}
              successCount={batchResults.success}
              failedCount={batchResults.failed}
              errors={batchResults.errors}
              onClose={() => setBatchResults(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog — shows count of invoices to be cancelled */}
      {(() => {
        const eligibleCount = selectedIds.filter((id) =>
          myInvoices.find((inv) => inv.id === id && inv.status === "active")
        ).length;
        return (
          <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Cancel {eligibleCount} Invoice{eligibleCount !== 1 ? "s" : ""}?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  You are about to cancel{" "}
                  <strong>
                    {eligibleCount} active invoice{eligibleCount !== 1 ? "s" : ""}
                  </strong>
                  . This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCancelConfirmOpen(false)}
                    data-testid="cancel-confirm-dismiss"
                  >
                    Go Back
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={executeBatchCancel}
                    data-testid="cancel-confirm-proceed"
                  >
                    Yes, Cancel {eligibleCount} Invoice{eligibleCount !== 1 ? "s" : ""}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Transaction simulation preview dialog */}
      <TxSimulationPreview {...simulationDialogProps} />
    </div>
    </ErrorBoundary>
  );
}
