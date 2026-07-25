"use client";

import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { useTranslations } from "next-intl";

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
      <div className="flex gap-3">
        <BackButton />
        <Button asChild>
          <Link href="/" className="gap-2 inline-flex items-center">
            <Home className="h-3.5 w-3.5" /> {t("goHome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
