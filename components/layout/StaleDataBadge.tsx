"use client";

import { formatDistanceToNow } from "date-fns";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";

interface StaleDataBadgeProps {
  updatedAt?: number | null;
  compact?: boolean;
  className?: string;
}

export function StaleDataBadge({
  updatedAt,
  compact = false,
  className,
}: StaleDataBadgeProps) {
  const t = useTranslations("network");
  const { isOnline } = useNetworkStatus();

  if (isOnline || !updatedAt) {
    return null;
  }

  const relativeTime = formatDistanceToNow(updatedAt, { addSuffix: true });

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200",
        compact && "px-2.5 py-1 text-[11px]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="font-medium">
        {compact ? t("offlineCachedShort") : t("offlineCached")}
      </span>
      <span className="text-amber-100/80">
        {t("lastUpdated", { time: relativeTime })}
      </span>
    </div>
  );
}
