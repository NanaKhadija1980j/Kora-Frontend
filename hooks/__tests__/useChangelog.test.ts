/**
 * Unit tests for useChangelog Keep-a-Changelog parser (issue #798).
 *
 * Covers:
 *  - parseChangelog correctly parses version headers with dates
 *  - parseChangelog handles "Unreleased" section (skips it)
 *  - parseChangelog correctly categorizes sections (Added, Fixed, Changed, Breaking, etc.)
 *  - parseChangelog handles list items under sections
 *  - parseChangelog handles plain paragraph text as "other" items
 *  - parseChangelog returns empty array for empty/invalid markdown
 *  - useChangelog hook returns correct open state based on localStorage
 *  - useChangelog hook dismiss function marks version as seen
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { parseChangelog, useChangelog } from "@/hooks/useChangelog";

// Mock UIStore
const mockChangelogOpen = false;
const mockSetChangelogOpen = vi.fn();

vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (s: { changelogOpen: boolean; setChangelogOpen: typeof mockSetChangelogOpen }) => unknown) =>
    selector({ changelogOpen: mockChangelogOpen, setChangelogOpen: mockSetChangelogOpen }),
}));

const SAMPLE_CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2024-01-15

### Added
- New dashboard analytics widget
- Support for dark mode toggle
- Export to PDF functionality

### Fixed
- Memory leak in invoice polling
- Incorrect APR calculation for partial fills

### Changed
- Updated UI library to v3.2
- Improved wallet connection flow

### Breaking Changes
- Removed deprecated API v1 endpoints
- Changed invoice ID format from UUID to ULID

## [2.0.0] - 2023-12-01

### Added
- Multi-signature wallet support
- Batch transaction processing

### Fixed
- Race condition in transaction simulation

## [Unreleased]

### Added
- Upcoming feature preview

`;

describe("parseChangelog", () => {
  it("parses multiple releases with sections and items", () => {
    const releases = parseChangelog(SAMPLE_CHANGELOG);

    expect(releases).toHaveLength(2); // Unreleased is skipped

    // First release: 2.1.0
    const v210 = releases[0];
    expect(v210.version).toBe("2.1.0");
    expect(v210.date).toBe("2024-01-15");
    expect(v210.sections).toHaveLength(4);

    // Check Added section
    const added = v210.sections.find((s) => s.type === "features");
    expect(added).toBeDefined();
    expect(added?.label).toBe("New Features");
    expect(added?.items).toEqual([
      "New dashboard analytics widget",
      "Support for dark mode toggle",
      "Export to PDF functionality",
    ]);

    // Check Fixed section
    const fixed = v210.sections.find((s) => s.type === "fixes");
    expect(fixed).toBeDefined();
    expect(fixed?.label).toBe("Bug Fixes");
    expect(fixed?.items).toEqual([
      "Memory leak in invoice polling",
      "Incorrect APR calculation for partial fills",
    ]);

    // Check Changed section
    const changed = v210.sections.find((s) => s.type === "other");
    expect(changed).toBeDefined();
    expect(changed?.label).toBe("Changed"); // parseSectionLabel returns heading as-is for "Changed"
    expect(changed?.items).toEqual([
      "Updated UI library to v3.2",
      "Improved wallet connection flow",
    ]);

    // Check Breaking Changes section
    const breaking = v210.sections.find((s) => s.type === "breaking");
    expect(breaking).toBeDefined();
    expect(breaking?.label).toBe("Breaking Changes");
    expect(breaking?.items).toEqual([
      "Removed deprecated API v1 endpoints",
      "Changed invoice ID format from UUID to ULID",
    ]);

    // Second release: 2.0.0
    const v200 = releases[1];
    expect(v200.version).toBe("2.0.0");
    expect(v200.date).toBe("2023-12-01");
    expect(v200.sections).toHaveLength(2);

    const added2 = v200.sections.find((s) => s.type === "features");
    expect(added2?.items).toEqual([
      "Multi-signature wallet support",
      "Batch transaction processing",
    ]);

    const fixed2 = v200.sections.find((s) => s.type === "fixes");
    expect(fixed2?.items).toEqual(["Race condition in transaction simulation"]);
  });

  it("skips Unreleased section", () => {
    const releases = parseChangelog(SAMPLE_CHANGELOG);
    const unreleased = releases.find((r) => r.version.toLowerCase() === "unreleased");
    expect(unreleased).toBeUndefined();
  });

  it("handles version header without date", () => {
    const markdown = `## [1.0.0]
### Added
- Initial release
`;
    const releases = parseChangelog(markdown);
    expect(releases).toHaveLength(1);
    expect(releases[0].version).toBe("1.0.0");
    expect(releases[0].date).toBe("");
  });

  it("handles section headings with different casing", () => {
    const markdown = `## [1.0.0] - 2024-01-01
### added
- Feature A
### FIXED
- Bug B
### BREAKING CHANGES
- Big change
`;
    const releases = parseChangelog(markdown);
    const sections = releases[0].sections;
    expect(sections.find((s) => s.type === "features")?.items).toEqual(["Feature A"]);
    expect(sections.find((s) => s.type === "fixes")?.items).toEqual(["Bug B"]);
    expect(sections.find((s) => s.type === "breaking")?.items).toEqual(["Big change"]);
  });

  it("handles list items with different bullet styles", () => {
    const markdown = `## [1.0.0] - 2024-01-01
### Added
- Dash bullet
* Asterisk bullet
`;
    const releases = parseChangelog(markdown);
    expect(releases[0].sections[0].items).toEqual(["Dash bullet", "Asterisk bullet"]);
  });

  it("treats plain paragraph text as 'other' items when no section exists", () => {
    const markdown = `## [1.0.0] - 2024-01-01
Some introductory text without a section header.
- List item
`;
    const releases = parseChangelog(markdown);
    const otherSection = releases[0].sections.find((s) => s.type === "other");
    expect(otherSection).toBeDefined();
    expect(otherSection?.items).toContain("Some introductory text without a section header.");
    expect(otherSection?.items).toContain("List item");
  });

  it("returns empty array for empty markdown", () => {
    expect(parseChangelog("")).toEqual([]);
    expect(parseChangelog("   ")).toEqual([]);
    expect(parseChangelog("# Not a version header")).toEqual([]);
  });

  it("handles sections with no items", () => {
    const markdown = `## [1.0.0] - 2024-01-01
### Added
### Fixed
- Bug fixed
`;
    const releases = parseChangelog(markdown);
    const added = releases[0].sections.find((s) => s.type === "features");
    const fixed = releases[0].sections.find((s) => s.type === "fixes");
    expect(added?.items).toEqual([]);
    expect(fixed?.items).toEqual(["Bug fixed"]);
  });

  it("correctly maps section labels", () => {
    const testCases = [
      { heading: "Added", expected: "New Features" },
      { heading: "New Features", expected: "New Features" },
      { heading: "Features", expected: "New Features" },
      { heading: "Fixed", expected: "Bug Fixes" },
      { heading: "Bug Fixes", expected: "Bug Fixes" },
      { heading: "Fixed Bugs", expected: "Bug Fixes" },
      { heading: "Breaking Changes", expected: "Breaking Changes" },
      { heading: "BREAKING", expected: "Breaking Changes" },
      { heading: "Changed", expected: "Changed" },
      { heading: "Deprecated", expected: "Deprecated" },
      { heading: "Removed", expected: "Removed" },
      { heading: "Security", expected: "Security" }, // falls through to "other"
    ];

    for (const tc of testCases) {
      const markdown = `## [1.0.0] - 2024-01-01
### ${tc.heading}
- Item
`;
      const releases = parseChangelog(markdown);
      const section = releases[0].sections[0];
      expect(section.label).toBe(tc.expected);
    }
  });
});

describe("useChangelog hook", () => {
  const TEST_VERSION = "2.1.0";

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockSetChangelogOpen.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("returns isOpen=false when version has been seen", () => {
    localStorage.setItem("kora-changelog-seen-version", TEST_VERSION);
    const { result } = renderHook(() => useChangelog(TEST_VERSION));
    expect(result.current.isOpen).toBe(false);
  });

  it("returns isOpen=true when version has not been seen", () => {
    const { result } = renderHook(() => useChangelog(TEST_VERSION));
    expect(result.current.isOpen).toBe(true);
  });

  it("returns isOpen=true when localStorage is empty", () => {
    const { result } = renderHook(() => useChangelog(TEST_VERSION));
    expect(result.current.isOpen).toBe(true);
  });

  it("dismiss sets localStorage and closes modal", () => {
    const { result } = renderHook(() => useChangelog(TEST_VERSION));
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(localStorage.getItem("kora-changelog-seen-version")).toBe(TEST_VERSION);
    expect(result.current.isOpen).toBe(false);
    expect(mockSetChangelogOpen).toHaveBeenCalledWith(false);
  });

  it("dismiss works when called multiple times", () => {
    const { result } = renderHook(() => useChangelog(TEST_VERSION));

    act(() => {
      result.current.dismiss();
    });
    act(() => {
      result.current.dismiss();
    });

    expect(localStorage.getItem("kora-changelog-seen-version")).toBe(TEST_VERSION);
    expect(mockSetChangelogOpen).toHaveBeenCalledTimes(2);
  });

  it("respects changelogOpen from UIStore", async () => {
    // Re-mock with changelogOpen = true
    vi.resetModules();
    vi.doMock("@/store/uiStore", () => ({
      useUIStore: (selector: (s: { changelogOpen: boolean; setChangelogOpen: typeof mockSetChangelogOpen }) => unknown) =>
        selector({ changelogOpen: true, setChangelogOpen: mockSetChangelogOpen }),
    }));

    const { useChangelog: useChangelogFresh } = await import("@/hooks/useChangelog");
    localStorage.setItem("kora-changelog-seen-version", TEST_VERSION);
    const { result } = renderHook(() => useChangelogFresh(TEST_VERSION));
    expect(result.current.isOpen).toBe(true); // UIStore overrides
  });
});