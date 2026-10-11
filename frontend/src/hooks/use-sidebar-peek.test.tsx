import { act, renderHook } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { useSidebarPeek } from "@/hooks/use-sidebar-peek";

beforeAll(() => {
  window.matchMedia = (query) => ({
    matches: query.includes("hover"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
});

describe("sidebar peek", () => {
  it("stays open while a portaled user menu is open", () => {
    const { result } = renderHook(() => useSidebarPeek(true));
    act(() => result.current.pin(true));
    act(() => result.current.barProps.onPointerLeave({ pointerType: "mouse" } as never));
    expect(result.current.isPeeking).toBe(true);
    act(() => result.current.pin(false));
    expect(result.current.isPeeking).toBe(false);
  });

  it("keeps the rail expanded after collapse while the pointer is over it", () => {
    const { result } = renderHook(() => useSidebarPeek(true));
    const bar = document.createElement("div");
    bar.matches = () => true;
    Object.assign(result.current.barProps.ref, { current: bar });
    act(() => result.current.revealUnderPointer());
    expect(result.current.isPeeking).toBe(true);
  });
});
