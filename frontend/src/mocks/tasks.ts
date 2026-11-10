// What the server does for Tasks (page-composition.md §5 *Tasks*; STATUS "Tasks"; permissions.md
// §3, Administration): it answers the runs a person sees, `task.read` everyone's and
// `task.read_own` the ones they started, as they stand at the mock's moment, so a run still going
// has got as far as its pace takes it and finishes by itself. Runs past retention are gone. Cancel
// is for whoever started the run or `task.cancel`; running a failed or cancelled plugin run again
// for whoever started it or `plugin.run`; how long runs are kept is `task.schedule`'s.

import type {
  Place,
  Retention,
  Run,
  RunDetail,
  RunIndex,
  RunItem,
  RunListField,
  RunningRuns,
  RunQuery,
  RunTrigger,
} from "@vera/contract/tasks";
import { runIndexSchema } from "@vera/contract/tasks";
import { openProposalPlacements } from "@vera/contract/queries/requests";
import { countValues } from "@vera/domain/arrangement";
import { isAttemptOver } from "@vera/domain/documents";
import type { Session } from "@vera/domain/entities";
import { hasAnyPermission, hasPermission } from "@vera/domain/permissions";
import { nextOccurrenceOf, repeatCadenceOf } from "@vera/domain/schedules";
import type { RunState } from "@vera/domain/tasks";
import { canCancelRun, canRunAgain } from "@vera/domain/tasks";
import { dayOf, isReversedRange, isWithinRange, resolveDayRange } from "@vera/domain/value-range";
import { database, mockStore } from "@/mocks/database";
import type { StoredPluginInstance } from "@/mocks/fixtures/plugins";
import type { StoredRun } from "@/mocks/fixtures/tasks";
import type { Outcome } from "@/mocks/mutations";
import { findInstanceSummary, implementationOf, kindOf } from "@/mocks/plugin-instances";
import { mockRequestPlugins } from "@/mocks/requests";
import { mockNow } from "@/mocks/today";

const minuteMilliseconds = 60_000;
const dayMilliseconds = 24 * 60 * minuteMilliseconds;
const tileDays = 7;
// The first items of a run the pane lists beside its errors.
const listedItemCount = 6;

export function canReadRuns(session: Session): boolean {
  return hasAnyPermission(session, ["task.read_own", "task.read"]);
}

// ---------------------------------------------------------------- one run, now

interface Progress {
  readonly state: RunState;
  readonly doneCount: number;
  readonly finishedAt: Date | null;
}

// The server leaves a running row alone until its job advances it (PLG-run-items).
function progressOf(run: StoredRun): Progress {
  if (run.ending !== null) {
    const isDoneWithErrors = run.ending.state === "Done" && run.errors.length > 0;
    return {
      state: isDoneWithErrors ? "DoneWithErrors" : run.ending.state,
      doneCount: run.ending.doneCount,
      finishedAt: run.ending.finishedAt,
    };
  }

  return { state: "Running", doneCount: run.doneCount ?? 0, finishedAt: null };
}

// A failed, cancelled or skipped run names no changes; a cancelled one's count says how far it got.
function hasFinishedItsWork(state: RunState): boolean {
  return state === "Done" || state === "DoneWithErrors";
}

function errorsSoFar(run: StoredRun, progress: Progress) {
  return progress.state === "Running" || progress.state === "Cancelled"
    ? run.errors.filter((error) => error.atItem < progress.doneCount)
    : run.errors;
}

// The server reports a run's stored progress and has no estimate before work starts (PLG-run-items).
export function publicRunOf(run: StoredRun, _now: Date): Run {
  const progress = progressOf(run);
  const isRunning = progress.state === "Running";
  const pace = run.itemsPerMinute;
  const instance = findInstanceSummary(run.instanceId);
  return {
    id: run.id,
    what: run.what,
    source:
      instance === undefined
        ? { kind: "core", name: run.coreName ?? "VERA" }
        : { kind: "plugin", instance },
    trigger: run.trigger,
    startedBy: run.startedBy,
    state: progress.state,
    startedAt: run.startedAt.toISOString(),
    finishedAt: progress.finishedAt?.toISOString() ?? null,
    itemCount: run.itemCount,
    doneCount: progress.doneCount,
    errorCount: errorsSoFar(run, progress).length,
    secondsLeft:
      isRunning && pace !== null
        ? Math.ceil(((run.itemCount - progress.doneCount) / pace) * 60 - 1e-9)
        : null,
    changes: isRunning ? null : hasFinishedItsWork(progress.state) ? [...run.changes] : [],
    failure: run.failure,
    note: run.note,
    cancelledBy: run.cancelledBy,
    rerunOf: run.rerunOf,
    isRerunnable: run.instanceId !== null,
  };
}

// ---------------------------------------------------------------- reach

// Past retention a run is gone: failed and cancelled ones are kept longer.
function isKept(run: Run, now: Date): boolean {
  const { days, failedDays } = database.taskRetention;
  const keptDays = run.state === "Failed" || run.state === "Cancelled" ? failedDays : days;
  return now.getTime() - Date.parse(run.startedAt) < keptDays * dayMilliseconds;
}

function visibleRuns(session: Session, now: Date): Run[] {
  const seesEveryone = hasPermission(session, "task.read");
  return database.runs
    .filter((run) => seesEveryone || run.startedBy === session.user.id)
    .map((run) => publicRunOf(run, now))
    .filter((run) => isKept(run, now))
    .toSorted((first, second) => Date.parse(second.startedAt) - Date.parse(first.startedAt));
}

// An instance's runs still kept, newest first, whoever started them: Plugins shows them all.
export function instanceRunsOf(instanceId: string, now: Date): Run[] {
  return database.runs
    .filter((run) => run.instanceId === instanceId)
    .map((run) => publicRunOf(run, now))
    .filter((run) => isKept(run, now))
    .toSorted((first, second) => Date.parse(second.startedAt) - Date.parse(first.startedAt));
}

function findVisibleRun(session: Session, runId: string, now: Date): Run | null {
  return visibleRuns(session, now).find((run) => run.id === runId) ?? null;
}

// ---------------------------------------------------------------- the page

const fieldValues = {
  states: (run) => [run.state],
  triggers: (run) => [run.trigger.kind],
  instanceIds: (run) => (run.source.kind === "plugin" ? [run.source.instance.id] : []),
  startedBy: (run) => (run.startedBy === null ? [] : [run.startedBy]),
} as const satisfies Record<RunListField, (run: Run) => readonly string[]>;

const listFields = Object.keys(fieldValues) as RunListField[];

function predicatesOf(query: RunQuery, now: Date) {
  const search = query.search?.trim().toLocaleLowerCase();
  const predicates: { field: keyof RunQuery; matches: (run: Run) => boolean }[] = [];
  if (search) {
    predicates.push({
      field: "search",
      matches: (run) =>
        run.what.toLocaleLowerCase().includes(search) || run.id.toLowerCase().includes(search),
    });
  }

  if (query.started !== undefined) {
    const range = resolveDayRange(query.started, now);
    predicates.push({
      field: "started",
      matches: (run) =>
        !isReversedRange(range) && isWithinRange(dayOf(new Date(run.startedAt)), range),
    });
  }

  for (const field of listFields) {
    const wanted: readonly string[] | undefined = query[field];
    if (wanted === undefined || wanted.length === 0) {
      continue;
    }

    predicates.push({
      field,
      matches: (run) => fieldValues[field](run).some((value) => wanted.includes(value)),
    });
  }

  return predicates;
}

export function queryRuns(session: Session, query: RunQuery): RunIndex {
  const now = mockNow();
  const visible = visibleRuns(session, now);
  const predicates = predicatesOf(query, now);
  const matchingAllBut = (field: RunListField | null) =>
    visible.filter((run) =>
      predicates.every((predicate) => predicate.field === field || predicate.matches(run)),
    );
  const finished = visible.filter((run) => run.state !== "Running");
  const recent = finished.filter(
    (run) => now.getTime() - Date.parse(run.startedAt) < tileDays * dayMilliseconds,
  );
  const lastFailure = finished.find((run) => run.state === "Failed");
  const seesSchedules = hasPermission(session, "task.read");
  const pausedCount = database.schedules.filter((schedule) => schedule.pause !== null).length;
  const nextRuns = seesSchedules ? nextScheduledRuns(now) : [];

  return {
    asOf: now.toISOString(),
    running: matchingAllBut(null).filter((run) => run.state === "Running"),
    finished: matchingAllBut(null).filter((run) => run.state !== "Running"),
    visibleCount: visible.length,
    tiles: {
      runningCount: visible.length - finished.length,
      failedCount: recent.filter((run) => run.state === "Failed").length,
      withErrorsCount: recent.filter((run) => run.state === "DoneWithErrors").length,
      finishedCount: recent.filter((run) => run.state === "Done" || run.state === "DoneWithErrors")
        .length,
      lastFailureAt: lastFailure?.startedAt ?? null,
      nextRun: nextRuns[0] === undefined ? null : { at: nextRuns[0].at, name: nextRuns[0].name },
    },
    nextRuns,
    // Each list's values were produced by that field's own value function.
    facets: runIndexSchema.shape.facets.parse(
      Object.fromEntries(
        listFields.map((field) => [
          field,
          countValues(matchingAllBut(field).flatMap(fieldValues[field])),
        ]),
      ),
    ),
    retention: { ...database.taskRetention },
    schedules: seesSchedules
      ? { activeCount: database.schedules.length - pausedCount, pausedCount }
      : null,
  };
}

// The soonest run of a schedule that is not paused, or of a repeat.
function nextScheduledRuns(now: Date): { at: string; name: string; path: string }[] {
  const upcoming = [
    ...database.schedules
      .filter((schedule) => schedule.pause === null)
      .map((schedule) => ({
        name: schedule.name,
        at: nextOccurrenceOf(schedule.cadence, now),
        path: `/schedules?s=${encodeURIComponent(schedule.id)}`,
      })),
    ...database.intentionTemplates.map((template) => ({
      name: template.namePattern.replace("{period}", "next period"),
      at: nextOccurrenceOf(repeatCadenceOf(template.every), now),
      path: `/intentions?t=${encodeURIComponent(template.id)}`,
    })),
  ].flatMap(({ name, at, path }) => (at === null ? [] : [{ name, at, path }]));
  return upcoming
    .toSorted((first, second) => first.at.getTime() - second.at.getTime())
    .map(({ name, at, path }) => ({ name, at: at.toISOString(), path }));
}

export function runningRuns(session: Session): RunningRuns {
  const now = mockNow();
  return {
    asOf: now.toISOString(),
    runs: visibleRuns(session, now).filter((run) => run.state === "Running"),
  };
}

// ---------------------------------------------------------------- one run's detail

export function findRunDetail(session: Session, runId: string): RunDetail | null {
  const now = mockNow();
  const run = findVisibleRun(session, runId, now);
  const stored = database.runs.find((candidate) => candidate.id === runId);
  if (run === null || stored === undefined) {
    return null;
  }

  const errors = errorsSoFar(stored, progressOf(stored)).map((error) =>
    itemOf(error.iterationId, error.message),
  );
  const okCount = Math.max(0, Math.min(listedItemCount, run.doneCount - errors.length));
  const okItems = database.iterations
    .filter((iteration) => !errors.some((error) => error.iterationId === iteration.id))
    .slice(0, okCount)
    .map((iteration) => itemOf(iteration.id, null));

  return {
    asOf: now.toISOString(),
    run,
    errors,
    items: [...errors, ...okItems],
    log: logOf(stored, run, now),
  };
}

function itemOf(iterationId: string, error: string | null): RunItem {
  const iteration = database.iterations.find((candidate) => candidate.id === iterationId);
  const document = database.documents.find((candidate) => candidate.id === iteration?.documentId);
  return { iterationId, title: document?.title ?? "", error };
}

function nameOf(userId: string | null): string {
  if (userId === null) {
    return "VERA";
  }

  return database.users.find((user) => user.id === userId)?.name ?? userId;
}

function triggerWords(trigger: RunTrigger, startedBy: string | null): string {
  switch (trigger.kind) {
    case "schedule":
      return `schedule ${trigger.scheduleId}`;
    case "repeat":
      return `intention repeat ${trigger.templateId}`;
    case "approval":
      return `on approval by ${nameOf(startedBy)}`;
    case "manual":
      return `by ${nameOf(startedBy)}, from ${trigger.from.label}`;
  }
}

const stateWords = {
  Running: "running",
  Done: "done",
  DoneWithErrors: "done with errors",
  Failed: "failed",
  Cancelled: "cancelled",
  Skipped: "skipped",
} as const satisfies Record<RunState, string>;

// What the run wrote down as it went: an error where its item was reached, the end at the end.
function logOf(stored: StoredRun, run: Run, now: Date) {
  const startedAt = stored.startedAt.getTime();
  const endAt = run.finishedAt === null ? now.getTime() : Date.parse(run.finishedAt);
  const atItem = (item: number) =>
    new Date(startedAt + ((endAt - startedAt) * item) / Math.max(1, run.doneCount)).toISOString();
  const line = (at: Date | string, text: string, isError = false) => ({
    at: typeof at === "string" ? at : at.toISOString(),
    text,
    isError,
  });
  const lines = [
    line(
      stored.startedAt,
      `${run.id} started — ${run.what} (${triggerWords(run.trigger, run.startedBy)})`,
    ),
  ];
  if (run.state === "Skipped") {
    return [...lines, line(stored.startedAt, `skipped — ${run.note ?? ""}`)];
  }

  const ended = new Date(endAt);
  for (const error of errorsSoFar(stored, progressOf(stored))) {
    lines.push(line(atItem(error.atItem), `${error.iterationId} ${error.message}`, true));
  }

  if (run.failure !== null) {
    lines.push(line(ended, run.failure, true));
  }

  lines.push(line(ended, `${run.doneCount} of ${run.itemCount} processed`));
  for (const change of run.changes ?? []) {
    lines.push(line(ended, `changed: ${change.label}`));
  }

  if (run.state === "Cancelled") {
    lines.push(line(ended, `cancelled by ${nameOf(run.cancelledBy)}`));
  }

  lines.push(
    line(ended, run.state === "Running" ? "… running" : `finished — ${stateWords[run.state]}`),
  );
  return lines;
}

export function runLogText(session: Session, runId: string): string | null {
  const detail = findRunDetail(session, runId);
  if (detail === null) {
    return null;
  }

  return detail.log.map((line) => `[${line.at}] ${line.text}`).join("\n");
}

// ---------------------------------------------------------------- acts

export function cancelRun(session: Session, runId: string): Outcome<Run> {
  const now = mockNow();
  const run = findVisibleRun(session, runId, now);
  const index = database.runs.findIndex((candidate) => candidate.id === runId);
  if (run === null || index < 0) {
    return { refusal: { status: 404, message: "No such run" } };
  }

  if (run.state !== "Running") {
    return {
      refusal: { status: 409, message: "It has already finished", code: "task.not_running" },
    };
  }

  if (!canCancelRun(session, run)) {
    return { refusal: { status: 403, message: "You may not cancel another person's run" } };
  }

  const stored = database.runs[index] as StoredRun;
  const cancelled: StoredRun = {
    ...stored,
    itemsPerMinute: null,
    ending: { state: "Cancelled", finishedAt: now, doneCount: run.doneCount },
    cancelledBy: session.user.id,
    note: `Stopped after ${run.doneCount} of ${run.itemCount}; what it had already done stays.`,
  };
  database.runs.splice(index, 1, cancelled);
  return { value: publicRunOf(cancelled, now) };
}

// The server makes a new run over the set as it stands now (PLG-run-items).
export function runAgain(session: Session, runId: string): Outcome<Run> {
  const now = mockNow();
  const run = findVisibleRun(session, runId, now);
  const stored = database.runs.find((candidate) => candidate.id === runId);
  if (run === null || stored === undefined) {
    return { refusal: { status: 404, message: "No such run" } };
  }

  if (!run.isRerunnable || (run.state !== "Failed" && run.state !== "Cancelled")) {
    return {
      refusal: {
        status: 409,
        message: "Only a failed or cancelled plugin run is run again",
        code: "task.not_rerunnable",
      },
    };
  }

  if (!canRunAgain(session, run)) {
    return { refusal: { status: 403, message: "You may not run this plugin" } };
  }

  const started = startRun({
    what: stored.what,
    instanceId: stored.instanceId,
    trigger: { kind: "manual", from: { label: "Tasks", path: `/tasks?run=${run.id}` } },
    startedBy: session.user.id,
    itemCount: itemCountForInstance(stored.instanceId),
    rerunOf: run.id,
  });
  return { value: publicRunOf(started, now) };
}

interface RunStart {
  readonly what: string;
  readonly instanceId: string | null;
  readonly coreName?: string | null;
  readonly trigger: RunTrigger;
  readonly startedBy: string;
  readonly itemCount: number;
  readonly rerunOf: string | null;
}

// The server stores a run before its job works the set (PLG-run-items).
export function startRun(start: RunStart): StoredRun {
  const highest = Math.max(
    ...database.runs.map((run) => Number.parseInt(run.id.replace(/\D/g, ""), 10) || 0),
  );
  const run: StoredRun = {
    ...start,
    id: `T-${highest + 1}`,
    coreName: start.coreName ?? null,
    startedAt: mockNow(),
    itemCount: start.itemCount,
    doneCount: 0,
    itemsPerMinute: null,
    ending: null,
    errors: [],
    changes: [] satisfies Place[],
    failure: null,
    note: null,
    cancelledBy: null,
  };
  database.runs.unshift(run);
  return run;
}

// Documents still in play: an open request, or an iteration not yet published (PLG-run-items).
function documentsStillInPlay(): Set<string> {
  return new Set([
    ...database.requests
      .filter((request) => request.decision === "Pending")
      .map((request) => request.documentId),
    ...database.iterations
      .filter((iteration) => !isAttemptOver(iteration))
      .map((iteration) => iteration.documentId),
  ]);
}

// Documents still in play lacking one of the properties the instance's version supplies.
function lackingPropertiesCount(instance: StoredPluginInstance): number {
  const keys =
    implementationOf(instance)
      ?.versions.find((version) => version.version === instance.version)
      ?.declares.properties.map(({ key }) => key) ?? [];
  const inPlay = documentsStillInPlay();
  return database.documents.filter(
    (document) =>
      inPlay.has(document.id) &&
      keys.some(
        (key) =>
          !document.properties.some(
            (property) => property.key === key && property.sources.length > 0,
          ),
      ),
  ).length;
}

// The size of the set a run of the instance covers, fixed when it starts (PLG-run-items). A
// catalog adapter's or a harvester's set is what its first call answers, so 0 until then.
export function itemCountForInstance(instanceId: string | null): number {
  const instance = database.pluginInstances.find((candidate) => candidate.id === instanceId);
  if (instance === undefined) {
    return 0;
  }

  switch (kindOf(instance)) {
    case "Registry":
    case "Validation":
    case "Restriction":
      return documentsStillInPlay().size;
    case "PropertySource":
      return lackingPropertiesCount(instance);
    case "PublicationDetector":
      return database.iterations.filter((iteration) => iteration.progress === "Digitized").length;
    default:
      return 0;
  }
}

// Deleting a custody or changing a Custody instance starts a run that places the open proposals
// again (L8); it places nothing at once, as the server's job does the work.
export function startPlacingRun(session: Session, from: Place): StoredRun {
  return startRun({
    what: "Placing open proposals again",
    instanceId: null,
    coreName: "VERA",
    trigger: { kind: "manual", from },
    startedBy: session.user.id,
    itemCount: openProposalPlacements(mockStore(), mockRequestPlugins).length,
    rerunOf: null,
  });
}

export function saveRetention(session: Session, retention: Retention): Outcome<Retention> {
  if (!hasPermission(session, "task.schedule")) {
    return { refusal: { status: 403, message: "You may not change how long runs are kept" } };
  }

  if (retention.failedDays < retention.days) {
    return {
      refusal: {
        status: 422,
        message: "Failed and cancelled runs are kept at least as long as the others",
        code: "retention.failed_shorter",
      },
    };
  }

  database.taskRetention = { ...retention };
  return { value: { ...database.taskRetention } };
}
