"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import TourTooltip from "./TourTooltip";
import { useSettingsStore, type Persona } from "@/store/settingsStore";
import { useFeatureFlag } from "@/lib/featureFlags";

export const TOUR_STORAGE_KEY = "kora-tour-done";

const INVESTOR_STEPS = [
  { titleKey: "findOpportunityTitle",  bodyKey: "findOpportunityBody",  selector: "[data-tour='marketplace-search']", placement: "bottom" as const },
  { titleKey: "reviewDetailsTitle",    bodyKey: "reviewDetailsBody",    selector: "[data-tour='invoice-card']",        placement: "right" as const },
  { titleKey: "fundInvoiceTitle",      bodyKey: "fundInvoiceBody",      selector: "[data-tour='fund-button']",         placement: "top" as const },
  { titleKey: "trackPortfolioTitle",   bodyKey: "trackPortfolioBody",   selector: "[data-tour='investor-dashboard']",  placement: "bottom" as const },
  { titleKey: "viewAnalyticsTitle",    bodyKey: "viewAnalyticsBody",    selector: "[data-tour='analytics-header']",   placement: "bottom" as const, optional: true },
];

const SME_STEPS = [
  { titleKey: "mintInvoiceTitle",            bodyKey: "mintInvoiceBody",            selector: "[data-tour='create-invoice-btn']", placement: "bottom" as const },
  { titleKey: "smeDashboardTitle",           bodyKey: "smeDashboardBody",           selector: "[data-tour='dashboard-link']",     placement: "bottom" as const },
  { titleKey: "marketplaceVisibilityTitle",  bodyKey: "marketplaceVisibilityBody",  selector: "[data-tour='marketplace-link']",    placement: "bottom" as const },
];

const ELIGIBLE_ROUTES = ["/marketplace", "/dashboard/sme", "/dashboard/investor", "/invoice/create", "/analytics"];

export default function OnboardingTour() {
  const t = useTranslations("onboarding");
  const pathname = usePathname();
  const enabled = useFeatureFlag("onboarding-tour");
  const { tour, setTourSettings } = useSettingsStore();

  const [open, setOpen] = useState(false);

  const persona = tour.persona;
  const steps = persona === "sme" ? SME_STEPS : INVESTOR_STEPS;
  const stepIndex = Math.min(tour.stepIndex ?? 0, steps.length - 1);

  // Gracefully skip a step when its DOM target is absent, but only for steps
  // flagged as `optional` (e.g. the analytics page may not be reachable for
  // all users). Required steps are always shown regardless of DOM presence.
  useEffect(() => {
    if (!open) return;
    const current = steps[stepIndex];
    if (!current.optional) return;
    if (!document.querySelector(current.selector)) {
      const nextIndex = stepIndex + 1;
      if (nextIndex < steps.length) {
        setTourSettings({ stepIndex: nextIndex });
      } else {
        // No more steps — finish the tour inline (mirrors handleComplete logic).
        try { localStorage.setItem(TOUR_STORAGE_KEY, "true"); } catch { /* storage unavailable */ }
        setTourSettings({ completed: true, skipped: true });
        setOpen(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, steps]);

  // Check route eligibility and completion status
  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }

    // Do not run on deep detail links like /marketplace/inv_001
    if (!ELIGIBLE_ROUTES.includes(pathname)) {
      setOpen(false);
      return;
    }

    let isDone = tour.completed || tour.skipped;
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY) === "true") {
        isDone = true;
      }
    } catch {
      // storage unavailable
    }

    if (!isDone) {
      const timer = window.setTimeout(() => setOpen(true), 400);
      return () => window.clearTimeout(timer);
    } else {
      setOpen(false);
    }
  }, [pathname, enabled, tour.completed, tour.skipped]);

  const handleComplete = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // storage unavailable
    }
    setTourSettings({ completed: true, skipped: true });
    setOpen(false);
  };

  const handleStepChange = (newIndex: number) => {
    setTourSettings({ stepIndex: newIndex });
  };

  const handlePersonaSelect = (newPersona: Persona) => {
    if (newPersona !== persona) {
      setTourSettings({ persona: newPersona, stepIndex: 0 });
    }
  };

  if (!enabled || !open || !ELIGIBLE_ROUTES.includes(pathname)) return null;

  const current = steps[stepIndex];

  return (
    <TourTooltip
      targetSelector={current.selector}
      open
      placement={current.placement}
      onClose={handleComplete}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary">
            {t("step", { current: stepIndex + 1, total: steps.length })}
          </span>
          {/* Persona selector tabs */}
          <div className="inline-flex rounded-md bg-muted/60 p-0.5" role="group" aria-label={t("selectPersona")}>
            <button
              type="button"
              onClick={() => handlePersonaSelect("investor")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                persona === "investor"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("personaInvestor")}
            </button>
            <button
              type="button"
              onClick={() => handlePersonaSelect("sme")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                persona === "sme"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("personaSme")}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleComplete}
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
          animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
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
          onClick={handleComplete}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("skipTour")}
        </button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => handleStepChange(stepIndex - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {t("back")}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              stepIndex === steps.length - 1 ? handleComplete() : handleStepChange(stepIndex + 1)
            }
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {stepIndex === steps.length - 1 ? t("finish") : t("next")}
            {stepIndex < steps.length - 1 && <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </TourTooltip>
  );
}

