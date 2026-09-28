"use client";

import Link from "next/link";
import { FileQuestion, Home, Store, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { useTranslations } from "next-intl";

/**
 * 404 recovery surface — Issue #693.
 *
 * Most 404s here come from stale share URLs for a delisted invoice or a
 * dashboard deep link, so "Home" alone strands the visitor one level above
 * where they were actually headed. Marketplace and Secondary are the two
 * destinations that recover the intent.
 */
export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
        <FileQuestion className="h-8 w-8 text-zinc-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">{t("title")}</h1>
        <p className="max-w-sm text-sm text-zinc-400">{t("description")}</p>
      </div>
      {/* Wraps rather than overflows: Arabic labels are appreciably longer than
          the English ones and four controls do not fit one narrow row. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <BackButton />
        <Button asChild>
          <Link href="/" className="gap-2 inline-flex items-center">
            <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("goHome")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/marketplace" className="gap-2 inline-flex items-center">
            <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("goMarketplace")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/secondary" className="gap-2 inline-flex items-center">
            <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("goSecondary")}
          </Link>
        </Button>
      </div>
      <p className="max-w-sm text-xs text-zinc-500">{t("recoveryHint")}</p>
    </div>
  );
}
