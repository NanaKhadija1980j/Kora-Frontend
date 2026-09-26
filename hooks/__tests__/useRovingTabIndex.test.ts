/**
 * Unit tests for useRovingTabIndex hook (issue #760).
 *
 * Covers:
 *  - Initial activeIndex is 0
 *  - registerRef stores element refs by index
 *  - handleKeyDown: ArrowRight/ArrowDown moves to next item
 *  - handleKeyDown: ArrowLeft/ArrowUp moves to previous item
 *  - handleKeyDown: Home moves to first item
 *  - handleKeyDown: End moves to last item
 *  - handleKeyDown prevents default on navigation keys
 *  - getTabIndex returns 0 for active item, -1 for others
 *  - setActiveIndex updates activeIndex directly
 *  - itemCount = 0 edge case handling
 *  - Focus wrapping behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";

describe("useRovingTabIndex", () => {
  let elements: HTMLButtonElement[];

  beforeEach(() => {
    vi.useFakeTimers();
    elements = [
      document.createElement("button"),
      document.createElement("button"),
      document.createElement("button"),
      document.createElement("button"),
      document.createElement("button"),
    ];
    elements.forEach((el, i) => {
      el.tabIndex = i === 0 ? 0 : -1;
      el.id = `btn-${i}`;
      document.body.appendChild(el);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    elements.forEach((el) => document.body.removeChild(el));
    elements = [];
  });

  const createKeyDownEvent = (key: string) =>
    new KeyboardEvent("keydown", { key, bubbles: true });

  it("initializes activeIndex to 0", () => {
    const { result } = renderHook(() => useRovingTabIndex(5));
    expect(result.current.getTabIndex(0)).toBe(0);
    expect(result.current.getTabIndex(1)).toBe(-1);
  });

  it("registerRef stores element reference by index", () => {
    const { result } = renderHook(() => useRovingTabIndex(3));

    act(() => {
      result.current.registerRef(0)(elements[0]);
      result.current.registerRef(1)(elements[1]);
    });

    // Verify via handleKeyDown navigation
    act(() => {
      result.current.handleKeyDown(createKeyDownEvent("ArrowRight"), 0);
    });
    // After ArrowRight from 0, should be at 1
    expect(result.current.getTabIndex(1)).toBe(0);
    expect(document.activeElement).toBe(elements[1]);
  });

  describe("handleKeyDown", () => {
    it("ArrowRight moves to next item", () => {
      const { result } = renderHook(() => useRovingTabIndex(5));
      elements.slice(0, 5).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      act(() => {
        elements[0].focus();
        result.current.handleKeyDown(createKeyDownEvent("ArrowRight"), 0);
      });

      expect(result.current.getTabIndex(1)).toBe(0);
      expect(document.activeElement).toBe(elements[1]);
    });

    it("ArrowDown moves to next item", () => {
      const { result } = renderHook(() => useRovingTabIndex(5));
      elements.slice(0, 5).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      act(() => {
        elements[0].focus();
        result.current.handleKeyDown(createKeyDownEvent("ArrowDown"), 0);
      });

      expect(result.current.getTabIndex(1)).toBe(0);
      expect(document.activeElement).toBe(elements[1]);
    });

    it("ArrowLeft moves to previous item", () => {
      const { result } = renderHook(() => useRovingTabIndex(5));
      elements.slice(0, 5).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      act(() => {
        result.current.setActiveIndex(2);
        elements[2].focus();
        result.current.handleKeyDown(createKeyDownEvent("ArrowLeft"), 2);
      });

      expect(result.current.getTabIndex(1)).toBe(0);
      expect(document.activeElement).toBe(elements[1]);
    });

    it("ArrowUp moves to previous item", () => {
      const { result } = renderHook(() => useRovingTabIndex(5));
      elements.slice(0, 5).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      act(() => {
        result.current.setActiveIndex(2);
        elements[2].focus();
        result.current.handleKeyDown(createKeyDownEvent("ArrowUp"), 2);
      });

      expect(result.current.getTabIndex(1)).toBe(0);
      expect(document.activeElement).toBe(elements[1]);
    });

    it("Home moves to first item", () => {
      const { result } = renderHook(() => useRovingTabIndex(5));
      elements.slice(0, 5).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      act(() => {
        result.current.setActiveIndex(3);
        elements[3].focus();
        result.current.handleKeyDown(createKeyDownEvent("Home"), 3);
      });

      expect(result.current.getTabIndex(0)).toBe(0);
      expect(document.activeElement).toBe(elements[0]);
    });

    it("End moves to last item", () => {
      const { result } = renderHook(() => useRovingTabIndex(5));
      elements.slice(0, 5).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      act(() => {
        result.current.setActiveIndex(1);
        elements[1].focus();
        result.current.handleKeyDown(createKeyDownEvent("End"), 1);
      });

      expect(result.current.getTabIndex(4)).toBe(0);
      expect(document.activeElement).toBe(elements[4]);
    });

    it("prevents default on navigation keys", () => {
      const { result } = renderHook(() => useRovingTabIndex(5));
      elements.slice(0, 5).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      const event = createKeyDownEvent("ArrowRight");
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      act(() => {
        elements[0].focus();
        result.current.handleKeyDown(event, 0);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("does not prevent default on non-navigation keys", () => {
      const { result } = renderHook(() => useRovingTabIndex(5));
      elements.slice(0, 5).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      const event = createKeyDownEvent("Tab");
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      act(() => {
        elements[0].focus();
        result.current.handleKeyDown(event, 0);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("wraps from last to first on ArrowRight", () => {
      const { result } = renderHook(() => useRovingTabIndex(3));
      elements.slice(0, 3).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      act(() => {
        result.current.setActiveIndex(2);
        elements[2].focus();
        result.current.handleKeyDown(createKeyDownEvent("ArrowRight"), 2);
      });

      expect(result.current.getTabIndex(0)).toBe(0);
      expect(document.activeElement).toBe(elements[0]);
    });

    it("wraps from first to last on ArrowLeft", () => {
      const { result } = renderHook(() => useRovingTabIndex(3));
      elements.slice(0, 3).forEach((el, i) => act(() => result.current.registerRef(i)(el)));

      act(() => {
        result.current.setActiveIndex(0);
        elements[0].focus();
        result.current.handleKeyDown(createKeyDownEvent("ArrowLeft"), 0);
      });

      expect(result.current.getTabIndex(2)).toBe(0);
      expect(document.activeElement).toBe(elements[2]);
    });
  });

  describe("getTabIndex", () => {
    it("returns 0 for active index, -1 for others", () => {
      const { result } = renderHook(() => useRovingTabIndex(4));

      expect(result.current.getTabIndex(0)).toBe(0);
      expect(result.current.getTabIndex(1)).toBe(-1);
      expect(result.current.getTabIndex(2)).toBe(-1);
      expect(result.current.getTabIndex(3)).toBe(-1);

      act(() => {
        result.current.setActiveIndex(2);
      });

      expect(result.current.getTabIndex(0)).toBe(-1);
      expect(result.current.getTabIndex(1)).toBe(-1);
      expect(result.current.getTabIndex(2)).toBe(0);
      expect(result.current.getTabIndex(3)).toBe(-1);
    });
  });

  describe("setActiveIndex", () => {
    it("updates activeIndex directly", () => {
      const { result } = renderHook(() => useRovingTabIndex(3));

      act(() => {
        result.current.registerRef(1)(elements[1]);
        result.current.setActiveIndex(1);
      });

      expect(result.current.getTabIndex(1)).toBe(0);
    });
  });

  describe("registerRef with null", () => {
    it("handles null element (cleanup)", () => {
      const { result } = renderHook(() => useRovingTabIndex(3));
      const el = document.createElement("button");
      el.id = "btn-temp";
      document.body.appendChild(el);

      act(() => {
        result.current.registerRef(0)(el);
      });
      act(() => {
        result.current.registerRef(0)(null);
      });

      // Should not throw when focusing - element is null
      act(() => {
        result.current.setActiveIndex(0);
      });
      // activeIndex updated but no element to focus
      expect(result.current.getTabIndex(0)).toBe(0);
      document.body.removeChild(el);
    });
  });

  describe("itemCount = 0 edge case", () => {
    it("handles zero items gracefully", () => {
      const { result } = renderHook(() => useRovingTabIndex(0));

      // Should not throw
      act(() => {
        result.current.handleKeyDown(createKeyDownEvent("ArrowRight"), 0);
        result.current.handleKeyDown(createKeyDownEvent("ArrowLeft"), 0);
        result.current.handleKeyDown(createKeyDownEvent("Home"), 0);
        result.current.handleKeyDown(createKeyDownEvent("End"), 0);
        result.current.setActiveIndex(0);
      });

      // When itemCount=0, activeIndex stays 0 but there are no valid items
      // getTabIndex(0) returns 0 because index === activeIndex (0 === 0)
      // This is the current implementation behavior
      expect(result.current.getTabIndex(0)).toBe(0);
    });
  });

  describe("focus behavior with registered elements", () => {
    it("focuses correct element on ArrowRight from index 0", () => {
      const { result } = renderHook(() => useRovingTabIndex(3));

      act(() => {
        result.current.registerRef(0)(elements[0]);
        result.current.registerRef(1)(elements[1]);
        result.current.registerRef(2)(elements[2]);
        elements[0].focus();
      });

      act(() => {
        result.current.handleKeyDown(createKeyDownEvent("ArrowRight"), 0);
      });

      expect(result.current.getTabIndex(1)).toBe(0);
      expect(document.activeElement).toBe(elements[1]);
    });

    it("focuses correct element on ArrowLeft from index 2", () => {
      const { result } = renderHook(() => useRovingTabIndex(3));

      act(() => {
        result.current.registerRef(0)(elements[0]);
        result.current.registerRef(1)(elements[1]);
        result.current.registerRef(2)(elements[2]);
        result.current.setActiveIndex(2);
        elements[2].focus();
      });

      act(() => {
        result.current.handleKeyDown(createKeyDownEvent("ArrowLeft"), 2);
      });

      expect(result.current.getTabIndex(1)).toBe(0);
      expect(document.activeElement).toBe(elements[1]);
    });
  });
});