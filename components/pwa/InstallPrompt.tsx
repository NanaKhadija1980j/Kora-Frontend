"use client";

/**
 * PWA Install Prompt — "Add to Home Screen" banner.
 *
 * Trigger logic:
 *  - Shows after 30 seconds on the site, OR on the 2nd+ visit
 *  - Only shown when the browser fires `beforeinstallprompt` (PWA-capable, non-standalone)
 *  - "Not now" suppresses the prompt for 7 days (stored in localStorage)
 *  - "Install" calls prompt(), stores permanent dismiss on acceptance
 *
 * Constraints:
 *  - Uses the `beforeinstallprompt` browser event — never shown on desktop browsers
 *    that don't support PWA install (the event simply never fires there)
 *  - Must not block any UI interaction (fixed overlay, pointer-events contained)
 *
 * Security notes:
 *  - No user data is collected or transmitted
 *  - prompt() is only called on explicit user gesture
 *  - HTTPS is enforced by the browser for PWA installs
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  trackInstallPromptShown,
  trackInstallPromptAccepted,
  trackInstallPromptDismissed,
} from "@/lib/installPromptAnalytics";

// ─── LocalStorage keys ────────────────────────────────────────────────────────

const DISMISSED_UNTIL_KEY = "kora-pwa-install-dismissed-until";
const VISIT_COUNT_KEY = "kora-pwa-visit-count";

/** Milliseconds before prompting on first visit */
const FIRST_VISIT_DELAY_MS = 30_000;

/** Days to suppress prompt after "Not now" */
const SUPPRESS_DAYS = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISSED_UNTIL_KEY);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch {
    return false;
  }
}

function getVisitCount(): number {
  try {
    return parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function incrementVisitCount(): number {
  try {
    const next = getVisitCount() + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

function suppressForDays(days: number): void {
  try {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));
  } catch {
    // localStorage may be unavailable in some private browsing modes — fail silently
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const t = useTranslations("installPrompt");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitCountRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed (standalone mode) → never show
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error — iOS Safari standalone detection
      window.navigator.standalone === true;

    if (isStandalone) return;

    // User already said "Not now" recently → skip
    if (isDismissed()) return;

    // Increment visit count for this session
    const visitCount = incrementVisitCount();
    visitCountRef.current = visitCount;

    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      if (visitCount >= 2) {
        // 2nd+ visit: show immediately when the event fires
        setVisible(true);
        trackInstallPromptShown(visitCount);
      } else {
        // 1st visit: wait 30 seconds before showing
        timerRef.current = setTimeout(() => {
          setVisible(true);
          trackInstallPromptShown(visitCount);
        }, FIRST_VISIT_DELAY_MS);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      // Permanent dismiss — user installed the app
      suppressForDays(365 * 10);
      trackInstallPromptAccepted(visitCountRef.current);
    } else {
      trackInstallPromptDismissed(visitCountRef.current);
    }
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    suppressForDays(SUPPRESS_DAYS);
    trackInstallPromptDismissed(visitCountRef.current);
    setVisible(false);
    setDeferredPrompt(null);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="install-prompt"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          role="dialog"
          aria-label={t("ariaLabel")}
          aria-modal="false"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-6 sm:max-w-xs"
          data-testid="install-prompt"
        >
          <div className="flex items-start gap-3">
            {/* App icon */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png"
              alt={t("iconAlt")}
              width={44}
              height={44}
              className="shrink-0 rounded-xl"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-100">Kora Protocol</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                {t("description")}
              </p>
            </div>

            {/* Dismiss × */}
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
              aria-label={t("dismissLabel")}
              data-testid="install-prompt-dismiss-x"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              aria-label={t("install")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              data-testid="install-prompt-install"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t("install")}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={t("notNow")}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
              data-testid="install-prompt-not-now"
            >
              {t("notNow")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
