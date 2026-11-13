// The Tasks resource (page-composition.md §5 *Tasks*; STATUS "Tasks"; plugins.md §2.4): the runs
// the caller sees, `task.read` everyone's and `task.read_own` only their own, with the running ones
// apart, the finished ones filtered, the tiles' numbers and how long runs are kept; one run with
// its items, what it changed and its log; the running runs alone, for the sidebar's panel; and
// what is done to a run: cancel it, run it again. A run's progress and time left are the
// server's, read against the moment it answered (`asOf`).

import { pluginInstanceSchema } from "@vera/domain/plugins";
import { cadenceSchema } from "@vera/domain/schedules";
import type { RunState, TriggerKind } from "@vera/domain/tasks";
import { runStates, triggerKinds } from "@vera/domain/tasks";
import type { DayRange } from "@vera/domain/value-range";
import { formatDayRange, parseDayRange } from "@vera/domain/value-range";
import { z } from "zod";
import { facetCountsOf } from "./facets";

const id = z.string().min(1);

const timestamp = z.iso.datetime();

const count = z.number().int().nonnegative();

// ---------------------------------------------------------------- query

// Each list matches any of its values; the fields together match all of them (filtering.md §2).
// A state may name Running as well as a finished state; Running is still its own page section.
export interface RunQuery {
  readonly search?: string;
  readonly states?: readonly RunState[];
  readonly triggers?: readonly TriggerKind[];
  readonly instanceIds?: readonly string[];
  // People only: VERA's own runs are found by their trigger.
  readonly startedBy?: readonly string[];
  readonly started?: DayRange;
}

export type RunListField = Exclude<keyof RunQuery, "search" | "started">;

// Query-string names; the same names address the filter in the page URL.
export const runQueryParams = {
  search: "q",
  states: "state",
  triggers: "trigger",
  instanceIds: "plugin",
  startedBy: "by",
  started: "started",
} as const satisfies Record<keyof RunQuery, string>;

const runStateValueSchema = z.enum(runStates);

const triggerKindSchema = z.enum(triggerKinds);

export const runQueryEnumParams = {
  state: runStateValueSchema,
  trigger: triggerKindSchema,
} as const;

const runFieldSchemas = {
  states: runQueryEnumParams.state,
  triggers: runQueryEnumParams.trigger,
  instanceIds: id,
  startedBy: id,
} as const satisfies Record<RunListField, z.ZodType<string>>;

const listFields = Object.keys(runFieldSchemas) as RunListField[];

const listSeparator = ",";

export function toRunSearchParams(query: RunQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(runQueryParams.search, search);
  }

  for (const field of listFields) {
    const values = query[field];
    if (values === undefined || values.length === 0) {
      continue;
    }

    params.set(runQueryParams[field], values.toSorted().join(listSeparator));
  }

  const started = formatDayRange(query.started);
  if (started !== null) params.set(runQueryParams.started, started);

  return params;
}

// Unknown or malformed values are dropped, so a stale link still opens the view.
export function parseRunSearchParams(params: URLSearchParams): RunQuery {
  const query: Record<string, unknown> = {
    search: params.get(runQueryParams.search)?.trim() || undefined,
  };
  for (const field of listFields) {
    const raw = params.get(runQueryParams[field]) ?? "";
    const values = raw.split(listSeparator).flatMap((value) => {
      const parsed = runFieldSchemas[field].safeParse(value.trim());
      return parsed.success ? [parsed.data] : [];
    });
    query[field] = values.length === 0 ? undefined : [...new Set(values)];
  }

  query.started = parseDayRange(params.get(runQueryParams.started));

  // Every value of each field was parsed by that field's own schema.
  return query as RunQuery;
}

export function isSameRunQuery(first: RunQuery, second: RunQuery): boolean {
  const canonical = (query: RunQuery) => {
    const params = toRunSearchParams(query);
    params.sort();
    return params.toString();
  };

  return canonical(first) === canonical(second);
}

// ---------------------------------------------------------------- one run

// A page of the application: where a person started it from, or what it changed.
export const placeSchema = z.object({ label: z.string(), path: z.string().startsWith("/") });

export type Place = z.infer<typeof placeSchema>;

// What ran: a plugin instance, or a core job such as an intention repeat.
export const runSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plugin"), instance: pluginInstanceSchema }),
  z.object({ kind: z.literal("core"), name: z.string() }),
]);

export type RunSource = z.infer<typeof runSourceSchema>;

// What started it. A schedule's cadence is the one it had then, since a schedule changes or goes.
export const runTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("schedule"), scheduleId: id, cadence: cadenceSchema }),
  z.object({
    kind: z.literal("repeat"),
    templateId: id,
    name: z.string(),
    cadence: cadenceSchema,
  }),
  // Ingest, when an approval enqueued it: never started by hand (plugins.md §2.4).
  z.object({ kind: z.literal("approval"), from: placeSchema }),
  z.object({ kind: z.literal("manual"), from: placeSchema }),
]);

export type RunTrigger = z.infer<typeof runTriggerSchema>;

export const runSchema = z.object({
  id,
  // "Kramerius — registry refresh".
  what: z.string(),
  source: runSourceSchema,
  trigger: runTriggerSchema,
  // Null: VERA itself, on a schedule or a repeat.
  startedBy: id.nullable(),
  state: z.enum(runStates),
  startedAt: timestamp,
  finishedAt: timestamp.nullable(),
  itemCount: count,
  doneCount: count,
  // So far, while it runs.
  errorCount: count,
  // While it runs.
  secondsLeft: count.nullable(),
  // Each with the page that shows it; null while it runs.
  changes: z.array(placeSchema).nullable(),
  // What stopped a failed run.
  failure: z.string().nullable(),
  // Why it was skipped, or where a cancelled one stopped.
  note: z.string().nullable(),
  cancelledBy: id.nullable(),
  // The run this one ran again; that one stays as it was.
  rerunOf: id.nullable(),
  // A plugin run can be run again; a core job runs on its own.
  isRerunnable: z.boolean(),
});

export type Run = z.infer<typeof runSchema>;

// ---------------------------------------------------------------- the page

// Runs are removed after this many days, failed and cancelled ones after the second.
export const retentionSchema = z.object({
  days: z.number().int().min(7),
  failedDays: z.number().int().min(7),
});

export type Retention = z.infer<typeof retentionSchema>;

export const runTilesSchema = z.object({
  runningCount: count,
  // Over the last 7 days.
  failedCount: count,
  withErrorsCount: count,
  finishedCount: count,
  lastFailureAt: timestamp.nullable(),
  // The next scheduled run; only with `task.read`, which sees the schedules.
  nextRun: z.object({ at: timestamp, name: z.string() }).nullable(),
});

export type RunTiles = z.infer<typeof runTilesSchema>;

export const runIndexSchema = z.object({
  // The server's clock when it answered: started, took and time left read against it.
  asOf: timestamp,
  // Matching every filter but State; none once a state is picked.
  running: z.array(runSchema),
  // Newest first.
  finished: z.array(runSchema),
  // Runs the caller sees at all, before any filter: none says nothing has run for them yet.
  visibleCount: count,
  tiles: runTilesSchema,
  nextRuns: z.array(
    z.object({ at: timestamp, name: z.string(), path: z.string().startsWith("/") }),
  ),
  facets: z.object({
    states: facetCountsOf(runStateValueSchema),
    triggers: facetCountsOf(triggerKindSchema),
    instanceIds: facetCountsOf(z.string()),
    startedBy: facetCountsOf(z.string()),
  } satisfies Record<RunListField, z.ZodType>),
  retention: retentionSchema,
  // Only with `task.read`.
  schedules: z.object({ activeCount: count, pausedCount: count }).nullable(),
});

export type RunIndex = z.infer<typeof runIndexSchema>;

// One item of the run: an iteration, and what went wrong with it, if anything.
export const runItemSchema = z.object({
  iterationId: id,
  title: z.string(),
  error: z.string().nullable(),
});

export type RunItem = z.infer<typeof runItemSchema>;

export const logLineSchema = z.object({ at: timestamp, text: z.string(), isError: z.boolean() });

export type LogLine = z.infer<typeof logLineSchema>;

export const runDetailSchema = z.object({
  asOf: timestamp,
  run: runSchema,
  // Every error, and the first items of the run with them.
  errors: z.array(runItemSchema),
  items: z.array(runItemSchema),
  log: z.array(logLineSchema),
});

export type RunDetail = z.infer<typeof runDetailSchema>;

// The sidebar's panel: what is running that the caller sees (navigation.md §6).
export const runningRunsSchema = z.object({ asOf: timestamp, runs: z.array(runSchema) });

export type RunningRuns = z.infer<typeof runningRunsSchema>;
