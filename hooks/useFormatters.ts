"use client";

import { useMemo } from "react";
import { useFormatter as useNextIntlFormatter } from "next-intl";
import { useLocale } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/config";
import {
  formatCurrency as formatCurrencyUtil,
  formatUSDC as formatUSDCUtil,
  formatXLM as formatXLMUtil,
  formatPercentage as formatPercentageUtil,
  formatApr as formatAprUtil,
  formatDate as formatDateUtil,
  formatRelativeTime as formatRelativeTimeUtil,
} from "@/lib/utils";

export interface FormatDateOptions {
  format?: "short" | "long" | "relative";
}

export function useFormatters() {
  const locale = useLocale() as Locale;
  const intl = useNextIntlFormatter();

  return useMemo(() => {
    const formatCurrency = (
      amount: number | null | undefined,
      currency = "USDC",
      compact = false,
    ): string => formatCurrencyUtil(amount, currency, compact, locale);

    const formatUSDC = (
      amount: number | null | undefined,
      decimals = 2,
    ): string => formatUSDCUtil(amount, decimals, locale);

    const formatXLM = (
      amount: number | null | undefined,
    ): string => formatXLMUtil(amount, locale);

    const formatPercentage = (
      value: number | null | undefined,
      decimals = 2,
    ): string => {
      const n = value ?? 0;
      return intl.number(n / 100, {
        style: "percent",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };

    const formatApr = (
      apr: number | null | undefined,
    ): string => formatAprUtil(apr, locale);

    const formatDate = (
      dateStr: string | null | undefined,
      fmt: "short" | "long" | "relative" = "short",
    ): string => {
      if (!dateStr) return "—";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      if (fmt === "relative") return formatRelativeTimeUtil(dateStr, locale);
      if (fmt === "long") {
        return intl.dateTime(d, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      return intl.dateTime(d, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    const formatRelativeTime = (
      date: string | Date | null | undefined,
    ): string => formatRelativeTimeUtil(date, locale);

    const formatNumber = (
      value: number | null | undefined,
      options?: Intl.NumberFormatOptions,
    ): string => {
      const n = value ?? 0;
      return intl.number(n, options as Parameters<typeof intl.number>[1]);
    };

    const formatCompactNumber = (value: number | null | undefined): string => {
      const n = value ?? 0;
      return intl.number(n, { notation: "compact" });
    };

    return {
      formatCurrency,
      formatUSDC,
      formatXLM,
      formatPercentage,
      formatApr,
      formatDate,
      formatRelativeTime,
      formatNumber,
      formatCompactNumber,
      locale,
    };
  }, [locale, intl]);
}

export type Formatters = ReturnType<typeof useFormatters>;
