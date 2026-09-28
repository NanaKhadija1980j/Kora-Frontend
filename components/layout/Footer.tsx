"use client";

import { useTranslations } from "next-intl";
import { useUIStore } from "@/store/uiStore";
import { useChangelogBadge } from "@/hooks/useChangelogBadge";

const APP_VERSION = "0.1.0";

export function Footer() {
  const t = useTranslations("footer");
  const setChangelogOpen = useUIStore((s) => s.setChangelogOpen);
  const { hasUnread } = useChangelogBadge();

  return (
    <footer className="border-t border-border/60 bg-background/80 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 text-xs text-muted-foreground">
        <span>{t("copyright", { year: new Date().getFullYear() })}</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={t("openShortcutsLabel")}
            onClick={() =>
              window.dispatchEvent(new CustomEvent("kora:open-shortcut-modal"))
            }
            className="transition-colors underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("keyboardShortcuts")}
          </button>
          <button
            type="button"
            onClick={() => setChangelogOpen(true)}
            className="relative hover:text-foreground transition-colors underline-offset-2 hover:underline"
            aria-label={t(hasUnread ? "openChangelogUnreadLabel" : "openChangelogLabel")}
          >
            {t("changelog")}
            {hasUnread && (
              <span
                data-testid="changelog-unread-dot-footer"
                className="absolute -right-2 -top-1 h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden
              />
            )}
          </button>
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
            v{APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
