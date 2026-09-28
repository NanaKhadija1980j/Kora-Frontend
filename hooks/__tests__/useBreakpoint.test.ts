import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useBreakpoint } from "../useBreakpoint";

describe("useBreakpoint", () => {
  const originalInnerWidth = window.innerWidth;

  const setWindowWidth = (width: number) => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });
  };

  afterEach(() => {
    setWindowWidth(originalInnerWidth);
  });

  it("identifies mobile breakpoint (< 768px)", () => {
    setWindowWidth(500);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe("sm");
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.width).toBe(500);
  });

  it("identifies tablet breakpoint (768px - 1023px)", () => {
    setWindowWidth(800);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe("md");
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.width).toBe(800);
  });

  it("identifies desktop breakpoint lg (1024px - 1279px)", () => {
    setWindowWidth(1100);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe("lg");
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.width).toBe(1100);
  });

  it("identifies desktop breakpoint xl (1280px - 1535px)", () => {
    setWindowWidth(1400);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe("xl");
    expect(result.current.isDesktop).toBe(true);
  });

  it("identifies desktop breakpoint 2xl (>= 1536px)", () => {
    setWindowWidth(1600);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe("2xl");
    expect(result.current.isDesktop).toBe(true);
  });

  it("updates breakpoint state on window resize event", () => {
    setWindowWidth(1200);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);

    act(() => {
      setWindowWidth(400);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.breakpoint).toBe("sm");
  });

  it("removes event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useBreakpoint());

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
