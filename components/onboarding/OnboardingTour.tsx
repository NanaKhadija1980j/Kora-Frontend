"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import TourTooltip from "./TourTooltip";

export const TOUR_STORAGE_KEY = "kora-tour-done";

// Step keys that map to i18n
const STEP_KEYS = [
  { titleKey: "findOpportunityTitle", bodyKey: "findOpportunityBody", selector: "[data-tour='marketplace-search']", placement: "bottom" as const },
  { titleKey: "reviewDetailsTitle",   bodyKey: "reviewDetailsBody",   selector: "[data-tour='invoice-card']",       placement: "right" as const },
  { titleKey: "fundInvoiceTitle",     bodyKey: "fundInvoiceBody",     selector: "[data-tour='fund-button']",        placement: "top" as const },
  { titleKey: "trackPortfolioTitle",  bodyKey: "trackPortfolioBody",  selector: "[data-tour='investor-dashboard']", placement: "bottom" as const },
];

export default function OnboardingTour() {
  const t = useTranslations("onboarding");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (pathname !== "/marketplace") {
      setOpen(false);
      return;
    }
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY) !== "true") {
        const timer = window.setTimeout(() => setOpen(true), 400);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // storage unavailable
    }
  }, [pathname]);

  const complete = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // storage unavailable
    }
    setOpen(false);
  };

  const current = STEP_KEYS[stepIndex];
  if (!open || pathname !== "/marketplace") return null;

  return (
    <TourTooltip
      targetSelector={current.selector}
      open
      placement={current.placement}
      onClose={complete}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-primary">
          {t("step", { current: stepIndex + 1, total: STEP_KEYS.length })}
        </span>
        <button
          type="button"
          onClick={complete}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t("skipLabel")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{ width: `${((stepIndex + 1) / STEP_KEYS.length) * 100}%` }}
        />
      </div>

      <h2 className="mb-1 font-semibold text-foreground">
        {t(`steps.${current.titleKey}`)}
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {t(`steps.${current.bodyKey}`)}
      </p>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={complete}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("skipTour")}
        </button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStepIndex((s) => s - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {t("back")}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              stepIndex === STEP_KEYS.length - 1 ? complete() : setStepIndex((s) => s + 1)
            }
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {stepIndex === STEP_KEYS.length - 1 ? t("finish") : t("next")}
            {stepIndex < STEP_KEYS.length - 1 && <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </TourTooltip>
  );
}
