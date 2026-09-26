/**
 * Storybook Story Snapshot Tests
 *
 * Strategy
 * ────────
 * We import every story file, compose each exported story into a React element
 * using its `render` function or `args`, and call `toMatchSnapshot()`.
 *
 * This gives us:
 *   - Deterministic output — no random IDs, no live timestamps, no network
 *   - Fast feedback — pure jsdom render, no browser required
 *   - CI gate — Vitest fails when the rendered HTML of any story changes
 *
 * Why Vitest instead of @storybook/test-runner?
 * ──────────────────────────────────────────────
 * test-runner requires a running Storybook server and a Playwright browser,
 * making it expensive to run in CI alongside the existing unit/integration
 * suite.  Vitest snapshots run in jsdom, are fast, and fit naturally into the
 * existing `npm test` script.
 *
 * Determinism measures
 * ────────────────────
 * • Date.now() is frozen to a fixed epoch (2025-03-15T12:00:00Z) so that any
 *   story that derives dates from "now" (e.g. PositionDetailDrawer active
 *   position, OverduePosition) produces a stable snapshot.
 * • framer-motion is mocked globally (in vitest.setup.ts) via the framer-motion
 *   mock already present for other tests.
 * • Radix UI portals (Dialog, Tooltip popover) render their content into the
 *   jsdom body — snapshots capture only the trigger element rendered in the
 *   story tree, which is stable.
 *
 * Update snapshots
 * ────────────────
 * See CONTRIBUTING.md → "Updating Story Snapshots" for the exact command.
 * Short form:
 *   npx vitest run --reporter=verbose --project=default \
 *     __tests__/stories.snapshot.test.tsx -u
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import type { StoryObj, Meta } from "@storybook/react";

// ─── Fixed clock ──────────────────────────────────────────────────────────────
// ISO: 2025-03-15T12:00:00.000Z
const FIXED_NOW_MS = 1742040000000;

// ─── Helper: compose a Storybook story into a React element ───────────────────

type AnyMeta = Meta<any>;
type AnyStory = StoryObj<AnyMeta>;

/**
 * Resolves a story to a React element that can be passed to `render()`.
 *
 * Storybook stories can expose their UI in two ways:
 *   1. A `render` function:  `render: (args) => <Component {...args} />`
 *   2. A `args` object:      the meta's `component` is rendered with those args
 *
 * We support both, with the meta's `decorators` applied around the result.
 */
function composeStory(story: AnyStory, meta: AnyMeta): React.ReactElement {
  const Component = meta.component as React.ComponentType<any>;
  const args = { ...(meta.args ?? {}), ...(story.args ?? {}) };

  let element: React.ReactElement;

  if (story.render) {
    element = story.render(args, {} as any) as React.ReactElement;
  } else if (Component) {
    element = <Component {...args} />;
  } else {
    // Fallback: empty fragment (shouldn't happen in practice)
    element = <></>;
  }

  // Apply story-level decorators (innermost first), then meta-level decorators
  const decorators = [
    ...(story.decorators ?? []),
    ...(meta.decorators ?? []),
  ].reverse() as Array<(story: () => React.ReactElement) => React.ReactElement>;

  return decorators.reduce<React.ReactElement>(
    (el, decorator) => decorator(() => el) as React.ReactElement,
    element
  );
}

/**
 * Render a composed story and return its HTML container.
 * We use `container.innerHTML` for the snapshot because it captures the full
 * rendered subtree without the wrapping `<div>` that RTL always adds.
 */
function renderStory(story: AnyStory, meta: AnyMeta) {
  const element = composeStory(story, meta);
  return render(element);
}

// ─── Module mocks (must be before dynamic imports) ────────────────────────────

// Freeze Date to make story snapshots deterministic
vi.useFakeTimers({ now: FIXED_NOW_MS });

// Tooltip / Popover portals need a document.body — provided by jsdom.
// We suppress Radix "missing TooltipProvider" warnings for isolated stories.
vi.mock("@radix-ui/react-tooltip", async (importOriginal) => {
  const original = await importOriginal<typeof import("@radix-ui/react-tooltip")>();
  return {
    ...original,
    TooltipProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// Framer-motion: already mocked globally in vitest.setup.ts.
// We add a local override for useReducedMotion to be explicit.
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) =>
        ({ children, ...rest }: any) =>
          React.createElement(tag as any, rest, children),
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}));

// Mock react-dropzone for FileInput stories — useDropzone hook works in jsdom
// but we mock it to avoid any side effects from DataTransfer/FileReader APIs.
vi.mock("react-dropzone", () => ({
  useDropzone: ({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    disabled,
  }: {
    onDrop: (acceptedFiles: File[], rejectedFiles: any[]) => void;
    accept?: Record<string, string[]>;
    maxFiles?: number;
    maxSize?: number;
    disabled?: boolean;
  }) => {
    const getRootProps = () => ({
      onDrop: (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && !disabled) {
          onDrop(files, []);
        }
      },
      onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      },
      onDragEnter: (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
      },
      onClick: () => {},
    });
    const getInputProps = () => ({
      type: "file",
      accept: accept ? Object.keys(accept).join(",") : undefined,
      multiple: maxFiles !== 1,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length > 0 && !disabled) {
          onDrop(files, []);
        }
      },
      style: { display: "none" },
    });
    return { getRootProps, getInputProps, isDragActive: false };
  },
}));

// ─── Story imports ────────────────────────────────────────────────────────────
// Static imports so Vitest can tree-shake and type-check story files.

import BadgeMeta, * as BadgeStories from "@/components/ui/badge.stories";
import ButtonMeta, * as ButtonStories from "@/components/ui/button.stories";
import CardMeta, * as CardStories from "@/components/ui/card.stories";
import DataTableMeta, * as DataTableStories from "@/components/ui/data-table.stories";
import DatePickerMeta, * as DatePickerStories from "@/components/ui/date-picker.stories";
import DialogMeta, * as DialogStories from "@/components/ui/dialog.stories";
import DrawerMeta, * as DrawerStories from "@/components/ui/drawer.stories";
import EmptyStateMeta, * as EmptyStateStories from "@/components/ui/EmptyState.stories";
import FileInputMeta, * as FileInputStories from "@/components/ui/file-input.stories";
import InputMeta, * as InputStories from "@/components/ui/input.stories";
import PaginationMeta, * as PaginationStories from "@/components/ui/pagination.stories";
import ProgressMeta, * as ProgressStories from "@/components/ui/progress.stories";
import RangeSliderMeta, * as RangeSliderStories from "@/components/ui/range-slider.stories";
import SelectMeta, * as SelectStories from "@/components/ui/select.stories";
import SkeletonMeta, * as SkeletonStories from "@/components/ui/skeleton.stories";
import StatCardMeta, * as StatCardStories from "@/components/ui/stat-card.stories";
import TextareaMeta, * as TextareaStories from "@/components/ui/textarea.stories";
import TooltipMeta, * as TooltipStories from "@/components/ui/tooltip.stories";
import BottomSheetMeta, * as BottomSheetStories from "@/components/ui/bottom-sheet.stories";
import PositionDetailDrawerMeta, * as PositionDetailDrawerStories from "@/components/invoice/PositionDetailDrawer.stories";
import VerificationModalMeta, * as VerificationModalStories from "@/components/wallet/VerificationModal.stories";
import WalletBalanceMeta, * as WalletBalanceStories from "@/components/wallet/WalletBalance.stories";
import TransactionToastsMeta, * as TransactionToastsStories from "@/components/transactions/TransactionToasts.stories";
import TransactionHistoryDrawerMeta, * as TransactionHistoryDrawerStories from "@/components/transactions/TransactionHistoryDrawer.stories";

// ─── Helper: extract named story exports (skip "default") ─────────────────────

function getStoryExports(module: Record<string, any>): [string, AnyStory][] {
  return Object.entries(module).filter(
    ([key, value]) =>
      key !== "default" &&
      typeof value === "object" &&
      value !== null &&
      (typeof value.render === "function" || "args" in value)
  ) as [string, AnyStory][];
}

// ─── Snapshot suites ──────────────────────────────────────────────────────────

describe("Storybook snapshots — UI primitives", () => {
  // Badge
  describe("Badge", () => {
    const stories = getStoryExports(BadgeStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, BadgeMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Button
  describe("Button", () => {
    const stories = getStoryExports(ButtonStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, ButtonMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Card
  describe("Card", () => {
    const stories = getStoryExports(CardStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, CardMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Input
  describe("Input", () => {
    const stories = getStoryExports(InputStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, InputMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Textarea
  describe("Textarea", () => {
    const stories = getStoryExports(TextareaStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, TextareaMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Select
  describe("Select", () => {
    const stories = getStoryExports(SelectStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, SelectMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Skeleton
  describe("Skeleton", () => {
    const stories = getStoryExports(SkeletonStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, SkeletonMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Badge (progress)
  describe("Progress", () => {
    const stories = getStoryExports(ProgressStories as any);
    it.each(stories)("%s", (_name, story) => {
      // Progress uses the ProgressMeta but also exports InvoiceFundingProgress
      // stories under the same file — use the meta as-is
      const { container } = renderStory(story, ProgressMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // StatCard
  describe("StatCard", () => {
    const stories = getStoryExports(StatCardStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, StatCardMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // EmptyState
  describe("EmptyState", () => {
    const stories = getStoryExports(EmptyStateStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, EmptyStateMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // RangeSlider
  describe("RangeSlider", () => {
    // WithHistogram uses Math.random() to build histogram bars — we must seed
    // it before each render to avoid non-deterministic snapshots.
    beforeAll(() => {
      let seed = 42;
      vi.spyOn(Math, "random").mockImplementation(() => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      });
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    const stories = getStoryExports(RangeSliderStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, RangeSliderMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Pagination
  describe("Pagination", () => {
    const stories = getStoryExports(PaginationStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, PaginationMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Dialog
  describe("Dialog", () => {
    // Dialogs render their content via Radix portals; we snapshot the trigger
    // element only (which is stable).
    const stories = getStoryExports(DialogStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, DialogMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Tooltip
  describe("Tooltip", () => {
    const stories = getStoryExports(TooltipStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, TooltipMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // DataTable
  describe("DataTable", () => {
    const stories = getStoryExports(DataTableStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, DataTableMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // BottomSheet
  describe("BottomSheet", () => {
    const stories = getStoryExports(BottomSheetStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, BottomSheetMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // Drawer
  describe("Drawer", () => {
    const stories = getStoryExports(DrawerStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, DrawerMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // FileInput
  describe("FileInput", () => {
    const stories = getStoryExports(FileInputStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, FileInputMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // DatePicker
  describe("DatePicker", () => {
    const stories = getStoryExports(DatePickerStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, DatePickerMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});

// ─── Invoice components ───────────────────────────────────────────────────────

describe("Storybook snapshots — Invoice components", () => {
  describe("PositionDetailDrawer", () => {
    /**
     * The ActivePosition and OverduePosition stories derive dates from
     * Date.now() (e.g. `new Date(Date.now() + 120 * …).toISOString()`).
     *
     * vi.useFakeTimers({ now: FIXED_NOW_MS }) at the top of this file ensures
     * that Date.now() returns our fixed epoch for the full test run, making
     * these snapshots deterministic.
     */
    const stories = getStoryExports(PositionDetailDrawerStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, PositionDetailDrawerMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});

describe("Storybook snapshots — Wallet and transaction components", () => {
  describe("VerificationModal", () => {
    const stories = getStoryExports(VerificationModalStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, VerificationModalMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe("WalletBalance", () => {
    const stories = getStoryExports(WalletBalanceStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, WalletBalanceMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe("TransactionToasts", () => {
    const stories = getStoryExports(TransactionToastsStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, TransactionToastsMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe("TransactionHistoryDrawer", () => {
    const stories = getStoryExports(TransactionHistoryDrawerStories as any);
    it.each(stories)("%s", (_name, story) => {
      const { container } = renderStory(story, TransactionHistoryDrawerMeta);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
