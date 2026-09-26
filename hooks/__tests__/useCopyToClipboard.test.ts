import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "../useCopyToClipboard";

describe("useCopyToClipboard", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies text and returns true on success", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("kora-protocol");
    });

    expect(writeText).toHaveBeenCalledWith("kora-protocol");
    expect(ok).toBe(true);
    expect(result.current.copied).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("resets the copied flag after the default reset window", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(false);
  });

  it("honors a custom reset window", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard(500));

    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it("returns false and surfaces the error message when the write is rejected", async () => {
    writeText.mockRejectedValueOnce(new Error("Permission denied"));
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("secret");
    });

    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBe("Permission denied");
  });

  it("falls back to a generic error when the rejection is not an Error", async () => {
    writeText.mockRejectedValueOnce("boom");
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("secret");
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe("Copy failed");
  });

  it("clears a previous error when a new copy is attempted", async () => {
    writeText.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("first");
    });
    expect(result.current.error).toBe("nope");

    await act(async () => {
      await result.current.copy("second");
    });
    expect(result.current.error).toBeNull();
    expect(result.current.copied).toBe(true);
  });

  it("clears the pending reset timer on unmount", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hello");
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});