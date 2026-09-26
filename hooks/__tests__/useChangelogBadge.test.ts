import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useChangelogBadge } from "../useChangelogBadge";
import { useUIStore } from "@/store/uiStore";

const SEEN_KEY = "kora-changelog-seen-version";
const LATEST = "1.2.0";

const CHANGELOG = `# Changelog

## [Unreleased]

## [${LATEST}] - 2026-01-15
### Added
- New dashboard widgets

## [1.1.0] - 2025-12-01
### Fixed
- A bug fix
`;

function okResponse(text: string) {
  return { ok: true, text: () => Promise.resolve(text) };
}

describe("useChangelogBadge", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ changelogOpen: false });
    fetchMock = vi.fn().mockResolvedValue(okResponse(CHANGELOG));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the seen version from localStorage on mount", async () => {
    localStorage.setItem(SEEN_KEY, LATEST);

    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.latestVersion).toBe(LATEST));
    expect(result.current.hasUnread).toBe(false);
  });

  it("reports unread when no seen version has been stored", async () => {
    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.latestVersion).toBe(LATEST));
    expect(result.current.hasUnread).toBe(true);
  });

  it("reports unread when the stored seen version is older than the latest", async () => {
    localStorage.setItem(SEEN_KEY, "1.1.0");

    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.latestVersion).toBe(LATEST));
    expect(result.current.hasUnread).toBe(true);
  });

  it("writes the latest version to localStorage when markSeen is called", async () => {
    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.latestVersion).toBe(LATEST));

    act(() => {
      result.current.markSeen();
    });

    expect(localStorage.getItem(SEEN_KEY)).toBe(LATEST);
    expect(result.current.hasUnread).toBe(false);
  });

  it("does not write to localStorage when markSeen has no latest version", async () => {
    fetchMock.mockResolvedValue({ ok: false, text: () => Promise.resolve("") });

    const { result } = renderHook(() => useChangelogBadge());

    // Fail closed — no changelog parsed, so no latest version and no unread.
    expect(result.current.latestVersion).toBeNull();
    expect(result.current.hasUnread).toBe(false);

    act(() => {
      result.current.markSeen();
    });

    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it("writes the seen version when the changelog modal is opened", async () => {
    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.latestVersion).toBe(LATEST));
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();

    act(() => {
      useUIStore.setState({ changelogOpen: true });
    });

    expect(localStorage.getItem(SEEN_KEY)).toBe(LATEST);
    expect(result.current.hasUnread).toBe(false);
  });

  it("fails closed when localStorage reads are blocked", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });

    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.latestVersion).toBe(LATEST));
    expect(result.current.hasUnread).toBe(true);

    getItem.mockRestore();
  });
});
