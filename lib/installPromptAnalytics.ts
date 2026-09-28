/**
 * Analytics for the PWA InstallPrompt (components/pwa/InstallPrompt.tsx).
 *
 * Tracks install/dismiss rates and segments events by cohort (SME vs
 * investor) so we can measure whether the install prompt converts
 * differently across user types. Standalone module — wire into
 * InstallPrompt's handleInstall/handleDismiss handlers when ready.
 */

export type InstallCohort = "sme" | "investor" | "unknown";

export type InstallPromptEventName =
  | "install_prompt_shown"
  | "install_prompt_accepted"
  | "install_prompt_dismissed";

export interface InstallPromptEvent {
  name: InstallPromptEventName;
  cohort: InstallCohort;
  visitCount: number;
  timestamp: number;
}

/**
 * Determines cohort from the current route. Adjust the path patterns if
 * SME/investor routing conventions differ (checked against app/dashboard
 * having both sme/ and investor-facing sections).
 */
export function detectInstallCohort(pathname: string = typeof window !== "undefined" ? window.location.pathname : ""): InstallCohort {
  if (/\/dashboard\/sme|\/sme\b/i.test(pathname)) return "sme";
  if (/\/dashboard\/investor|\/marketplace|\/investor\b/i.test(pathname)) return "investor";
  return "unknown";
}

function sendAnalyticsEvent(event: InstallPromptEvent): void {
  try {
    // Fire-and-forget to whatever analytics pipe the app already uses.
    // Falls back to a no-op if `window.gtag`/`plausible` aren't present.
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      plausible?: (...args: unknown[]) => void;
    };
    if (typeof w.gtag === "function") {
      w.gtag("event", event.name, { cohort: event.cohort, visit_count: event.visitCount });
    }
    if (typeof w.plausible === "function") {
      w.plausible(event.name, { props: { cohort: event.cohort, visitCount: event.visitCount } });
    }
    // Always log locally so the metric isn't lost when no analytics SDK is loaded.
    const key = "kora-install-prompt-events";
    const raw = localStorage.getItem(key);
    const events: InstallPromptEvent[] = raw ? JSON.parse(raw) : [];
    events.push(event);
    localStorage.setItem(key, JSON.stringify(events.slice(-200)));
  } catch {
    // Analytics must never break the install flow.
  }
}

export function trackInstallPromptShown(visitCount: number): void {
  sendAnalyticsEvent({
    name: "install_prompt_shown",
    cohort: detectInstallCohort(),
    visitCount,
    timestamp: Date.now(),
  });
}

export function trackInstallPromptAccepted(visitCount: number): void {
  sendAnalyticsEvent({
    name: "install_prompt_accepted",
    cohort: detectInstallCohort(),
    visitCount,
    timestamp: Date.now(),
  });
}

export function trackInstallPromptDismissed(visitCount: number): void {
  sendAnalyticsEvent({
    name: "install_prompt_dismissed",
    cohort: detectInstallCohort(),
    visitCount,
    timestamp: Date.now(),
  });
}

/** Reads locally-logged events back out, e.g. for a debug/analytics panel. */
export function getLocalInstallPromptEvents(): InstallPromptEvent[] {
  try {
    const raw = localStorage.getItem("kora-install-prompt-events");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
