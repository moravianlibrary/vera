// A run as Tasks shows it (docs/demos/shared/page-tasks.js `runCard`, `historyTable`): its state
// badge, what started it, what it changed, a running run's card with its progress, and the
// finished table's columns per tier, with a failed run's red line under its row. Who started a
// run is named through the reference data; VERA itself starts schedules and repeats.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Run } from "@/api/tasks";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { RunProgress } from "@/components/visualizations/run-progress";
import {
  cadenceText,
  repeatNameOf,
  runStateLabels,
  runStateTones,
  timeLeftText,
  tookText,
} from "@/features/tasks/task-words";
import type { PerTier } from "@/hooks/use-tier";
import { agoText } from "@/lib/format-moment";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

export type NameOf = (userId: string) => string;

export function starterOf(run: Run, nameOf: NameOf): string {
  return run.startedBy === null ? "VERA" : nameOf(run.startedBy);
}

export function sourceOf(run: Run): string {
  return run.source.kind === "plugin" ? run.source.instance.name : run.source.name;
}

export function RunStateBadge({ run }: { run: Pick<Run, "state" | "errorCount"> }) {
  const label =
    run.state === "DoneWithErrors"
      ? `Done · ${plural(run.errorCount, "error")}`
      : runStateLabels[run.state];
  return <ToneBadge tone={runStateTones[run.state]}>{label}</ToneBadge>;
}

// What started it, in a word, and under it the detail: the cadence, or where a person started it.
export function triggerOf(run: Run, nameOf: NameOf): { title: string; detail: string } {
  const { trigger } = run;
  switch (trigger.kind) {
    case "schedule":
      return { title: "Schedule", detail: cadenceText(trigger.cadence) };
    case "repeat":
      return { title: "Intention repeat", detail: repeatNameOf(trigger.name) };
    case "approval":
      return { title: "On approval", detail: `${starterOf(run, nameOf)} approved it` };
    case "manual":
      return { title: starterOf(run, nameOf), detail: `from ${trigger.from.label}` };
  }
}

// Done, or refused, and what to say about it at the top of the page.
export interface ShownNotice {
  title: string;
  text: string;
  tone: "green" | "red";
  // The run it started, to open.
  runId?: string;
}

export function NoticeLine({
  notice,
  onOpenRun,
  onDismiss,
}: {
  notice: ShownNotice;
  onOpenRun: (runId: string) => void;
  onDismiss: () => void;
}) {
  const { runId } = notice;
  return (
    <div className="mb-4 flex items-start gap-2">
      <StatusNote tone={notice.tone} title={notice.title} className="flex-1">
        {notice.text}
        {runId !== undefined && (
          <>
            {" "}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => onOpenRun(runId)}
            >
              Open the run
            </button>
          </>
        )}
      </StatusNote>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>;
}

export function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="mt-6 mb-2.5 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
      {title}
      {count !== undefined && <span className="font-normal normal-case"> · {count}</span>}
    </h2>
  );
}

// What the run changed, each linked to where it shows; or why there is nothing.
export function RunResult({ run }: { run: Run }) {
  switch (run.state) {
    case "Failed":
      return <span className="text-muted-foreground">nothing changed</span>;
    case "Skipped":
      return <span className="text-muted-foreground">did not run</span>;
    case "Cancelled":
      return (
        <span className="text-muted-foreground">
          {formatCount(run.doneCount)} of {formatCount(run.itemCount)} processed
        </span>
      );
    case "Running":
      return <span className="text-muted-foreground">shown when it finishes</span>;
    default:
      if (run.changes === null || run.changes.length === 0) {
        return <span className="text-muted-foreground">nothing changed</span>;
      }

      return (
        <span>
          {run.changes.map((change, index) => (
            <span key={change.label}>
              {index > 0 && " · "}
              <Link to={change.path} className="text-primary underline-offset-2 hover:underline">
                {change.label}
              </Link>
            </span>
          ))}
        </span>
      );
  }
}

// The run's name, as the button that opens it.
export function RunTitle({ run, onOpen }: { run: Run; onOpen: (runId: string) => void }) {
  return (
    <button
      type="button"
      className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
      onClick={() => onOpen(run.id)}
    >
      {run.what}
    </button>
  );
}

interface RunningCardProps {
  run: Run;
  asOf: string;
  nameOf: NameOf;
  isOpen: boolean;
  onOpen: (runId: string) => void;
  // Absent when the person may not cancel it.
  onCancel?: () => void;
}

export function RunningCard({ run, asOf, nameOf, isOpen, onOpen, onCancel }: RunningCardProps) {
  const trigger = triggerOf(run, nameOf);
  return (
    <div
      className={
        isOpen
          ? "rounded-lg border border-ring bg-tone-blue/40 px-4 py-3"
          : "rounded-lg border bg-card px-4 py-3"
      }
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <RunTitle run={run} onOpen={onOpen} />
          <Sub>
            {trigger.title} · {trigger.detail} · started {agoText(run.startedAt, asOf)}
          </Sub>
        </div>
        {onCancel !== undefined && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel…
          </Button>
        )}
      </div>
      <div className="mt-2.5">
        <RunProgress
          done={run.doneCount}
          total={run.itemCount}
          errors={run.errorCount}
          timeLeft={run.secondsLeft === null ? undefined : timeLeftText(run.secondsLeft)}
          form="card"
        />
      </div>
    </div>
  );
}

// A failed run's red line under its row, with Run again for whoever may.
export function FailureNote({ run, onRunAgain }: { run: Run; onRunAgain?: () => void }) {
  if (run.failure === null) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <StatusNote tone="red" title="Failed" className="flex-1">
        {run.failure}
      </StatusNote>
      {onRunAgain !== undefined && (
        <Button variant="outline" size="sm" onClick={onRunAgain}>
          Run again
        </Button>
      )}
    </div>
  );
}

interface RunColumnsOptions {
  asOf: string;
  nameOf: NameOf;
  onOpen: (runId: string) => void;
}

// The demo's columns per tier (component-interfaces.md §2.4): the large table gives the plugin
// and the state their own columns; narrower ones fold them into the first and last cells.
export function runColumns({
  asOf,
  nameOf,
  onOpen,
}: RunColumnsOptions): PerTier<readonly ColumnDefinition<Run>[]> {
  const what = (detail: (run: Run) => string): ColumnDefinition<Run> => ({
    key: "what",
    header: "What",
    track: "minmax(14rem,2fr)",
    cell: (run) => (
      <>
        <RunTitle run={run} onOpen={onOpen} />
        <Sub>
          <span className="font-mono">{run.id}</span>
          {detail(run)}
        </Sub>
      </>
    ),
  });
  const plugin: ColumnDefinition<Run> = {
    key: "plugin",
    header: "Plugin",
    track: "minmax(8rem,1fr)",
    cell: sourceOf,
  };
  const trigger: ColumnDefinition<Run> = {
    key: "trigger",
    header: "Trigger",
    track: "minmax(9rem,1fr)",
    cell: (run) => {
      const { title, detail } = triggerOf(run, nameOf);
      return (
        <>
          {title}
          <Sub>{detail}</Sub>
        </>
      );
    },
  };
  const started: ColumnDefinition<Run> = {
    key: "started",
    header: "Started",
    track: "max-content",
    cell: (run) => <span className="whitespace-nowrap">{agoText(run.startedAt, asOf)}</span>,
  };
  const took: ColumnDefinition<Run> = {
    key: "took",
    header: "Took",
    track: "max-content",
    isNumeric: true,
    cell: (run) => (
      <span className="whitespace-nowrap">
        {run.state === "Skipped" ? "—" : tookText(run, asOf)}
      </span>
    ),
  };
  const state: ColumnDefinition<Run> = {
    key: "state",
    header: "State",
    track: "max-content",
    cell: (run) => <RunStateBadge run={run} />,
  };
  const result = (isStateShown: boolean): ColumnDefinition<Run> => ({
    key: "result",
    header: "Result",
    track: "minmax(12rem,2fr)",
    cell: (run) => (
      <>
        {isStateShown && (
          <>
            <RunStateBadge run={run} />{" "}
          </>
        )}
        <RunResult run={run} />
      </>
    ),
  });

  return {
    large: [what(() => ""), plugin, trigger, started, took, state, result(false)],
    notebook: [what((run) => ` · ${sourceOf(run)}`), trigger, started, took, result(true)],
    small: [
      what(
        (run) =>
          ` · ${sourceOf(run)} · ${triggerOf(run, nameOf).title} · ${agoText(run.startedAt, asOf)}`,
      ),
      result(true),
    ],
    phone: [what(() => ""), result(true)],
  };
}

// A finished run on a phone.
export function RunCard({ run, asOf, nameOf, onOpen }: RunColumnsOptions & { run: Run }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <RunTitle run={run} onOpen={onOpen} />
        <RunStateBadge run={run} />
      </div>
      <Sub>
        {triggerOf(run, nameOf).title} · {agoText(run.startedAt, asOf)}
      </Sub>
      <div className="mt-1.5 text-xs">
        {run.failure === null ? (
          <RunResult run={run} />
        ) : (
          <span className="text-tone-red-foreground">{run.failure}</span>
        )}
      </div>
    </>
  );
}
