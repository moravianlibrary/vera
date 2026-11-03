// Runs the domain's rule cases from JSON, as the backend's JUnit suite will.

import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { caseFileJsonSchema, caseFileSchema } from "../cases/case-file";
import type { Iteration, RepeatEvery, Request } from "./entities";
import {
  catchUpPagesOf,
  correctionOf,
  countIntention,
  countsTowardsOf,
  fillOf,
  intentionStateOf,
  isInWindow,
  listMixOf,
  mixReadingOf,
  nextPeriodStartOf,
  pagesPerWeekNeededOf,
  shareWithinOf,
  targetVerdictOf,
} from "./intentions";
import type {
  Grant,
  GrantHolder,
  GrantScope,
  Permission,
  Requirement,
  ScopedRecord,
  ScopeHolder,
} from "./permissions";
import {
  can,
  catalogEntryOf,
  coversScope,
  hasPermission,
  isAcceptedGrant,
  isWithinScope,
  missingRequirementsOf,
  permissionSchema,
  requiredScopeOf,
  scopesOf,
  withRequirements,
} from "./permissions";
import { daysUntil, periodOf, timeElapsedOf } from "./projects";
import {
  editPermissionOf,
  formatPropertyValue,
  isValueOf,
  meetsCondition,
  propertyKeyOfPermission,
  textSummaryOf,
  valueInUseAt,
  valueInUseOf,
  withTextCondition,
} from "./properties";
import type { Cadence } from "./schedules";
import { isTooFrequent, nextOccurrenceOf, occurrencesOf, repeatCadenceOf } from "./schedules";
import {
  iterationStatusOf,
  passesGates,
  publicStatusOf,
  statusFootnoteOf,
  validationOf,
} from "./status";
import {
  formatDayRange,
  formatRange,
  isReversedRange,
  isWithinRange,
  lastDaysRange,
  monthRange,
  parseCount,
  parseDay,
  parseDayRange,
  parseRange,
  resolveDayRange,
} from "./value-range";

const root = join(import.meta.dir, "../cases");
const functions: Record<string, (...args: unknown[]) => unknown> = {
  can: (...args) =>
    can(args[0] as ScopeHolder, args[1] as Permission, args[2] as ScopedRecord | undefined),
  hasPermission: (...args) => hasPermission(args[0] as GrantHolder, args[1] as Permission),
  scopesOf: (...args) => scopesOf(args[0] as GrantHolder, args[1] as Permission),
  isWithinScope: (...args) =>
    isWithinScope(args[0] as ScopeHolder, args[1] as GrantScope, args[2] as ScopedRecord),
  coversScope: (...args) => coversScope(args[0] as GrantScope, args[1] as GrantScope),
  requiredScopeOf: (...args) => requiredScopeOf(args[0] as Requirement, args[1] as GrantScope),
  catalogEntryOf: (...args) => catalogEntryOf(args[0] as Permission),
  isAcceptedGrant: (...args) => isAcceptedGrant(args[0] as Grant),
  missingRequirementsOf: (...args) => missingRequirementsOf(args[0] as Grant[]),
  withRequirements: (...args) => withRequirements(args[0] as Grant[]),
  permissionSchema: (...args) => permissionSchema.safeParse(args[0]).success,
  iterationStatusOf: (...args) => iterationStatusOf(args[0] as Iteration),
  publicStatusOf: (...args) => publicStatusOf(args[0] as Request, args[1] as Iteration | null),
  passesGates: (...args) => passesGates(args[0] as Iteration),
  validationOf: (...args) => validationOf(args[0] as Iteration),
  statusFootnoteOf: (...args) => statusFootnoteOf(args[0] as Iteration),
  occurrencesOf: (...args) =>
    occurrencesOf(args[0] as Cadence, date(args[1]), date(args[2]), args[3] as number | undefined),
  nextOccurrenceOf: (...args) => nextOccurrenceOf(args[0] as Cadence, date(args[1])),
  repeatCadenceOf: (...args) => repeatCadenceOf(args[0] as RepeatEvery),
  isTooFrequent: (...args) => isTooFrequent(args[0] as Cadence),
  formatRange: (...args) => formatRange(args[0] as never),
  parseRange: (...args) =>
    parseRange(
      args[0] as string,
      (args[1] === "day" ? parseDay : parseCount) as (raw: string) => never,
    ),
  isWithinRange: (...args) => isWithinRange(args[0] as never, args[1] as never),
  isReversedRange: (...args) => isReversedRange(args[0] as never),
  lastDaysRange: (...args) => lastDaysRange(date(args[0]), args[1] as number),
  monthRange: (...args) => monthRange(date(args[0])),
  formatDayRange: (...args) => formatDayRange(args[0] as never),
  parseDayRange: (...args) => parseDayRange(args[0] as string),
  resolveDayRange: (...args) => resolveDayRange(args[0] as never, date(args[1])),
  isInWindow: (...args) => isInWindow(args[0] as never, args[1] as string),
  intentionStateOf: (...args) => intentionStateOf(args[0] as never, args[1] as string),
  targetVerdictOf: (...args) =>
    targetVerdictOf({
      intention: args[0] as never,
      plannedPages: args[1] as number,
      deliveredPages: args[2] as number,
      today: args[3] as string,
    }),
  pagesPerWeekNeededOf: (...args) => pagesPerWeekNeededOf(args[0] as never),
  catchUpPagesOf: (...args) => catchUpPagesOf(args[0] as never),
  nextPeriodStartOf: (...args) => nextPeriodStartOf(args[0] as never, args[1] as string),
  periodOf: (...args) => periodOf(args[0] as never, args[1] as string),
  timeElapsedOf: (...args) => timeElapsedOf(args[0] as never, args[1] as string),
  daysUntil: (...args) => daysUntil(args[0] as string, args[1] as string),
  valueInUseOf: (...args) => valueInUseOf(args[0] as never),
  valueInUseAt: (...args) => valueInUseAt(args[0] as never, args[1] as string),
  isValueOf: (...args) => isValueOf(args[0] as never, args[1] as never),
  formatPropertyValue: (...args) => formatPropertyValue(args[0] as never, args[1] as never),
  textSummaryOf: (...args) => textSummaryOf(args[0] as never),
  withTextCondition: (...args) =>
    withTextCondition(args[0] as never, args[1] as never, args[2] as string),
  editPermissionOf: (...args) => editPermissionOf(args[0] as string),
  propertyKeyOfPermission: (...args) => propertyKeyOfPermission(args[0] as never),
  meetsCondition: (...args) => meetsCondition(args[0] as never, args[1] as never, date(args[2])),
};

const adapters: Record<
  string,
  { call: (input: Record<string, unknown>) => unknown; project: (result: unknown) => unknown }
> = {
  countIntention: {
    call: (input) => {
      const pagesById = input.pagesById as Record<string, number | null>;
      const data = {
        categories: input.categories,
        lists: input.lists,
        iterations: input.iterations,
        pagesOf: (iteration: { id: string }) => pagesById[iteration.id] ?? null,
      };
      return countIntention(input.intention as never, data as never);
    },
    project: (result) => {
      const count = result as {
        planned: { id: string }[];
        delivered: { id: string }[];
        output: { id: string }[];
        plannedPages: number;
        deliveredPages: number;
        outputPages: number;
        noDateCount: number;
        noPagesCount: number;
      };
      return {
        planned: count.planned.map((item) => item.id),
        delivered: count.delivered.map((item) => item.id),
        output: count.output.map((item) => item.id),
        plannedPages: count.plannedPages,
        deliveredPages: count.deliveredPages,
        outputPages: count.outputPages,
        noDateCount: count.noDateCount,
        noPagesCount: count.noPagesCount,
      };
    },
  },
  shareWithinOf: {
    call: (input) =>
      shareWithinOf(
        input.categories as never,
        input.distribution as never,
        input.scopeCategoryId as string | null,
        input.categoryId as string,
      ),
    project: (result) => result,
  },
  mixReadingOf: {
    call: (input) => {
      const iterationsById = new Map(
        (input.iterations as { id: string }[]).map((iteration) => [iteration.id, iteration]),
      );
      const pagesById = input.pagesById as Record<string, number | null>;
      const count = input.count as {
        plannedIds: string[];
        outputIds: string[];
        plannedPages: number;
        outputPages: number;
      };
      return mixReadingOf(
        input.intention as never,
        input.distribution as never,
        {
          planned: count.plannedIds.map((id) => iterationsById.get(id) as never),
          output: count.outputIds.map((id) => iterationsById.get(id) as never),
          plannedPages: count.plannedPages,
          outputPages: count.outputPages,
        },
        { categories: input.categories as never, pagesOf: (item) => pagesById[item.id] ?? null },
      );
    },
    project: (result) => {
      const reading = result as {
        rows: { categoryId: string; flag: string | null }[];
        unallocated: number;
        outOfBandCount: number;
      };
      return {
        rows: reading.rows.map((row) => [row.categoryId, row.flag]),
        unallocated: reading.unallocated,
        outOfBandCount: reading.outOfBandCount,
      };
    },
  },
  fillOf: {
    call: (input) => {
      const iterationsById = new Map(
        (input.iterations as { id: string }[]).map((iteration) => [iteration.id, iteration]),
      );
      const pagesById = input.pagesById as Record<string, number | null>;
      const count = input.count as { plannedIds: string[]; deliveredIds: string[] };
      return fillOf(
        input.intention as never,
        input.distribution as never,
        {
          planned: count.plannedIds.map((id) => iterationsById.get(id) as never),
          delivered: count.deliveredIds.map((id) => iterationsById.get(id) as never),
        },
        { categories: input.categories as never, pagesOf: (item) => pagesById[item.id] ?? null },
      );
    },
    project: (result) =>
      (
        result as {
          categoryId: string;
          targetPages: number | null;
          plannedPages: number;
          isShort: boolean;
        }[]
      ).map((row) => [row.categoryId, row.targetPages, row.plannedPages, row.isShort]),
  },
  correctionOf: {
    call: (input) => {
      const readyPagesByCategory = input.readyPagesByCategory as Record<string, number>;
      return correctionOf({
        rows: input.rows as never,
        outputPages: input.outputPages as number,
        pages: input.pages as number,
        readyPagesOf: (categoryId) => readyPagesByCategory[categoryId] ?? 0,
      });
    },
    project: (result) => {
      const correction = result as {
        isCut: boolean;
        rows: { categoryId: string; newPages: number; after: number; shortPages: number }[];
      };
      return {
        isCut: correction.isCut,
        rows: correction.rows.map((row) => [
          row.categoryId,
          row.newPages,
          row.after,
          row.shortPages,
        ]),
      };
    },
  },
  countsTowardsOf: {
    call: (input) => {
      const iterationsById = new Map(
        (input.iterations as { id: string }[]).map((iteration) => [iteration.id, iteration]),
      );
      const pagesById = input.pagesById as Record<string, number | null>;
      const members = (input.memberIds as string[]).map((id) => iterationsById.get(id) as never);
      return countsTowardsOf(input.intentions as never, members, input.startsOn as string, {
        categories: input.categories as never,
        pagesOf: (iteration: { id: string }) => pagesById[iteration.id] ?? null,
      });
    },
    project: (result) =>
      (result as { intention: { id: string }; itemCount: number; pages: number }[]).map((row) => [
        row.intention.id,
        row.itemCount,
        row.pages,
      ]),
  },
  listMixOf: {
    call: (input) => {
      const iterationsById = new Map(
        (input.iterations as { id: string }[]).map((iteration) => [iteration.id, iteration]),
      );
      const pagesById = input.pagesById as Record<string, number | null>;
      const members = (input.memberIds as string[]).map((id) => iterationsById.get(id) as never);
      return listMixOf(
        input.intention as never,
        input.distribution as never,
        members,
        input.goal as never,
        {
          categories: input.categories as never,
          pagesOf: (iteration: { id: string }) => pagesById[iteration.id] ?? null,
        },
      );
    },
    project: (result) =>
      (
        result as {
          categoryId: string;
          share: number | null;
          pages: number;
          goalPages: number | null;
        }[]
      ).map((row) => [row.categoryId, row.share, row.pages, row.goalPages]),
  },
};

function date(value: unknown): Date {
  return new Date(String(value));
}

function withBase(base: Record<string, unknown> | undefined, input: Record<string, unknown>) {
  const result = { ...input };
  for (const [key, value] of Object.entries(result)) {
    if (key.toLowerCase().includes("iteration") && value && typeof value === "object") {
      result[key] = { ...base, ...value };
    }
  }
  return result;
}

const files = await Array.fromAsync(new Bun.Glob("**/*.json").scan({ cwd: root }));
for (const path of files) {
  if (path === "case-file.schema.json") {
    continue;
  }
  const raw = await Bun.file(join(root, path)).json();
  const file = caseFileSchema.parse(raw);
  const fn = functions[file.function];
  if (fn === undefined && adapters[file.function] === undefined) {
    throw new Error(`No case runner function for ${file.function}`);
  }

  for (const entry of file.cases) {
    it(`${file.function}: ${entry.name} (${entry.rule ?? "no rule"})`, () => {
      const adapter = adapters[file.function];
      const input = adapter ? { ...file.base, ...entry.input } : withBase(file.base, entry.input);
      const result = adapter ? adapter.call(input) : fn(...Object.values(input));
      const actual = adapter ? adapter.project(result) : result;
      const comparable = normalize(actual);
      expect(comparable).toEqual(entry.expected);
    });
  }
}

describe("case file schema", () => {
  it("matches the committed JSON Schema", async () => {
    const committed = await Bun.file(join(root, "case-file.schema.json")).json();
    expect(committed).toEqual(caseFileJsonSchema);
  });
});

function normalize(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Set) {
    return [...value].sort();
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  return value;
}
