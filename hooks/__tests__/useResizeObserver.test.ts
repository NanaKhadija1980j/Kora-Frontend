import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useResizeObserver } from "../useResizeObserver";

describe("useResizeObserver extended test suite", () => {
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;
  let observerCallback: ResizeObserverCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    observeMock = vi.fn();
    disconnectMock = vi.fn();

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: ResizeObserverCallback) {
          observerCallback = cb;
        }
        observe = observeMock;
        disconnect = disconnectMock;
        unobserve = vi.fn();
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("handles initial state of zero width and height", () => {
    const el = document.createElement("div");
    const ref = { current: el };
    const { result } = renderHook(() => useResizeObserver(ref));
    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it("throttles multiple consecutive resize notifications", () => {
    const el = document.createElement("div");
    const ref = { current: el };
    const { result } = renderHook(() => useResizeObserver(ref));

    act(() => {
      observerCallback(
        [{ contentRect: { width: 100, height: 50 } } as ResizeObserverEntry],
        {} as ResizeObserver
      );
    });

    // Before 100ms throttle timer fires
    expect(result.current).toEqual({ width: 0, height: 0 });

    act(() => {
      observerCallback(
        [{ contentRect: { width: 200, height: 100 } } as ResizeObserverEntry],
        {} as ResizeObserver
      );
      vi.advanceTimersByTime(100);
    });

    // Emits the latest pending size after 100ms
    expect(result.current).toEqual({ width: 200, height: 100 });
  });

  it("cleans up active timers on unmount", () => {
    const el = document.createElement("div");
    const ref = { current: el };
    const { result, unmount } = renderHook(() => useResizeObserver(ref));

    act(() => {
      observerCallback(
        [{ contentRect: { width: 300, height: 150 } } as ResizeObserverEntry],
        {} as ResizeObserver
      );
    });

    unmount();
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(disconnectMock).toHaveBeenCalledOnce();
  });
});
