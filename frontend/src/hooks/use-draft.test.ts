// useDraft: dirty only while it differs from what it started from, reset to it, and a save
// making what is held the new start.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isSameSet, useDraft } from "@/hooks/use-draft";

describe("useDraft", () => {
  it("is dirty while it differs, and clean again when it comes back", () => {
    const { result } = renderHook(() => useDraft<ReadonlySet<string>>(new Set(["a"]), isSameSet));

    act(() => result.current.set(new Set(["a", "b"])));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.set(new Set(["a"])));
    expect(result.current.isDirty).toBe(false);
  });

  it("resets to the start, and commits what it holds as the new start", () => {
    const { result } = renderHook(() => useDraft("first"));

    act(() => result.current.set("second"));
    act(() => result.current.reset());
    expect(result.current.current).toBe("first");

    act(() => result.current.set("third"));
    act(() => result.current.commit());
    expect(result.current.original).toBe("third");
    expect(result.current.isDirty).toBe(false);
  });
});
