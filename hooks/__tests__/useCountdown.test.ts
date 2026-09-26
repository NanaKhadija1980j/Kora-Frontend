import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatCountdown, useCountdown } from "@/hooks/useCountdown";

/**
 * Countdown tick and completion (Issue #766).
 *
 * Everything here runs on fake timers with a pinned system time. The hook
 * reads `Date.now()` on its own schedule, so without both the assertions would
 * depend on how long the test itself took to run — which is how timer tests
 * become flaky rather than useful.
 */

const NOW = new Date("2026-09-25T12:00:00.000Z");
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A target `ms` in the future, as the ISO string the UI actually passes. */
function inFuture(ms: number): string {
  return new Date(NOW.getTime() + ms).toISOString();
}

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("remaining time", () => {
    it("breaks the remaining time into days, hours and minutes", () => {
      const { result } = renderHook(() => useCountdown(inFuture(2 * DAY + 3 * HOUR + 4 * MINUTE)));

      expect(result.current.days).toBe(2);
      expect(result.current.hours).toBe(3);
      expect(result.current.minutes).toBe(4);
      expect(result.current.isExpired).toBe(false);
    });

    it("accepts a Date and a timestamp as well as a string", () => {
      const ms = 5 * HOUR;

      const fromString = renderHook(() => useCountdown(inFuture(ms)));
      const fromDate = renderHook(() => useCountdown(new Date(NOW.getTime() + ms)));
      const fromNumber = renderHook(() => useCountdown(NOW.getTime() + ms));

      expect(fromString.result.current.hours).toBe(5);
      expect(fromDate.result.current.hours).toBe(5);
      expect(fromNumber.result.current.hours).toBe(5);
    });

    it("floors at zero rather than counting up past the target", () => {
      // A negative diff would otherwise produce negative days/hours, which the
      // UI would render as "-1d -3h".
      const { result } = renderHook(() => useCountdown(NOW.getTime() - DAY));

      expect(result.current.days).toBe(0);
      expect(result.current.hours).toBe(0);
      expect(result.current.minutes).toBe(0);
      expect(result.current.isExpired).toBe(true);
    });
  });

  describe("ticking", () => {
    it("recomputes on each interval", () => {
      const { result } = renderHook(() => useCountdown(inFuture(3 * HOUR), MINUTE));

      expect(result.current.hours).toBe(3);
      expect(result.current.minutes).toBe(0);

      act(() => {
        vi.advanceTimersByTime(MINUTE);
      });
      expect(result.current.hours).toBe(2);
      expect(result.current.minutes).toBe(59);

      act(() => {
        vi.advanceTimersByTime(30 * MINUTE);
      });
      expect(result.current.hours).toBe(2);
      expect(result.current.minutes).toBe(29);
    });

    it("does not recompute between ticks", () => {
      const { result } = renderHook(() => useCountdown(inFuture(3 * HOUR), HOUR));

      act(() => {
        // Half an interval: the clock moved, the hook has not been told.
        vi.advanceTimersByTime(30 * MINUTE);
      });

      expect(result.current.hours).toBe(3);
    });

    it("honours a custom interval", () => {
      const { result } = renderHook(() => useCountdown(inFuture(2 * HOUR), 1000));

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.minutes).toBe(59);
    });
  });

  describe("completion", () => {
    it("flips to expired when the target passes while mounted", () => {
      const { result } = renderHook(() => useCountdown(inFuture(2 * MINUTE), MINUTE));

      expect(result.current.isExpired).toBe(false);

      act(() => {
        vi.advanceTimersByTime(2 * MINUTE);
      });

      expect(result.current.isExpired).toBe(true);
      expect(result.current.urgency).toBe("expired");
    });

    it("announces expiry for assistive tech", () => {
      const { result } = renderHook(() => useCountdown(inFuture(MINUTE), MINUTE));

      act(() => {
        vi.advanceTimersByTime(MINUTE);
      });

      expect(result.current.announce).toBe("Expired");
    });

    it("clears the announcement after five seconds", () => {
      // Otherwise a screen reader re-reads the same string on every re-render.
      const { result } = renderHook(() => useCountdown(inFuture(MINUTE), MINUTE));

      act(() => {
        vi.advanceTimersByTime(MINUTE);
      });
      expect(result.current.announce).toBe("Expired");

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.announce).toBeNull();
    });
  });

  describe("urgency", () => {
    it.each([
      ["normal", 5 * DAY],
      ["warning", 2 * DAY],
      ["urgent", 6 * HOUR],
    ])("is %s at the matching distance", (expected, distance) => {
      const { result } = renderHook(() => useCountdown(inFuture(distance)));
      expect(result.current.urgency).toBe(expected);
    });

    it("treats the three-day mark as warning and the day mark as urgent", () => {
      // The boundaries are the part a refactor is most likely to move by one.
      const justUnderThreeDays = renderHook(() => useCountdown(inFuture(3 * DAY - MINUTE)));
      expect(justUnderThreeDays.result.current.urgency).toBe("warning");

      const justUnderOneDay = renderHook(() => useCountdown(inFuture(DAY - MINUTE)));
      expect(justUnderOneDay.result.current.urgency).toBe("urgent");

      const exactlyThreeDays = renderHook(() => useCountdown(inFuture(3 * DAY)));
      expect(exactlyThreeDays.result.current.urgency).toBe("normal");
    });
  });

  describe("cleanup", () => {
    it("clears its interval on unmount", () => {
      const clearInterval = vi.spyOn(globalThis, "clearInterval");
      const { unmount } = renderHook(() => useCountdown(inFuture(DAY)));

      unmount();

      expect(clearInterval).toHaveBeenCalled();
      clearInterval.mockRestore();
    });

    it("does not keep ticking after unmount", () => {
      const { result, unmount } = renderHook(() => useCountdown(inFuture(3 * HOUR), MINUTE));
      const before = result.current.minutes;

      unmount();
      act(() => {
        vi.advanceTimersByTime(30 * MINUTE);
      });

      // A surviving interval would have set state on an unmounted hook.
      expect(result.current.minutes).toBe(before);
    });

    it("replaces the interval when the target changes", () => {
      const { result, rerender } = renderHook(
        ({ target }: { target: string }) => useCountdown(target, MINUTE),
        { initialProps: { target: inFuture(3 * HOUR) } },
      );

      expect(result.current.hours).toBe(3);

      rerender({ target: inFuture(10 * HOUR) });
      expect(result.current.hours).toBe(10);

      act(() => {
        vi.advanceTimersByTime(MINUTE);
      });
      // One interval, not two: a leaked first interval would double the rate.
      expect(result.current.hours).toBe(9);
      expect(result.current.minutes).toBe(59);
    });
  });
});

describe("formatCountdown", () => {
  it("renders the compact form", () => {
    expect(
      formatCountdown({ days: 4, hours: 2, minutes: 30, isExpired: false }),
    ).toBe("4d 2h 30m");
  });

  it("says 'Expires today' rather than '0d'", () => {
    expect(
      formatCountdown({ days: 0, hours: 5, minutes: 0, isExpired: false }),
    ).toBe("Expires today");
  });

  it("says 'Expired' once past the target", () => {
    expect(
      formatCountdown({ days: 0, hours: 0, minutes: 0, isExpired: true }),
    ).toBe("Expired");
  });

  it("prefers expired over the same-day wording", () => {
    expect(
      formatCountdown({ days: 0, hours: 0, minutes: 0, isExpired: true }),
    ).not.toBe("Expires today");
  });
});
