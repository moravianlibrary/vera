// A run as Tasks shows it (docs/demos/shared/page-tasks.js `runCard`, `historyTable`): its state
// badge, what started it, what it changed, a running run's card with its progress, and the
// finished table's columns per tier, with a failed run's red line under its row. Who started a
// run is named through the reference data; VERA itself starts schedules and repeats.

import type { Run } from "@vera/contract/tasks";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { NoticeLine as SharedNoticeLine } from "@/components/notice-line";
import { RunStateBadge } from "@/components/run-state-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { RunProgress } from "@/components/visualizations/run-progress";
import { repeatNameOf, timeLeftText, tookText } from "@/features/tasks/task-words";
import type { PerTier } from "@/hooks/use-tier";
import { i18n } from "@/i18n";
import { cadenceText } from "@/lib/format-cadence";
import { agoText } from "@/lib/format-moment";
import { formatCount } from "@/lib/format-number";

export type NameOf = (userId: string) => string;

export function starterOf(run: Run, nameOf: NameOf): string {
  return run.startedBy === null ? i18n.t("tasks:runParts.vera") : nameOf(run.startedBy);
}

export function sourceOf(run: Run): string {
  return run.source.kind === "plugin" ? run.source.instance.name : run.source.name;
}

// What started it, in a word, and under it the detail: the cadence, or where a person started it.
export function triggerOf(run: Run, nameOf: NameOf): { title: string; detail: string } {
  const { trigger } = run;
  switch (trigger.kind) {
    case "schedule":
      return { title: i18n.t("tasks:taskWords.schedule"), detail: cadenceText(trigger.cadence) };
    case "repeat":
      return { title: i18n.t("tasks:taskWords.repeat"), detail: repeatNameOf(trigger.name) };
    case "approval":
      return {
        title: i18n.t("tasks:taskWords.approval"),
        detail: i18n.t("tasks:runParts.approvedBy", { name: starterOf(run, nameOf) }),
      };
    case "manual":
      return {
        title: starterOf(run, nameOf),
        detail: i18n.t("tasks:runParts.from", { name: trigger.from.label }),
      };
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
    <SharedNoticeLine
      tone={notice.tone}
      title={notice.title}
      onDismiss={onDismiss}
      className="mb-4"
    >
      {notice.text}
      {runId !== undefined && (
        <>
          {" "}
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => onOpenRun(runId)}
          >
            {i18n.t("tasks:runParts.openRun")}
          </button>
        </>
      )}
    </SharedNoticeLine>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>;
}

export function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="mt-3 mb-2.5 text-caption font-semibold tracking-wider text-muted-foreground uppercase">
      {title}
      {count !== undefined && <span className="font-normal normal-case"> · {count}</span>}
    </h2>
  );
}

// What the run changed, each linked to where it shows; or why there is nothing.
export function RunResult({ run }: { run: Run }) {
  switch (run.state) {
    case "Failed":
      return (
        <span className="text-muted-foreground">{i18n.t("tasks:runParts.nothingChanged")}</span>
      );
    case "Skipped":
      return <span className="text-muted-foreground">{i18n.t("tasks:runParts.didNotRun")}</span>;
    case "Cancelled":
      return (
        <span className="text-muted-foreground">
          {i18n.t("tasks:runParts.processed", {
            done: formatCount(run.doneCount),
            total: formatCount(run.itemCount),
          })}
        </span>
      );
    case "Running":
      return (
        <span className="text-muted-foreground">{i18n.t("tasks:runParts.shownWhenFinished")}</span>
      );
    default:
      if (run.changes === null || run.changes.length === 0) {
        return (
          <span className="text-muted-foreground">{i18n.t("tasks:runParts.nothingChanged")}</span>
        );
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
            {i18n.t("tasks:runParts.startedAgo", {
              title: trigger.title,
              detail: trigger.detail,
              ago: agoText(run.startedAt, asOf),
            })}
          </Sub>
        </div>
        {onCancel !== undefined && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            {i18n.t("tasks:runParts.cancel")}
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
      <StatusNote tone="red" title={i18n.t("tasks:runParts.failed")} className="flex-1">
        {run.failure}
      </StatusNote>
      {onRunAgain !== undefined && (
        <Button variant="outline" size="sm" onClick={onRunAgain}>
          {i18n.t("tasks:runParts.runAgain")}
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
    header: i18n.t("tasks:runParts.what"),
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
    header: i18n.t("tasks:runParts.plugin"),
    track: "minmax(8rem,1fr)",
    cell: sourceOf,
  };
  const trigger: ColumnDefinition<Run> = {
    key: "trigger",
    header: i18n.t("tasks:runParts.trigger"),
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
    header: i18n.t("tasks:runParts.started"),
    track: "max-content",
    cell: (run) => <span className="whitespace-nowrap">{agoText(run.startedAt, asOf)}</span>,
  };
  const took: ColumnDefinition<Run> = {
    key: "took",
    header: i18n.t("tasks:runParts.took"),
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
    header: i18n.t("tasks:runParts.state"),
    track: "max-content",
    cell: (run) => <RunStateBadge run={run} />,
  };
  const result = (isStateShown: boolean): ColumnDefinition<Run> => ({
    key: "result",
    header: i18n.t("tasks:runParts.result"),
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
