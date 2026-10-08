// Project sections start open and remember each person's toggles across a remount.

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectSectionPreferences } from "@/features/projects/use-project-section-preferences";

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    },
  });
});

describe("useProjectSectionPreferences", () => {
  it("starts all sections open, then restores a person's choice without changing another's", () => {
    const first = renderHook(() => useProjectSectionPreferences("u1"));
    expect(first.result.current.isOpen("proposed")).toBe(true);
    expect(first.result.current.isOpen("rejected")).toBe(true);

    act(() => first.result.current.setOpen("rejected", false));
    expect(first.result.current.isOpen("rejected")).toBe(false);
    first.unmount();

    const restored = renderHook(() => useProjectSectionPreferences("u1"));
    expect(restored.result.current.isOpen("rejected")).toBe(false);
    expect(restored.result.current.isOpen("proposed")).toBe(true);
    restored.unmount();

    const other = renderHook(() => useProjectSectionPreferences("u2"));
    expect(other.result.current.isOpen("rejected")).toBe(true);
  });

  it("ignores old or malformed storage values", () => {
    window.localStorage.setItem("vera.projects.sections.u1", '{"ended":"closed","active":false}');
    const { result } = renderHook(() => useProjectSectionPreferences("u1"));
    expect(result.current.isOpen("ended")).toBe(true);
    expect(result.current.isOpen("active")).toBe(false);
  });
});
