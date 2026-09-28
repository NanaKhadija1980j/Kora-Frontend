/**
 * Unit tests for PWA InstallPrompt cohort detection (Issue #811).
 *
 * `detectInstallCohort` maps the current route to one of three cohorts so the
 * install prompt can be measured separately for SMEs and investors:
 *
 *   sme      -> /dashboard/sme…  or any /sme path segment
 *   investor -> /dashboard/investor…, /marketplace…, or any /investor segment
 *   unknown  -> everything else
 *
 * The ordering in the implementation matters: the SME patterns are tested
 * first, so a path matching both (a hypothetical /marketplace/sme, say)
 * resolves to "sme". These tests pin that precedence, the word-boundary
 * behaviour, and the real app routes under app/dashboard/{sme,investor} and
 * app/marketplace.
 *
 * The tracker helpers are covered too, since they read the cohort
 * themselves: a route change must be reflected in the event payload.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  detectInstallCohort,
  trackInstallPromptShown,
  trackInstallPromptAccepted,
  trackInstallPromptDismissed,
  getLocalInstallPromptEvents,
} from "@/lib/installPromptAnalytics";

const EVENTS_KEY = "kora-install-prompt-events";

/**
 * Point `window.location.pathname` at a route so the no-argument overload of
 * `detectInstallCohort` and the trackers read it.
 */
function setPathname(pathname: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...window.location, pathname, href: `http://localhost${pathname}` },
  });
}

describe("detectInstallCohort — sme", () => {
  it.each([
    "/dashboard/sme",
    "/dashboard/sme/",
    "/dashboard/sme/invoices",
    "/dashboard/sme/portfolio",
    // The module also matches a bare /sme segment, so the segment rule is
    // pinned independently of the dashboard prefix.
    "/sme",
    "/sme/dashboard",
  ])("maps %s to sme", (path) => {
    expect(detectInstallCohort(path)).toBe("sme");
  });

  it("matches case-insensitively", () => {
    expect(detectInstallCohort("/DASHBOARD/SME")).toBe("sme");
    expect(detectInstallCohort("/Dashboard/Sme")).toBe("sme");
  });

  it("does not require a boundary after /sme for the dashboard form", () => {
    // /dashboard/sme-profile is a different section, but the dashboard
    // pattern is a plain prefix match, so it still segments as sme.
    expect(detectInstallCohort("/dashboard/sme-profile")).toBe("sme");
  });
});

describe("detectInstallCohort — investor", () => {
  it.each([
    "/dashboard/investor",
    "/dashboard/investor/",
    "/dashboard/investor/positions",
    "/marketplace",
    "/marketplace/",
    "/marketplace/inv-001",
    "/investor",
    "/investor/summary",
  ])("maps %s to investor", (path) => {
    expect(detectInstallCohort(path)).toBe("investor");
  });

  it("matches case-insensitively", () => {
    expect(detectInstallCohort("/MARKETPLACE")).toBe("investor");
    expect(detectInstallCohort("/Dashboard/Investor")).toBe("investor");
  });

  it("matches the marketplace detail route", () => {
    // app/marketplace/[id] — the concrete ID must not break the prefix match.
    expect(detectInstallCohort("/marketplace/abc-123-def")).toBe("investor");
  });
});

describe("detectInstallCohort — unknown", () => {
  it.each([
    "/",
    "/about",
    "/settings",
    "/analytics",
    "/transactions",
    "/offline",
    "/secondary",
    "/invoice/create",
    // Word-boundary guard: the `\b` only stops a *letter* directly after
    // the cohort word, so a longer segment is not a cohort…
    "/smeg",
    "/investors",
    // …but it does not anchor to a path segment, so a hyphen/dot after the
    // word still counts as a boundary. These are documented below.
  ])("maps %s to unknown", (path) => {
    expect(detectInstallCohort(path)).toBe("unknown");
  });

  it("maps an empty pathname to unknown", () => {
    expect(detectInstallCohort("")).toBe("unknown");
  });

  it.each([
    ["/blog/sme-growth-tips", "sme"],
    ["/help/investor-faq", "investor"],
  ])("treats %s as %s because \\b matches a hyphen", (path, cohort) => {
    // A hyphen is a word boundary, so the `\b` in `/sme\b` is satisfied by
    // "/sme-growth". The patterns are prefix-based rather than
    // segment-based; this is the existing behaviour and is pinned so a
    // change to it is a deliberate decision rather than an accident.
    expect(detectInstallCohort(path as string)).toBe(cohort);
  });
});

describe("detectInstallCohort — precedence", () => {
  it("resolves to sme when a path matches both cohorts", () => {
    // The SME check runs first, so it wins. Pinning this means a future
    // reorder of the two `if` blocks is caught.
    expect(detectInstallCohort("/marketplace/sme")).toBe("sme");
    expect(detectInstallCohort("/investor/sme")).toBe("sme");
  });

  it("prefers the dashboard/investor form over a later marketplace segment", () => {
    // Both alternatives sit inside the same investor branch, so the cohort is
    // investor either way — asserted so a refactor cannot drop one of them.
    expect(detectInstallCohort("/dashboard/investor/marketplace")).toBe("investor");
  });
});

describe("detectInstallCohort — default argument", () => {
  afterEach(() => {
    setPathname("/");
  });

  it("reads window.location.pathname when called with no argument", () => {
    setPathname("/dashboard/sme");
    expect(detectInstallCohort()).toBe("sme");
  });

  it("reads an investor route when called with no argument", () => {
    setPathname("/marketplace");
    expect(detectInstallCohort()).toBe("investor");
  });

  it("reads an unrelated route as unknown when called with no argument", () => {
    setPathname("/settings");
    expect(detectInstallCohort()).toBe("unknown");
  });

  it("prefers an explicit argument over window.location", () => {
    setPathname("/dashboard/sme");
    expect(detectInstallCohort("/marketplace")).toBe("investor");
  });
});

describe("install prompt trackers", () => {
  beforeEach(() => {
    localStorage.removeItem(EVENTS_KEY);
    delete (window as unknown as Record<string, unknown>).gtag;
    delete (window as unknown as Record<string, unknown>).plausible;
  });

  afterEach(() => {
    setPathname("/");
  });

  it("stamps the cohort detected from the current route", () => {
    setPathname("/dashboard/sme");
    trackInstallPromptShown(1);
    trackInstallPromptAccepted(2);
    trackInstallPromptDismissed(3);

    const events = getLocalInstallPromptEvents();
    expect(events.map((e) => e.name)).toEqual([
      "install_prompt_shown",
      "install_prompt_accepted",
      "install_prompt_dismissed",
    ]);
    // The route is read per call, so a mid-session navigation is captured.
    expect(events.every((e) => e.cohort === "sme")).toBe(true);
  });

  it("segments each event by the route at the time it fires", () => {
    setPathname("/dashboard/sme");
    trackInstallPromptShown(1);

    setPathname("/marketplace");
    trackInstallPromptAccepted(1);

    setPathname("/about");
    trackInstallPromptDismissed(1);

    expect(getLocalInstallPromptEvents().map((e) => e.cohort)).toEqual([
      "sme",
      "investor",
      "unknown",
    ]);
  });

  it("preserves the visit count on every event", () => {
    trackInstallPromptShown(4);
    trackInstallPromptAccepted(5);
    trackInstallPromptDismissed(6);

    expect(getLocalInstallPromptEvents().map((e) => e.visitCount)).toEqual([4, 5, 6]);
  });

  it("appends to the existing log rather than replacing it", () => {
    trackInstallPromptShown(1);
    trackInstallPromptShown(2);
    expect(getLocalInstallPromptEvents()).toHaveLength(2);
  });

  it("returns an empty list when nothing has been tracked", () => {
    expect(getLocalInstallPromptEvents()).toEqual([]);
  });

  it("returns an empty list when the stored log is corrupt", () => {
    // A bad payload must not throw out of a debug panel.
    localStorage.setItem(EVENTS_KEY, "{not json");
    expect(getLocalInstallPromptEvents()).toEqual([]);
  });

  it("records a numeric timestamp on each event", () => {
    trackInstallPromptShown(1);
    const [event] = getLocalInstallPromptEvents();
    expect(typeof event.timestamp).toBe("number");
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it("forwards the cohort to gtag when the SDK is present", () => {
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    setPathname("/marketplace");

    trackInstallPromptAccepted(2);

    expect(gtag).toHaveBeenCalledWith("event", "install_prompt_accepted", {
      cohort: "investor",
      visit_count: 2,
    });
    // The local log is still written so the metric survives without an SDK.
    expect(getLocalInstallPromptEvents()).toHaveLength(1);
  });

  it("forwards the cohort to plausible when the SDK is present", () => {
    const plausible = vi.fn();
    (window as unknown as Record<string, unknown>).plausible = plausible;
    setPathname("/dashboard/sme");

    trackInstallPromptShown(7);

    expect(plausible).toHaveBeenCalledWith("install_prompt_shown", {
      props: { cohort: "sme", visitCount: 7 },
    });
  });

  it("does not break the install flow when localStorage throws", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    // Analytics must never break the prompt; a storage failure is swallowed.
    expect(() => trackInstallPromptShown(1)).not.toThrow();
    setItem.mockRestore();
  });
});
