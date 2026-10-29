import { describe, expect, it } from "vitest";
import { findViolations } from "./check-ui-gates";

const gatesOf = (path: string, source: string) =>
  findViolations(path, source).map((violation) => `${violation.gate} ${violation.match}`);

describe("the UI gates checker", () => {
  it("flags palette colors, literals and dark overrides, not tokens", () => {
    expect(gatesOf("components/a.tsx", '<p className="text-amber-700 bg-white" />')).toEqual([
      "G-STYLE-1 text-amber-700",
      "G-STYLE-1 bg-white",
    ]);
    expect(gatesOf("components/a.tsx", '"shadow rgb(1 2 3)"')).toEqual(["G-STYLE-1 rgb("]);
    expect(gatesOf("components/a.tsx", '"dark:text-tone-red-foreground"')).toEqual([
      "G-STYLE-1 dark:text-",
    ]);
    expect(
      gatesOf("components/a.tsx", '"bg-tone-blue text-tone-amber-foreground bg-chart-3"'),
    ).toEqual([]);
  });

  it("flags literal type sizes, radii, spacing, shadows and z-index", () => {
    expect(gatesOf("features/a.tsx", '"text-[0.8125rem] rounded-[4px] pl-[5.5rem]"')).toEqual([
      "G-STYLE-2 text-[0",
      "G-STYLE-3 rounded-[",
      "G-STYLE-4 pl-[5.5rem]",
    ]);
    expect(gatesOf("features/a.tsx", '"z-[2] shadow-[inset_3px_0_0_red]"')).toEqual([
      "G-STYLE-4 z-[",
      "G-STYLE-4 shadow-[",
    ]);
    expect(gatesOf("features/a.tsx", '"rounded border"')).toEqual(["G-STYLE-3 rounded"]);
  });

  it("allows named steps, viewport sizes and grid templates", () => {
    expect(
      gatesOf(
        "features/a.tsx",
        '"text-ui rounded-xs top-[8vh] grid-cols-[minmax(0,1fr)_10rem] max-w-[calc(100vw-2rem)]"',
      ),
    ).toEqual([]);
  });

  it("flags important modifiers but not negations", () => {
    expect(gatesOf("features/a.tsx", 'className="!pt-0" disabled={!isDone}')).toEqual([
      "G-STYLE-4 !pt-0",
    ]);
  });

  it("reads the component gates in features only", () => {
    const source = 'import { Table } from "@/components/ui/table";\n<select />';
    expect(gatesOf("features/a.tsx", source)).toEqual([
      'G-COMP-1 from "@/components/ui/table"',
      "G-COMP-2 <select",
    ]);
    expect(gatesOf("components/a.tsx", source)).toEqual([]);
  });

  it("keeps browser storage to hooks and the shell", () => {
    expect(gatesOf("features/a.ts", "window.localStorage.getItem(key)")).toEqual([
      "G-COMP-5 localStorage",
    ]);
    expect(gatesOf("hooks/a.ts", "window.localStorage.getItem(key)")).toEqual([]);
    expect(gatesOf("components/layout/a.tsx", "window.localStorage.getItem(key)")).toEqual([]);
  });

  it("skips vendored primitives, mocks and tests", () => {
    expect(gatesOf("components/ui/a.tsx", '"bg-white"')).toEqual([]);
    expect(gatesOf("mocks/a.ts", '"bg-white"')).toEqual([]);
    expect(gatesOf("features/a.test.tsx", '"bg-white"')).toEqual([]);
  });
});
