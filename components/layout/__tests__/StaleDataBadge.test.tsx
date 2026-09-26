/**
 * Stale-data badge (issue #819).
 *
 * The badge tells a user their figures are coming from cache rather than the
 * network, so the two things that matter are when it stays silent (online, or
 * nothing cached) and how the full and compact forms differ — the compact form
 * is what gets embedded inside invoice and listing cards, so it has to be
 * shorter without losing the timestamp.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const { networkMessages, useNetworkStatus } = vi.hoisted(() => ({
  // Copied from messages/en.json so the assertions are about the copy a user
  // reads rather than about translation keys.
  networkMessages: {
    offlineCached: "Offline - showing cached data",
    offlineCachedShort: "Cached data",
    lastUpdated: "Last updated {time}",
  },
  useNetworkStatus: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    if (namespace !== "network") {
      throw new Error(`StaleDataBadge asked for the wrong namespace: ${namespace}`);
    }
    return (key: string, values?: Record<string, string | number>) => {
      let out = (networkMessages as Record<string, string>)[key] ?? key;
      for (const [name, value] of Object.entries(values ?? {})) {
        out = out.replace(`{${name}}`, String(value));
      }
      return out;
    };
  },
}));

vi.mock("@/hooks/useNetworkStatus", () => ({ useNetworkStatus }));

import { StaleDataBadge } from "../StaleDataBadge";

const NOW = new Date("2024-05-01T12:00:00.000Z");
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function goOffline() {
  useNetworkStatus.mockReturnValue({ isOnline: false, wasOffline: true });
}

describe("StaleDataBadge", () => {
  beforeEach(() => {
    // Freeze only the clock: relative-time wording has to be asserted as a
    // literal, and faking timers as well would fight React's act().
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    goOffline();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays silent while the user is online", () => {
    useNetworkStatus.mockReturnValue({ isOnline: true, wasOffline: false });

    const { container } = render(<StaleDataBadge updatedAt={NOW.getTime() - 5 * MINUTE} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["zero", 0],
  ])("stays silent while offline when the cached timestamp is %s", (_label, updatedAt) => {
    const { container } = render(<StaleDataBadge updatedAt={updatedAt} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("explains that the figures are cached in the full form", () => {
    render(<StaleDataBadge updatedAt={NOW.getTime() - 5 * MINUTE} />);

    expect(screen.getByText("Offline - showing cached data")).toBeInTheDocument();
    expect(screen.getByText("Last updated 5 minutes ago")).toBeInTheDocument();
  });

  it("uses the short label in the compact form but keeps the timestamp", () => {
    render(<StaleDataBadge updatedAt={NOW.getTime() - 3 * HOUR} compact />);

    expect(screen.getByText("Cached data")).toBeInTheDocument();
    expect(screen.getByText("Last updated about 3 hours ago")).toBeInTheDocument();
    expect(screen.queryByText("Offline - showing cached data")).toBeNull();
  });

  it("tightens the padding and type size in the compact form", () => {
    const { rerender } = render(<StaleDataBadge updatedAt={NOW.getTime()} />);
    const full = screen.getByRole("status").className;

    rerender(<StaleDataBadge updatedAt={NOW.getTime()} compact />);
    const compact = screen.getByRole("status").className;

    expect(compact).toContain("px-2.5");
    expect(compact).toContain("text-[11px]");
    expect(full).toContain("px-3");
    expect(full).not.toContain("text-[11px]");
  });

  it("describes staleness in words rather than a raw timestamp", () => {
    render(<StaleDataBadge updatedAt={NOW.getTime() - 5 * MINUTE} />);

    expect(screen.getByRole("status").textContent).not.toContain(String(NOW.getTime()));
  });

  it("announces politely so a screen reader picks up the state change", () => {
    render(<StaleDataBadge updatedAt={NOW.getTime() - 5 * MINUTE} />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-live", "polite");
  });

  it("merges a caller-supplied className", () => {
    render(
      <StaleDataBadge updatedAt={NOW.getTime()} className="mt-2 w-full justify-center" />
    );

    const badge = screen.getByRole("status");
    expect(badge.className).toContain("mt-2");
    expect(badge.className).toContain("w-full");
    expect(badge.className).toContain("inline-flex");
  });
});
