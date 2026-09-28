"use client";

/**
 * Vintage cohort table (issue #605).
 *
 * Grouping logic lives in `lib/vintageCohorts`; this renders the rows and
 * exposes the CSV export.
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  buildVintageCohorts,
  cohortsToExportRows,
  type CohortPosition,
} from "@/lib/vintageCohorts";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface VintageCohortTableProps {
  positions: CohortPosition[];
  /** Receives flattened rows ready for CSV. */
  onExport?: (rows: Array<Record<string, string | number>>) => void;
  className?: string;
}

export function VintageCohortTable({
  positions,
  onExport,
  className,
}: VintageCohortTableProps) {
  const t = useTranslations("vintageCohorts");

  const cohorts = useMemo(() => buildVintageCohorts(positions), [positions]);

  if (cohorts.length === 0) {
    return (
      <p className={className} data-testid="vintage-cohorts-empty">
        {t("noData")}
      </p>
    );
  }

  return (
    <section className={className} data-testid="vintage-cohorts">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-100">{t("title")}</h3>
          <p className="text-xs text-zinc-500">{t("subtitle")}</p>
        </div>
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onExport(cohortsToExportRows(cohorts))}
          >
            {t("export")}
          </Button>
        )}
      </div>

      {/* Wide table scrolls inside its own container rather than the page. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <caption className="sr-only">{t("title")}</caption>
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th scope="col" className="py-2 pr-3 font-medium">{t("month")}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{t("positions")}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{t("invested")}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{t("weightedApr")}</th>
              <th scope="col" className="py-2 text-right font-medium">{t("defaultRate")}</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr
                key={cohort.month}
                data-testid={`cohort-row-${cohort.month}`}
                className={
                  cohort.isEmpty
                    ? "border-b border-zinc-900 text-zinc-600"
                    : "border-b border-zinc-900 text-zinc-200"
                }
              >
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  {cohort.label}
                </th>
                {cohort.isEmpty ? (
                  <td className="py-2 text-zinc-600" colSpan={4}>
                    {t("empty")}
                  </td>
                ) : (
                  <>
                    <td className="py-2 pr-3 text-right font-mono">{cohort.positionCount}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {formatCurrency(cohort.totalInvested)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {cohort.weightedApr === null ? "—" : `${cohort.weightedApr.toFixed(2)}%`}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {cohort.defaultRate.toFixed(1)}%
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default VintageCohortTable;
