"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ReloadButton } from "./ReloadButton";
import { StaleDataBadge } from "@/components/layout/StaleDataBadge";
import { PendingTxQueuePanel } from "@/components/pwa/PendingTxQueuePanel";
import { getLatestMarketplaceDataUpdatedAt } from "@/lib/queryPersistence";

export default function OfflinePage() {
  const t = useTranslations("offline");
  const queryClient = useQueryClient();
  const cachedAt = getLatestMarketplaceDataUpdatedAt(queryClient);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      {/* Icon */}
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-500"
          aria-hidden="true"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
        {t("title")}
      </h1>

      <p className="mt-4 max-w-md text-base text-zinc-400">{t("subtitle")}</p>

      <div className="mt-8 w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {t("availableOffline")}
        </p>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("cachedListings")}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("cachedAssets")}
          </li>
        </ul>
        <p className="mb-3 mt-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {t("requiresConnection")}
        </p>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            {t("walletSigning")}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            {t("invoiceCreation")}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            {t("liveData")}
          </li>
        </ul>
      </div>

      {/* Pending signed-XDR queue — visible online and offline */}
      <div className="mt-8 w-full max-w-sm text-left">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {t("pendingQueueTitle")}
        </p>
        <p className="mb-4 text-xs text-zinc-500">{t("pendingQueueDesc")}</p>
        <PendingTxQueuePanel />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ReloadButton />
        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
        >
          {t("browseCached")}
        </Link>
      </div>

      {/* Show last-synced timestamp if marketplace data is in the cache */}
      {cachedAt ? (
        <div className="mt-4">
          <StaleDataBadge updatedAt={cachedAt} />
        </div>
      ) : null}
    </div>
  );
}
