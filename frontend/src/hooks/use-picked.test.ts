// usePicked: toggling, a range from the last pick, a pane's "select all", and forgetting the
// picks when what the list shows changes.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePicked } from "@/hooks/use-picked";

const ids = ["a", "b", "c", "d", "e"];

describe("usePicked", () => {
  it("toggles one, and extends a range from the last pick", () => {
    const { result } = renderHook(() => usePicked(ids, "all"));

    act(() => result.current.toggle("b"));
    act(() => result.current.toggle("d", true));

    expect([...result.current.ids]).toEqual(["b", "c", "d"]);

    act(() => result.current.toggle("c"));

    expect([...result.current.ids]).toEqual(["b", "d"]);
  });

  it("picks and unpicks many at once", () => {
    const { result } = renderHook(() => usePicked(ids, "all"));

    act(() => result.current.setMany(ids, true));
    act(() => result.current.setMany(["a", "e"], false));

    expect([...result.current.ids]).toEqual(["b", "c", "d"]);
  });

  it("forgets the picks when the reset key changes", () => {
    const { result, rerender } = renderHook(({ key }) => usePicked(ids, key), {
      initialProps: { key: { search: "x" } as unknown },
    });
    act(() => result.current.toggle("a"));

    rerender({ key: { search: "x" } });
    expect(result.current.ids.size).toBe(1);

    rerender({ key: { search: "y" } });
    expect(result.current.ids.size).toBe(0);
  });
});
