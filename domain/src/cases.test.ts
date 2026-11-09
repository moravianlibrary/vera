// Runs the domain's rule cases from JSON, as the backend's JUnit suite will.

import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { caseFileJsonSchema, caseFileSchema } from "../cases/case-file";
import {
  grantsOf,
  heldRoleIdsOf,
  heldRolesOf,
  isSuspended,
  managersOf,
  roleNameOf,
} from "./access";
import {
  categoryLineageOf,
  categoryPathOf,
  custodyReachOf,
  isInSubtree,
  isNameTaken,
  isOutsideScope,
  leafCategoriesOf,
  placesFor,
  scopeOfCategory,
  searchedCategoriesOf,
  unheldCategoriesOf,
} from "./categories";
import {
  additionStateOf,
  batchIdOf,
  effectivePageCount,
  existingCopyStateOf,
  projectIdOf,
  publicRecordStatusOf,
  recordStatusOf,
} from "./documents";
import type { Iteration, RepeatEvery, Request } from "./entities";
import {
  catchUpPagesOf,
  correctionOf,
  countIntention,
  countsTowardsOf,
  fillOf,
  intentionStateOf,
  intentionTimeElapsedOf,
  isInIntentionScope,
  isInWindow,
  listMixOf,
  mixCategoriesOf,
  mixNodesOf,
  mixReadingOf,
  nextPeriodStartOf,
  pagesPerWeekNeededOf,
  scopeOfIntention,
  shareWithinOf,
  targetVerdictOf,
} from "./intentions";
import {
  isCancellable,
  isOverrulable,
  isPublishable,
  isReclassifiable,
  isResumable,
  progressAfterGates,
  scopeOfIteration,
} from "./iterations";
import {
  isInPool,
  isOverdue,
  isScanned,
  listStateOf,
  memberBlockerOf,
  progressOnList,
} from "./lists";
import { effectiveShareOf, siblingSetOf } from "./mixes";
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
import { daysUntil, isProjectMember, periodOf, scopeOfProject, timeElapsedOf } from "./projects";
import {
  editPermissionOf,
  facetValueOf,
  formatPropertyValue,
  isActiveCondition,
  isValueOf,
  mayBeEnteredByHand,
  meetsCondition,
  propertyKeyOfPermission,
  sourcesByTierOf,
  textSummaryOf,
  valueInUseAt,
  valueInUseOf,
  valuesOf,
  withTextCondition,
} from "./properties";
import { isBeingChecked, isBulkApprovable, rowDecisionOf } from "./requests";
import type { Cadence } from "./schedules";
import { isTooFrequent, nextOccurrenceOf, occurrencesOf, repeatCadenceOf } from "./schedules";
import {
  decisionStatusOf,
  iterationStatusOf,
  passesGates,
  publicIterationStatusOf,
  publicStatusOf,
  statusFootnoteOf,
  validationOf,
} from "./status";
import {
  acceptedDefectsOf,
  defectNameOf,
  defectsToRuleOn,
  deniedDefectsOf,
  isFoundAfterScan,
  reviewStateOf,
  waitingSinceOf,
} from "./validations";
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
  isSuspended: (...args) => isSuspended(args[0] as never),
  categoryPathOf: (...args) => categoryPathOf(args[0] as never, args[1] as string),
  categoryLineageOf: (...args) => categoryLineageOf(args[0] as never, args[1] as string),
  leafCategoriesOf: (...args) => leafCategoriesOf(args[0] as never),
  isInSubtree: (...args) => isInSubtree(args[0] as never, args[1] as string, args[2] as string),
  searchedCategoriesOf: (...args) => searchedCategoriesOf(args[0] as never, args[1] as string),
  isOutsideScope: (...args) =>
    isOutsideScope(args[0] as never, args[1] as string | null, args[2] as string | null),
  custodyReachOf: (...args) =>
    custodyReachOf(args[0] as never, args[1] as never, args[2] as string),
  unheldCategoriesOf: (...args) => unheldCategoriesOf(args[0] as never, args[1] as never),
  scopeOfCategory: (...args) => scopeOfCategory(args[0] as never, args[1] as string | null),
  placesFor: (...args) =>
    placesFor(
      args[0] as never,
      args[1] as string,
      (id) => (args[2] as Record<string, boolean>)[id] ?? false,
    ),
  isNameTaken: (...args) =>
    isNameTaken(
      args[0] as never,
      args[1] as string | null,
      args[2] as string,
      args[3] as string | null,
    ),
  heldRolesOf: (...args) => heldRolesOf(args[0] as never),
  heldRoleIdsOf: (...args) => heldRoleIdsOf(args[0] as never),
  grantsOf: (...args) => grantsOf(args[0] as never, args[1] as string[]),
  can: (...args) =>
    can(args[0] as ScopeHolder, args[1] as Permission, args[2] as ScopedRecord | undefined),
  hasPermission: (...args) => hasPermission(args[0] as GrantHolder, args[1] as Permission),
  managersOf: (...args) => managersOf(args[0] as never, args[1] as never),
  roleNameOf: (...args) => roleNameOf(args[0] as string),
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
  scopeOfIntention: (...args) => scopeOfIntention(args[0] as never, args[1] as never),
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
  publicIterationStatusOf: (...args) => publicIterationStatusOf(args[0] as never),
  decisionStatusOf: (...args) => decisionStatusOf(args[0] as never),
  parseCount: (...args) => parseCount(args[0] as string),
  parseDay: (...args) => parseDay(args[0] as string),
  recordStatusOf: (...args) => recordStatusOf(args[0] as never),
  publicRecordStatusOf: (...args) => publicRecordStatusOf(args[0] as never, args[1] as string),
  additionStateOf: (...args) => additionStateOf(args[0] as never),
  effectivePageCount: (...args) => effectivePageCount(args[0] as never),
  existingCopyStateOf: (...args) => existingCopyStateOf(args[0] as never),
  projectIdOf: (...args) => projectIdOf(args[0] as never),
  batchIdOf: (...args) => batchIdOf(args[0] as never),
  rowDecisionOf: (...args) => rowDecisionOf(args[0] as never),
  isBeingChecked: (...args) => isBeingChecked(args[0] as never),
  isBulkApprovable: (...args) => isBulkApprovable(args[0] as never),
  isReclassifiable: (...args) => isReclassifiable(args[0] as Iteration),
  isPublishable: (...args) => isPublishable(args[0] as Iteration),
  isCancellable: (...args) => isCancellable(args[0] as Iteration),
  isResumable: (...args) => isResumable(args[0] as Iteration),
  isOverrulable: (...args) => isOverrulable(args[0] as Iteration),
  progressAfterGates: (...args) => progressAfterGates(args[0] as Iteration),
  reviewStateOf: (...args) => reviewStateOf(args[0] as Iteration),
  waitingSinceOf: (...args) => waitingSinceOf(args[0] as Iteration),
  defectsToRuleOn: (...args) => defectsToRuleOn(args[0] as Iteration),
  acceptedDefectsOf: (...args) => acceptedDefectsOf(args[0] as Iteration),
  deniedDefectsOf: (...args) => deniedDefectsOf(args[0] as Iteration),
  isFoundAfterScan: (...args) => isFoundAfterScan(args[0] as Iteration),
  listStateOf: (...args) => listStateOf(args[0] as never, args[1] as string),
  isOverdue: (...args) => isOverdue(args[0] as never, args[1] as string),
  progressOnList: (...args) => progressOnList(args[0] as never, args[1] as string),
  isScanned: (...args) => isScanned(args[0] as Iteration),
  memberBlockerOf: (...args) => memberBlockerOf(args[0] as Iteration),
  isInPool: (...args) => isInPool(args[0] as Iteration),
  isProjectMember: (...args) =>
    isProjectMember(args[0] as never, args[1] as string, args[2] as string[]),
  scopeOfProject: (...args) => scopeOfProject(args[0] as never),
  mayBeEnteredByHand: (...args) => mayBeEnteredByHand(args[0] as never),
  sourcesByTierOf: (...args) => sourcesByTierOf(args[0] as never),
  valuesOf: (...args) => valuesOf(args[0] as never, args[1] as string),
  isActiveCondition: (...args) => isActiveCondition(args[0] as never),
  facetValueOf: (...args) => facetValueOf(args[0] as never),
};

const adapters: Record<
  string,
  { call: (input: Record<string, unknown>) => unknown; project: (result: unknown) => unknown }
> = {
  categoryPathOf: {
    call: (i) => categoryPathOf(i.categories as never, i.categoryId as string),
    project: (r) => r,
  },
  categoryLineageOf: {
    call: (i) => categoryLineageOf(i.categories as never, i.categoryId as string),
    project: (r) => r,
  },
  leafCategoriesOf: { call: (i) => leafCategoriesOf(i.categories as never), project: (r) => r },
  isInSubtree: {
    call: (i) => isInSubtree(i.categories as never, i.categoryId as string, i.topId as string),
    project: (r) => r,
  },
  searchedCategoriesOf: {
    call: (i) => searchedCategoriesOf(i.categories as never, i.search as string),
    project: (r) => r,
  },
  isOutsideScope: {
    call: (i) =>
      isOutsideScope(
        i.categories as never,
        i.scopeCategoryId as string | null,
        i.categoryId as string | null,
      ),
    project: (r) => r,
  },
  custodyReachOf: {
    call: (i) => custodyReachOf(i.categories as never, i.holders as never, i.categoryId as string),
    project: (r) => r,
  },
  unheldCategoriesOf: {
    call: (i) => unheldCategoriesOf(i.categories as never, i.holders as never),
    project: (r) => r,
  },
  scopeOfCategory: {
    call: (i) => scopeOfCategory(i.categories as never, i.categoryId as string | null),
    project: (r) => r,
  },
  placesFor: {
    call: (i) =>
      placesFor(
        i.categories as never,
        i.categoryId as string,
        (id) => (i.documentsByCategory as Record<string, boolean>)[id] ?? false,
      ),
    project: (r) => r,
  },
  isNameTaken: {
    call: (i) =>
      isNameTaken(
        i.categories as never,
        i.parentId as string | null,
        i.name as string,
        i.exceptId as string | null,
      ),
    project: (r) => r,
  },
  pagesPerWeekNeededOf: { call: (i) => pagesPerWeekNeededOf(i.input as never), project: (r) => r },
  catchUpPagesOf: { call: (i) => catchUpPagesOf(i.input as never), project: (r) => r },
  nextPeriodStartOf: {
    call: (i) => nextPeriodStartOf(i.period as never, i.today as string),
    project: (r) => r,
  },
  scopeOfIntention: {
    call: (i) => scopeOfIntention(i.intention as never, i.projects as never),
    project: (r) => r,
  },
  intentionTimeElapsedOf: {
    call: (input) => intentionTimeElapsedOf(input.intention as never, input.today as string),
    project: (result) => result,
  },
  isInIntentionScope: {
    call: (input) =>
      isInIntentionScope(
        input.intention as never,
        input.iteration as never,
        input.categories as never,
        "conditionsMatch" in input ? () => input.conditionsMatch as boolean : undefined,
      ),
    project: (result) => result,
  },
  scopeOfIteration: {
    call: (input) => scopeOfIteration(input.categories as never, input.categoryId as string),
    project: (result) => result,
  },
  defectNameOf: {
    call: (input) =>
      defectNameOf(
        input.defect as never,
        (id) => (input.instanceNames as Record<string, string>)[id] ?? id,
      ),
    project: (result) => result,
  },
  countIntention: {
    call: (input) => {
      const pagesById = input.pagesById as Record<string, number | null>;
      const data = {
        categories: input.categories,
        lists: input.lists,
        iterations: input.iterations,
        pagesOf: (iteration: { id: string }) => pagesById[iteration.id] ?? null,
        meetsConditions:
          "conditionsMatch" in input ? () => input.conditionsMatch as boolean : undefined,
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
  effectiveShareOf: {
    call: (input) =>
      effectiveShareOf(
        input.categories as never,
        input.shares as never,
        input.categoryId as string,
      ),
    project: (result) => result,
  },
  siblingSetOf: {
    call: (input) =>
      siblingSetOf(
        input.categories as never,
        input.shares as never,
        input.parentId as string | null,
      ),
    project: (result) => result,
  },
  mixCategoriesOf: {
    call: (input) =>
      mixCategoriesOf(input.categories as never, input.scopeCategoryId as string | null).map(
        (item) => item.id,
      ),
    project: (result) => result,
  },
  mixNodesOf: {
    call: (input) =>
      mixNodesOf(input.categories as never, input.scopeCategoryId as string | null).map(
        (item) => item.id,
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
        meetsConditions:
          "conditionsMatch" in input ? () => input.conditionsMatch as boolean : undefined,
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
    if (
      key.toLowerCase().includes("iteration") &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
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
