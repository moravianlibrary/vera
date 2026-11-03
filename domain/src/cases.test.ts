// Runs the domain's rule cases from JSON, as the backend's JUnit suite will.

import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { caseFileJsonSchema, caseFileSchema } from "../cases/case-file";
import type { Iteration, RepeatEvery, Request } from "./entities";
import { intentionStateOf, isInWindow, nextPeriodStartOf, targetVerdictOf } from "./intentions";
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
  if (fn === undefined) {
    throw new Error(`No case runner function for ${file.function}`);
  }

  for (const entry of file.cases) {
    it(`${file.function}: ${entry.name} (${entry.rule ?? "no rule"})`, () => {
      const input = withBase(file.base, entry.input);
      const args = Object.values(input);
      const actual = fn(...args);
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
