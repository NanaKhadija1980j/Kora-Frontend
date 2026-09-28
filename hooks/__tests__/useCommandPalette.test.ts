/**
 * Unit tests for useCommandPalette (issue #510).
 *
 * Covers:
 *  - COMMAND_PALETTE_SHORTCUTS is a non-empty array with the expected entries
 *  - getRecent returns an empty array when localStorage is empty
 *  - pushRecent persists an item and returns it via getRecent
 *  - pushRecent de-duplicates by id (newest wins, moved to front)
 *  - pushRecent respects MAX_RECENT = 5 (oldest item is dropped)
 *  - clearRecent empties the stored list
 *  - Cmd+K keydown listener sets commandPaletteOpen to true in UIStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useCommandPalette,
  COMMAND_PALETTE_SHORTCUTS,
  type RecentItem,
} from "@/hooks/useCommandPalette";

// ── Mock UIStore ────────────────────────────────────────────────────────────────

let paletteOpen = false;
const setOpenMock = vi.fn((v: boolean) => {
  paletteOpen = v;
});

vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (s: { commandPaletteOpen: boolean; setCommandPaletteOpen: typeof setOpenMock }) => unknown) =>
    selector({ commandPaletteOpen: paletteOpen, setCommandPaletteOpen: setOpenMock }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeItem(n: number): RecentItem {
  return { id: `item-${n}`, label: `Item ${n}`, href: `/route/${n}`, type: "page" };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("COMMAND_PALETTE_SHORTCUTS", () => {
  it("exports a non-empty array of shortcut entries", () => {
    expect(Array.isArray(COMMAND_PALETTE_SHORTCUTS)).toBe(true);
    expect(COMMAND_PALETTE_SHORTCUTS.length).toBeGreaterThan(0);
  });

  it("includes an entry for ⌘K / Ctrl+K", () => {
    const entry = COMMAND_PALETTE_SHORTCUTS.find((s) =>
      s.label.includes("Ctrl+K")
    );
    expect(entry).toBeDefined();
    expect(entry?.description).toMatch(/open.*command palette/i);
  });

  it("includes an ESC entry", () => {
    const entry = COMMAND_PALETTE_SHORTCUTS.find((s) =>
      s.label.toLowerCase() === "esc"
    );
    expect(entry).toBeDefined();
  });
});

describe("useCommandPalette — recent items", () => {
  beforeEach(() => {
    localStorage.clear();
    paletteOpen = false;
    setOpenMock.mockClear();
  });

  it("getRecent returns [] when localStorage is empty", () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.getRecent()).toEqual([]);
  });

  it("pushRecent persists an item that getRecent can then retrieve", () => {
    const { result } = renderHook(() => useCommandPalette());
    const item = makeItem(1);

    act(() => {
      result.current.pushRecent(item);
    });

    expect(result.current.getRecent()).toEqual([item]);
  });

  it("pushRecent places the newest item at index 0", () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.pushRecent(makeItem(1));
      result.current.pushRecent(makeItem(2));
    });

    const recent = result.current.getRecent();
    expect(recent[0].id).toBe("item-2");
    expect(recent[1].id).toBe("item-1");
  });

  it("pushRecent de-duplicates by id (re-visit moves to front)", () => {
    const { result } = renderHook(() => useCommandPalette());
    const item = makeItem(1);

    act(() => {
      result.current.pushRecent(item);
      result.current.pushRecent(makeItem(2));
      result.current.pushRecent(item); // revisit item-1 → should move to front
    });

    const recent = result.current.getRecent();
    expect(recent[0].id).toBe("item-1");
    expect(recent.filter((r) => r.id === "item-1")).toHaveLength(1);
  });

  it("pushRecent caps the list at MAX_RECENT = 5 items", () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      for (let i = 1; i <= 7; i++) {
        result.current.pushRecent(makeItem(i));
      }
    });

    expect(result.current.getRecent()).toHaveLength(5);
  });

  it("pushRecent drops the oldest item when MAX_RECENT is reached", () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      for (let i = 1; i <= 6; i++) {
        result.current.pushRecent(makeItem(i));
      }
    });

    const ids = result.current.getRecent().map((r) => r.id);
    // item-1 was pushed first and should have been dropped
    expect(ids).not.toContain("item-1");
    expect(ids).toContain("item-6"); // most recent is present
  });

  it("clearRecent empties the stored list", () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.pushRecent(makeItem(1));
      result.current.pushRecent(makeItem(2));
      result.current.clearRecent();
    });

    expect(result.current.getRecent()).toEqual([]);
  });
});

describe("useCommandPalette — Cmd+K hotkey", () => {
  beforeEach(() => {
    localStorage.clear();
    paletteOpen = false;
    setOpenMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the palette when Ctrl+K is pressed", () => {
    renderHook(() => useCommandPalette());

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });

    expect(setOpenMock).toHaveBeenCalledWith(true);
  });

  it("opens the palette when Meta+K is pressed (Mac)", () => {
    renderHook(() => useCommandPalette());

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
    });

    expect(setOpenMock).toHaveBeenCalledWith(true);
  });

  it("does not trigger on unrelated keys", () => {
    renderHook(() => useCommandPalette());

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true })
      );
    });

    expect(setOpenMock).not.toHaveBeenCalled();
  });

  it("removes the event listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useCommandPalette());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
