// Long-press waits, cancels on movement and ignores mouse input.

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "@/hooks/use-long-press";

describe("useLongPress", () => {
  afterEach(() => vi.useRealTimers());

  it("fires at 500 ms", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { isEnabled: true }));
    act(() =>
      result.current.onPointerDown({ pointerType: "touch", clientX: 10, clientY: 10 } as never),
    );
    act(() => vi.advanceTimersByTime(499));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("cancels after a 12 px move", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { isEnabled: true }));
    act(() =>
      result.current.onPointerDown({ pointerType: "touch", clientX: 10, clientY: 10 } as never),
    );
    act(() => result.current.onPointerMove({ clientX: 22, clientY: 10 } as never));
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does nothing for a mouse", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { isEnabled: true }));
    act(() =>
      result.current.onPointerDown({ pointerType: "mouse", clientX: 10, clientY: 10 } as never),
    );
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
