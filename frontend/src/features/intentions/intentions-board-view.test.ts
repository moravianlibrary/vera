import {
  isSameIntentionsQuery,
  parseIntentionsSearchParams,
  toIntentionsSearchParams,
} from "@vera/contract/intention-filters";
import type { IntentionIndex, IntentionRow } from "@vera/contract/intentions";
import type { Intention } from "@vera/domain/entities";
import { describe, expect, it } from "vitest";
import {
  intentionBoardSectionsOf,
  intentionFacets,
  intentionsView,
  matchingIntentions,
} from "@/features/intentions/intentions-board-view";
import { i18n } from "@/i18n";

const intention = (id: string, changes: Partial<Intention> = {}): Intention => ({
  id,
  name: id,
  description: "",
  funding: { kind: "any" },
  projectId: null,
  scopeCategoryId: null,
  distributionId: null,
  targetPages: 100,
  countsFrom: "2026-01-01",
  endsOn: "2026-12-31",
  isOverall: false,
  templateId: null,
  archived: null,
  ...changes,
});

const row = (
  id: string,
  changes: Partial<IntentionRow> = {},
  definition: Partial<Intention> = {},
): IntentionRow => ({
  intention: intention(id, definition),
  state: "Running",
  timeElapsed: 0.5,
  daysToStart: 0,
  daysLeft: 100,
  evenPace: 0.5,
  verdict: null,
  pagesPerWeekNeeded: null,
  catchUpPages: null,
  plannedPages: 0,
  deliveredPages: 0,
  outputPages: 0,
  noDateCount: 0,
  noPagesCount: 0,
  project: null,
  scope: null,
  mix: null,
  mixRows: [],
  unallocated: 0,
  outOfBandCount: 0,
  fill: [],
  lists: [],
  ...changes,
});

const index: IntentionIndex = {
  asOf: "2026-06-25",
  rows: [
    row("met", { verdict: "targetMet" }),
    row("pace", { verdict: "onPace" }),
    row("band", { outOfBandCount: 2 }, { targetPages: null }),
    row("behind", { verdict: "behindPace" }),
    row("soon-big", { verdict: "behindPace" }, { endsOn: "2026-08-01", targetPages: 800 }),
    row("soon-small", { verdict: "behindPace" }, { endsOn: "2026-08-01", targetPages: 200 }),
    row("planned", { verdict: "fullyPlanned" }),
    row("upcoming", { state: "Upcoming" }),
    row("ended", { state: "Ended" }),
    row("archived", {}, { archived: { actor: { kind: "system" }, at: "2026-09-01T00:00:00Z" } }),
  ],
  templates: [
    {
      template: {
        id: "repeat",
        description: "Regional work.",
        namePattern: "Regional {period}",
        namePatterns: { en: "Regional {period}" },
        every: "month",
        funding: { kind: "any" },
        scopeCategoryId: null,
        distributionId: null,
        targetPages: 100,
        since: "2026-01-01",
        nextOn: "2026-11-01",
        isArchivingPrevious: true,
        createdBy: "u1",
      },
      mix: null,
    },
  ],
};

describe("Intentions board", () => {
  it("has disjoint Targets, Output, and Repeats filters with search aware facets", () => {
    const onlyOutput = matchingIntentions(index, { kinds: ["Output"] });
    expect(onlyOutput.rows.map((value) => value.intention.id)).toEqual(["band"]);
    expect(onlyOutput.templates).toEqual([]);
    expect(matchingIntentions(index, { kinds: ["Repeat"] }).templates).toHaveLength(1);
    expect(matchingIntentions(index, { search: "regional" }).rows).toHaveLength(0);
    expect(intentionFacets(index, { search: "regional", kinds: ["Target"] }).kinds).toEqual([
      { value: "Target", count: 0 },
      { value: "Output", count: 0 },
      { value: "Repeat", count: 1 },
    ]);
  });

  it("orders sections and cards by attention, end date, then descending target", () => {
    const sections = intentionBoardSectionsOf(index);
    expect(sections.repeats.map((value) => value.template.id)).toEqual(["repeat"]);
    expect(sections.running.map((value) => value.intention.id)).toEqual([
      "band",
      "soon-big",
      "soon-small",
      "behind",
      "pace",
      "planned",
      "met",
    ]);
    expect(sections.upcoming.map((value) => value.intention.id)).toEqual(["upcoming"]);
    expect(sections.ended.map((value) => value.intention.id)).toEqual(["ended"]);
    expect(sections.archived.map((value) => value.intention.id)).toEqual(["archived"]);
  });

  it("round trips URL filters and compares them without type selection order", () => {
    const query = parseIntentionsSearchParams(
      new URLSearchParams("q= regional &type=Output,Target"),
    );
    expect(toIntentionsSearchParams(query).toString()).toBe("q=regional&type=Output%2CTarget");
    expect(isSameIntentionsQuery(query, { search: "regional", kinds: ["Target", "Output"] })).toBe(
      true,
    );
  });

  it("filters lifecycle, pace, repeat frequency, mix and project scope independently", () => {
    const specific: IntentionIndex = {
      ...index,
      rows: [
        row(
          "grant",
          { verdict: "behindPace" },
          {
            funding: { kind: "project", projectId: "p1" },
            distributionId: "d1",
          },
        ),
        row("other", { verdict: "onPace" }, { distributionId: null }),
        row(
          "archived",
          {},
          { archived: { actor: { kind: "system" }, at: "2026-06-01T00:00:00Z" } },
        ),
      ],
      templates: index.templates,
    };
    expect(
      matchingIntentions(specific, { states: ["Archived"] }).rows.map(
        (value) => value.intention.id,
      ),
    ).toEqual(["archived"]);
    expect(
      matchingIntentions(specific, { paces: ["behindPace"] }).rows.map(
        (value) => value.intention.id,
      ),
    ).toEqual(["grant"]);
    expect(
      matchingIntentions(specific, {
        mixes: ["d1"],
        projects: ["p1"],
      }).rows.map((value) => value.intention.id),
    ).toEqual(["grant"]);
    expect(
      matchingIntentions(specific, { mixes: ["__no_mix__"] }).rows.map(
        (value) => value.intention.id,
      ),
    ).toEqual(["other", "archived"]);
    expect(
      matchingIntentions(specific, { projects: ["__project_funding__"] }).rows.map(
        (value) => value.intention.id,
      ),
    ).toEqual(["grant"]);
    expect(matchingIntentions(specific, { projects: ["__no_project_funding__"] }).rows).toEqual([]);
    expect(matchingIntentions(specific, { intervals: ["month"] }).templates).toHaveLength(1);
    expect(matchingIntentions(specific, { intervals: ["week"] }).templates).toHaveLength(0);
    expect(
      intentionFacets(specific, { paces: ["behindPace"] }).paces.find(
        (facet) => facet.value === "onPace",
      )?.count,
    ).toBe(1);
  });

  it("keeps Type, State and Pace visible and combines funding choices into Project", () => {
    expect(
      intentionsView.fields
        .filter((field) => "isQuick" in field && field.isQuick)
        .map((field) => i18n.t(field.label)),
    ).toEqual(["Type", "State", "Pace / attention"]);
    expect(intentionsView.fields.map((field) => i18n.t(field.label))).not.toContain("Funding");
    expect(parseIntentionsSearchParams(new URLSearchParams("funding=project")).projects).toEqual([
      "__project_funding__",
    ]);
  });

  it("filters calendar days and percentages against the target, including relative dates", () => {
    const ranged: IntentionIndex = {
      ...index,
      rows: [
        row(
          "half",
          { plannedPages: 60, deliveredPages: 25, timeElapsed: 0.5 },
          {
            countsFrom: "2026-06-01",
            endsOn: "2026-06-30",
          },
        ),
        row(
          "open",
          { plannedPages: 100, deliveredPages: 90, timeElapsed: null },
          {
            targetPages: null,
            endsOn: null,
          },
        ),
      ],
      templates: [],
    };
    const query = {
      starts: { preset: "this-month" as const },
      ends: { from: "2026-06-30", to: "2026-06-30" },
      planned: { from: 60, to: 60 },
      delivered: { from: 25, to: 25 },
      timeElapsed: { from: 50, to: 50 },
    };
    expect(matchingIntentions(ranged, query).rows.map((value) => value.intention.id)).toEqual([
      "half",
    ]);
    expect(
      matchingIntentions(ranged, { planned: { from: 1 } }).rows.map((value) => value.intention.id),
    ).toEqual(["half"]);
    expect(matchingIntentions(ranged, { ends: { from: "2026-07-01" } }).rows).toEqual([]);
    const encoded = toIntentionsSearchParams(query);
    expect(isSameIntentionsQuery(parseIntentionsSearchParams(encoded), query)).toBe(true);
  });
});
