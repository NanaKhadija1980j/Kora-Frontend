"use client";

/**
 * Secondary market fee disclosure (issue #597).
 *
 * Renders the breakdown returned by `lib/secondaryFees` — it does no
 * arithmetic of its own, so the figures shown and the figures charged cannot
 * diverge.
 */

import { useTranslations } from "next-intl";

import { formatBps, type FeeBreakdown } from "@/lib/secondaryFees";
import { formatCurrency } from "@/lib/utils";

interface FeeDisclosureProps {
  fees: FeeBreakdown;
  /** Compact single-line form for listing cards. */
  variant?: "full" | "inline";
  className?: string;
}

export function FeeDisclosure({
  fees,
  variant = "full",
  className,
}: FeeDisclosureProps) {
  const t = useTranslations("secondaryFees");

  if (fees.totalBps === 0) {
    return (
      <p className={className} data-testid="fee-disclosure-none">
        {t("noFees")}
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <p className={className} data-testid="fee-disclosure-inline">
        {t("listingNote", { rate: formatBps(fees.totalBps) })}
      </p>
    );
  }

  return (
    <div className={className} data-testid="fee-disclosure">
      <h4 className="text-xs font-medium text-zinc-300">{t("title")}</h4>
      <p className="text-[11px] text-zinc-500">{t("subtitle")}</p>

      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-400">{t("subtotal")}</dt>
          <dd className="font-mono text-zinc-200">{formatCurrency(fees.subtotal)}</dd>
        </div>

        {fees.schedule.protocolBps > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-zinc-400">
              {t("protocolFee", { rate: formatBps(fees.schedule.protocolBps) })}
            </dt>
            <dd className="font-mono text-zinc-200">
              {formatCurrency(fees.protocolFee)}
            </dd>
          </div>
        )}

        {fees.schedule.marketBps > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-zinc-400">
              {t("marketFee", { rate: formatBps(fees.schedule.marketBps) })}
            </dt>
            <dd className="font-mono text-zinc-200">
              {formatCurrency(fees.marketFee)}
            </dd>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-zinc-800 pt-1 font-medium">
          <dt className="text-zinc-200">{t("total")}</dt>
          <dd className="font-mono text-zinc-100" data-testid="fee-total">
            {formatCurrency(fees.total)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default FeeDisclosure;
