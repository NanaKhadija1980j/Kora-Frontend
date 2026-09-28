/**
 * Screenshot / snapshot baselines for AnalyticsCharts stories.
 *
 * Why this exists
 * ───────────────
 * The existing stories.snapshot.test.tsx covers UI primitives and
 * InvoiceCard but not the Recharts-heavy analytics charts. Recharts renders
 * SVG paths whose `d` attribute is computed from data — any change to axis
 * scaling, tick formatting, color helpers, or chart layout shows up here as
 * a snapshot diff, giving us a visual-regression safety net without needing
 * a running browser.
 *
 * Each story exported from AnalyticsCharts.stories.tsx gets its own
 * `toMatchSnapshot()` assertion. Run with -u to regenerate baselines.
 *
 * Determinism measures
 * ─────────────────────
 * • framer-motion is fully mocked (motion.div → plain div) so animation
 *   state doesn't affect the snapshot.
 * • Recharts ResponsiveContainer is mocked to a fixed 800×400 so SVG path
 *   computations are identical across environments.
 * • Date.now() is frozen so any timestamp-derived labels are stable.
 * • next-intl is mocked with a deterministic `charts.empty.*` catalog so the
 *   localized empty-state copy is stable across locales/environments.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import type { Meta, StoryObj } from "@storybook/react";

// ─── Fixed clock ──────────────────────────────────────────────────────────────
vi.useFakeTimers({ now: new Date("2025-06-01T00:00:00Z").getTime() });

// ─── next-intl stub: deterministic localized empty-state copy ─────────────────
// AnalyticsCharts now resolves empty states via t("charts.empty.*"). Mock the
// translator so snapshots capture the localized keys rather than depending on
// a real message catalog being loaded in the test environment.
const EMPTY_MESSAGES: Record<string, string> = {
  "charts.empty.default": "No data available",
  "charts.empty.portfolio": "No portfolio data yet",
  "charts.empty.revenue": "No revenue data yet",
  "charts.empty.expenses": "No expense data yet",
  "charts.empty.invoices": "No invoice data yet",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const template = EMPTY_MESSAGES[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (_m, name: string) =>
      name in values ? String(values[name]) : `{${name}}`
    );
  },
}));

// ─── framer-motion stub ───────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({ children, ...rest }: any) =>
          React.createElement(tag as any, rest, children),
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}));

// ─── Recharts stub: fixed container size for deterministic SVG paths ──────────
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode; height?: number }) =>
      React.createElement("div", { style: { width: 800, height: 400 } }, children),
  };
});

// ─── Story helpers ────────────────────────────────────────────────────────────
type AnyMeta = Meta<any>;
type AnyStory = StoryObj<AnyMeta>;

function composeStory(story: AnyStory, meta: AnyMeta): React.ReactElement {
  const Component = meta.component as React.ComponentType<any>;
  const args = { ...(meta.args ?? {}), ...(story.args ?? {}) };

  let element: React.ReactElement;
  if (story.render) {
    element = story.render(args, {} as any) as React.ReactElement;
  } else if (Component) {
    element = <Component {...args} />;
  } else {
    element = <></>;
  }

  const decorators = [
    ...(story.decorators ?? []),
    ...(meta.decorators ?? []),
  ].reverse() as Array<(s: () => React.ReactElement) => React.ReactElement>;

  return decorators.reduce<React.ReactElement>(
    (el, decorator) => decorator(() => el) as React.ReactElement,
    element
  );
}

// ─── Story imports ────────────────────────────────────────────────────────────
import AnalyticsChartsMeta, * as AnalyticsChartsStories from "@/components/analytics/AnalyticsCharts.stories";

function getStoryExports(module: Record<string, any>): [string, AnyStory][] {
  return Object.entries(module).filter(
    ([key, value]) =>
      key !== "default" &&
      typeof value === "object" &&
      value !== null &&
      (typeof value.render === "function" || "args" in value)
  ) as [string, AnyStory][];
}

// ─── Snapshot suite ───────────────────────────────────────────────────────────

describe("Storybook snapshots — AnalyticsCharts (visual regression baselines)", () => {
  const stories = getStoryExports(AnalyticsChartsStories as any);

  it.each(stories)("%s", (_name, story) => {
    const element = composeStory(story, AnalyticsChartsMeta);
    const { container } = render(element);
    expect(container.firstChild).toMatchSnapshot();
  });
});
