// How a range reads on its chip, whichever of its ends are set.

import { describe, expect, it } from "vitest";
import { countPresetLabelOf, rangeSummaryOf } from "@/components/filters/range-filter";
import type { RangeFieldDefinition } from "@/lib/view-definition";

interface Query {
  pages?: { from?: number; to?: number };
  asked?: { from?: string; to?: string } | { preset: "last-7-days" | "this-month" };
}

const pages: RangeFieldDefinition<Query> = {
  key: "pages",
  label: "Pages",
  field: { kind: "numberRange", unit: "pages" },
};
const asked: RangeFieldDefinition<Query> = {
  key: "asked",
  label: "Asked",
  field: { kind: "dateRange" },
};

describe("rangeSummaryOf", () => {
  it("reads a count as a comparison when one end is open", () => {
    expect(rangeSummaryOf(pages, { from: 1000 })).toBe("≥ 1,000");
    expect(rangeSummaryOf(pages, { to: 200 })).toBe("≤ 200");
    expect(rangeSummaryOf(pages, { from: 200, to: 1000 })).toBe("200–1,000");
  });

  it("reads days as from, until or between", () => {
    expect(rangeSummaryOf(asked, { from: "2026-06-01" })).toBe("from 1 Jun 2026");
    expect(rangeSummaryOf(asked, { to: "2026-06-30" })).toBe("until 30 Jun 2026");
    expect(rangeSummaryOf(asked, { from: "2026-06-01", to: "2026-06-30" })).toBe(
      "1 Jun 2026 – 30 Jun 2026",
    );
  });

  it("reads a preset by its name, so it stays relative", () => {
    expect(rangeSummaryOf(asked, { preset: "last-7-days" })).toBe("last 7 days");
  });
});

describe("countPresetLabelOf", () => {
  it("names a count preset by its ends, both included", () => {
    expect(countPresetLabelOf({ to: 99 })).toBe("Under 100");
    expect(countPresetLabelOf({ from: 100, to: 499 })).toBe("100–499");
    expect(countPresetLabelOf({ from: 1000 })).toBe("1,000 and more");
  });
});
