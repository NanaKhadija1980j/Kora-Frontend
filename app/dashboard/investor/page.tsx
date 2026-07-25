"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Store, TrendingUp, DollarSign, BarChart3, Clock, AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useWallet } from "@/hooks/useWallet";
import { useUIStore, useInvoiceStore, DEFAULT_FILTERS } from "@/store";
import { usePositions } from "@/hooks/usePositions";
import { useTransaction } from "@/hooks/useTransaction";
import { prepareClaimPosition } from "@/services/invoiceService";
import type { PortfolioDonutProps, DonutFilter } from "@/components/dashboard/PortfolioDonut";
import {
  marketplacePathForAllocation,
  allocationToMarketplaceFilters,
} from "@/lib/portfolioAllocation";
import {
  formatCurrency,
  formatDate,
  formatApr,
  RISK_TIER_COLORS,
  cn,
} from "@/lib/utils";
import type { InvestorPosition, InvoicePosition } from "@/types/invoice";
import type { ColumnDef, DataTableProps } from "@/types/table";
import { InvestorDashboardSkeleton } from "@/components/ui/skeleton";

const DataTable = dynamic<DataTableProps<InvestorPosition>>(
  () => import("@/components/ui/data-table").then((m) => m.DataTable),
  {
    ssr: false,
    loading: () => <div className="h-48 rounded bg-zinc-900/40" aria-busy="true" />,
  },
);

const PortfolioDonut = dynamic<PortfolioDonutProps>(
  () => import("@/components/dashboard/PortfolioDonut").then((m) => m.PortfolioDonut),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-zinc-900/40 border border-zinc-800" />,
  },
);

/** Loading must resolve within 30s or we surface an error state. */
export const INVESTOR_DASHBOARD_LOAD_TIMEOUT_MS = 30_000;

function toInvoicePositions(positions: InvestorPosition[]): InvoicePosition[] {
  return positions
    .filter((p): p is InvestorPosition & { invoice: NonNullable<InvestorPosition["invoice"]> } =>
      Boolean(p.invoice),
    )
    .map((p) => ({
      invoiceId: p.invoiceId,
      invoice: p.invoice,
      investedAmount: p.investedAmount,
      expectedReturn: p.expectedReturn,
      yieldEarned: Math.max(0, p.expectedReturn - p.investedAmount),
      investedAt: p.invoice.createdAt,
      status: p.status,
    }));
}

export default function InvestorDashboardPage() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const router = useRouter();
  const { setFilters, resetFilters } = useInvoiceStore();
  const positionsQuery = usePositions(address ?? undefined, {
    refetchInterval: 30_000,
  });
  const { execute } = useTransaction();
  const [donutFilter, setDonutFilter] = useState<DonutFilter | null>(null);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  const positionsData: InvestorPosition[] = useMemo(
    () => positionsQuery.data ?? [],
    [positionsQuery.data],
  );
  const isInitialLoading =
    positionsQuery.isLoading || (positionsQuery.isFetching && !positionsQuery.data);

  const donutPositions = useMemo(
    () => toInvoicePositions(positionsData),
    [positionsData],
  );

  const filteredPositions = useMemo(() => {
    if (!donutFilter) return positionsData;
    return positionsData.filter((pos) => {
      const inv = pos.invoice;
      if (!inv) return false;
      switch (donutFilter.dimension) {
        case "riskTier":
          return inv.riskTier === donutFilter.value;
        case "jurisdiction":
          return inv.metadata.jurisdiction === donutFilter.value;
        case "category":
          return inv.metadata.category === donutFilter.value;
        default:
          return true;
      }
    });
  }, [positionsData, donutFilter]);

  const handleSegmentClick = useCallback(
    (filter: DonutFilter | null) => {
      setDonutFilter(filter);
      if (!filter) {
        resetFilters();
        return;
      }
      resetFilters();
      setFilters({
        ...DEFAULT_FILTERS,
        ...allocationToMarketplaceFilters(filter),
      });
      router.push(marketplacePathForAllocation(filter));
    },
    [resetFilters, setFilters, router],
  );

  useEffect(() => {
    if (!isConnected || !isInitialLoading || loadTimedOut) return;

    const id = window.setTimeout(() => {
      setLoadTimedOut(true);
    }, INVESTOR_DASHBOARD_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(id);
  }, [isConnected, isInitialLoading, loadTimedOut]);

  useEffect(() => {
    if (positionsQuery.isSuccess || positionsQuery.isError) {
      setLoadTimedOut(false);
    }
  }, [positionsQuery.isSuccess, positionsQuery.isError]);

  const handleClaim = async (pos: InvestorPosition) => {
    if (!address) return;
    await execute(() => prepareClaimPosition(pos.id, address), {
      successMessage: "Claim submitted",
      onSuccess: () => positionsQuery.refetch(),
    });
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Connect your wallet
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect to view your investment portfolio
        </p>
        <Button onClick={() => setWalletModalOpen(true)}>Connect Wallet</Button>
      </div>
    );
  }

  if (loadTimedOut || positionsQuery.isError) {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Unable to load portfolio
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {loadTimedOut
            ? "Loading took longer than 30 seconds. Check your connection and try again."
            : "Something went wrong while fetching your positions."}
        </p>
        <Button
          onClick={() => {
            setLoadTimedOut(false);
            void positionsQuery.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (isInitialLoading) {
    return <InvestorDashboardSkeleton />;
  }

  const totalInvested = positionsData.reduce(
    (sum, position) => sum + position.investedAmount,
    0,
  );
  const totalExpected = positionsData.reduce(
    (sum, position) => sum + position.expectedReturn,
    0,
  );
  const totalYield = totalExpected - totalInvested;
  const averageApr = positionsData.length
    ? positionsData.reduce(
        (sum, position) => sum + (position.invoice?.terms.apr ?? 0),
        0,
      ) / positionsData.length
    : 0;


  const STATS = [
    {
      label: "Portfolio Value",
      value: formatCurrency(totalInvested, "USDC", true),
      change: `${positionsData.length} ${positionsData.length === 1 ? "position" : "positions"}`,
      changePositive: true,
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Expected Yield",
      value: formatCurrency(totalYield, "USDC", true),
      change:
        totalInvested > 0
          ? `${((totalYield / totalInvested) * 100).toFixed(1)}% return`
          : "0.0% return",
      changePositive: true,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Active Positions",
      value: positionsData.length.toString(),
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: "Avg. APR",
      value: `${averageApr.toFixed(1)}%`,
      change: "Across all positions",
      changePositive: true,
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  const POSITION_COLUMNS: ColumnDef<InvestorPosition>[] = [
    {
      id: "invoice",
      header: "Invoice",
      accessor: (row) => row.invoice?.metadata.invoiceNumber ?? row.invoiceId,
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">
            {row.invoice?.metadata.invoiceNumber ?? `Invoice ${row.invoiceId}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.invoice?.metadata.category ?? "Unspecified"}
          </p>
        </div>
      ),
    },
    {
      id: "debtor",
      header: "Debtor",
      accessor: (row) => row.invoice?.metadata.debtorName ?? "Unknown debtor",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.invoice?.metadata.debtorName ?? "Unknown debtor"}
        </span>
      ),
    },
    {
      id: "invested",
      header: "Invested",
      accessor: (row) => row.investedAmount,
      cell: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.investedAmount, "USDC", true)}
        </span>
      ),
    },
    {
      id: "expected",
      header: "Expected Return",
      accessor: (row) => row.expectedReturn,
      cell: (row) => (
        <span className="font-medium text-success">
          {formatCurrency(row.expectedReturn, "USDC", true)}
        </span>
      ),
    },
    {
      id: "yield",
      header: "Yield",
      accessor: (row) => row.expectedReturn - row.investedAmount,
      cell: (row) => (
        <span className="text-primary">
          +
          {formatCurrency(
            row.expectedReturn - row.investedAmount,
            "USDC",
            true,
          )}
        </span>
      ),
    },
    {
      id: "apr",
      header: "APR",
      accessor: (row) => row.invoice?.terms.apr ?? 0,
      cell: (row) => (
        <span className="font-medium text-primary">
          {formatApr(row.invoice?.terms.apr ?? 0)}
        </span>
      ),
    },
    {
      id: "risk",
      header: "Risk",
      accessor: (row) => row.invoice?.riskTier ?? "AAA",
      cell: (row) => (
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-semibold",
            RISK_TIER_COLORS[row.invoice?.riskTier ?? "AAA"],
          )}
        >
          {row.invoice?.riskTier ?? "AAA"}
        </span>
      ),
    },
    {
      id: "due",
      header: "Due Date",
      accessor: (row) => row.invoice?.terms.repaymentDate ?? "",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.invoice?.terms.repaymentDate ?? "")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.status === "repaid" ? (
            <Button size="sm" onClick={() => handleClaim(row)}>
              Claim
            </Button>
          ) : null}
          <Link
            href={`/marketplace/${row.invoice?.id ?? row.invoiceId}`}
            className="text-xs text-primary hover:opacity-80"
          >
            View →
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="false">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Investor Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your invoice financing portfolio
          </p>
        </div>
        <Link href="/marketplace">
          <Button variant="outline">
            <Store className="h-4 w-4" /> Browse Marketplace
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat, i) => (
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="mb-8"
      >
        <PortfolioDonut
          positions={donutPositions}
          activeFilter={donutFilter}
          onSegmentClick={handleSegmentClick}
        />
      </motion.div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>
            {donutFilter
              ? `Positions — ${donutFilter.value}`
              : "Active Positions"}
          </CardTitle>
          {donutFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setDonutFilter(null)}
            >
              Clear filter ×
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            data={filteredPositions}
            columns={POSITION_COLUMNS as any}
            isLoading={false}
            pageSize={5}
            emptyState={{
              title: donutFilter ? "No matching positions" : "No positions",
              message: donutFilter
                ? `No positions match the selected filter (${donutFilter.value}).`
                : "Fund invoices on the marketplace to build your portfolio.",
              illustration: (
                <BarChart3 className="h-10 w-10 text-muted-foreground" />
              ),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
