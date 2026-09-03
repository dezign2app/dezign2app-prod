import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBufferedInput } from "../useBufferedInput";

describe("useBufferedInput", () => {
  it("provides instant local value updates", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useBufferedInput<string>("initial", onCommit, 200));

    expect(result.current.value).toBe("initial");

    act(() => {
      result.current.onChange("typing...");
    });

    // Local state updates immediately (0ms latency for smooth typing)
    expect(result.current.value).toBe("typing...");
    // onCommit has not fired yet (debounced)
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits after debounce delay", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useBufferedInput<string>("initial", onCommit, 150));

    act(() => {
      result.current.onChange("updated");
    });

    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(onCommit).toHaveBeenCalledWith("updated");
    vi.useRealTimers();
  });

  it("flushes immediately on blur/flush call", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useBufferedInput<string>("hello", onCommit, 300));

    act(() => {
      result.current.onChange("hello world");
    });

    expect(onCommit).not.toHaveBeenCalled();

    // User blurs the input or clicks away
    act(() => {
      result.current.flush();
    });

    expect(onCommit).toHaveBeenCalledWith("hello world");
    vi.useRealTimers();
  });

  it("syncs external value updates when changed externally", () => {
    const onCommit = vi.fn();
    let externalVal = "first";
    const { result, rerender } = renderHook(
      ({ val }) => useBufferedInput<string>(val, onCommit, 200),
      { initialProps: { val: externalVal } },
    );

    expect(result.current.value).toBe("first");

    externalVal = "second";
    rerender({ val: externalVal });

    expect(result.current.value).toBe("second");
  });
});
