/**
 * Tests for the PWA InstallPrompt analytics wiring (Issue #708).
 *
 * InstallPrompt now calls the helpers in lib/installPromptAnalytics.ts on show,
 * install acceptance, and dismiss. These cover the local event log the helper
 * always writes (so the metric survives when no analytics SDK is loaded) and
 * assert that no PII leaks into the payload.
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  trackInstallPromptShown,
  trackInstallPromptAccepted,
  trackInstallPromptDismissed,
  getLocalInstallPromptEvents,
  detectInstallCohort,
} from "@/lib/installPromptAnalytics";

const EVENTS_KEY = "kora-install-prompt-events";

describe("installPromptAnalytics", () => {
  beforeEach(() => {
    localStorage.removeItem(EVENTS_KEY);
  });

  it("records a shown event", () => {
    trackInstallPromptShown(1);
    const events = getLocalInstallPromptEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("install_prompt_shown");
    expect(events[0].visitCount).toBe(1);
  });

  it("records install and dismiss outcomes", () => {
    trackInstallPromptAccepted(2);
    trackInstallPromptDismissed(3);
    expect(getLocalInstallPromptEvents().map((e) => e.name)).toEqual([
      "install_prompt_accepted",
      "install_prompt_dismissed",
    ]);
  });

  it("carries no PII — only cohort, visit count and timestamp", () => {
    trackInstallPromptAccepted(1);
    const [event] = getLocalInstallPromptEvents();
    expect(Object.keys(event).sort()).toEqual([
      "cohort",
      "name",
      "timestamp",
      "visitCount",
    ]);
  });

  it("segments cohort by route", () => {
    expect(detectInstallCohort("/dashboard/sme")).toBe("sme");
    expect(detectInstallCohort("/marketplace")).toBe("investor");
    expect(detectInstallCohort("/about")).toBe("unknown");
  });
});
