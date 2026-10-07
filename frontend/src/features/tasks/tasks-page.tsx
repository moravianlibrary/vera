// Tasks (page-composition.md §5 *Tasks*; docs/demos/shared/page-tasks.js `runsView`): the tiles,
// the running runs as cards on top, since a run that finishes moves down into Finished instead of
// vanishing from where it was watched, then the finished runs as a table, filtered, and how long
// runs are kept. A run opens in the drawer (`?run=`). `task.read` sees everyone's runs and the
// next scheduled one; with `task.read_own` alone the page is *My Tasks*, the person's own runs.
// TODO(rrandiak): labels move to i18n.

import { useState } from "react";
import { Link } from "react-router";
import type { Run, RunIndex } from "@/api/tasks";
import { runAgain } from "@/api/tasks";
import type { Stat } from "@/components/detail-card";
import { StatTiles } from "@/components/detail-card";
import { FilterBar } from "@/components/filters/filter-bar";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { TableWithDrawer } from "@/components/table-with-drawer";
import type { Session } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import { canCancelRun, canRunAgain, isOwnRun } from "@/domain/tasks";
import type { TaskNotice } from "@/features/tasks/run-dialogs";
import { CancelRunDialog, RetentionDialog } from "@/features/tasks/run-dialogs";
import { RunDrawer } from "@/features/tasks/run-drawer";
import type { NameOf, ShownNotice } from "@/features/tasks/run-parts";
import {
  FailureNote,
  NoticeLine,
  RunCard,
  RunningCard,
  runColumns,
  SectionTitle,
  sourceOf,
  starterOf,
} from "@/features/tasks/run-parts";
import { aheadText, shortDayOf } from "@/features/tasks/task-words";
import { runFieldsFor, runParam, tasksView } from "@/features/tasks/tasks-view";
import { taskInvalidations, useRunQuery, useRunsQuery } from "@/features/tasks/use-tasks-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useTier } from "@/hooks/use-tier";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { plural } from "@/lib/plural";

export function TasksPage() {
  const view = useViewUrlState(tasksView, runParam);
  const { query, selectedId: openRunId, select } = view;
  const { data: session } = useSessionQuery();
  const { data: index } = useRunsQuery(query);
  const { data: detail, isError: isDetailMissing } = useRunQuery(openRunId);
  const { users: nameOf } = useReferenceLabels(["users"]);
  const [notice, setNotice] = useState<ShownNotice | null>(null);
  const [cancelling, setCancelling] = useState<Run | null>(null);
  const [isRetentionOpen, setIsRetentionOpen] = useState(false);
  const rerun = useActionMutation({
    call: runAgain,
    invalidates: taskInvalidations,
    refusalTexts: {
      "task.not_rerunnable": "Only a failed or cancelled plugin run is run again.",
      403: "You may not run this plugin.",
    },
  });

  if (session === undefined) {
    return null;
  }

  const title =
    visibleNavigation(session).find((entry) => entry.id === "tasks")?.visibleLabel ?? "Tasks";
  const seesEveryone = hasPermission(session, "task.read");
  const show = (next: TaskNotice, tone: ShownNotice["tone"] = "green") =>
    setNotice({ ...next, tone });

  const runAgainNow = async (run: Run) => {
    const result = await rerun.run(run.id);
    if (!result.isDone) {
      show({ title: `${run.id} did not start`, text: result.refusal.message }, "red");
      return;
    }

    show({
      title: `Started ${result.value.id}`,
      text: `Running ${run.what} again; ${run.id} stays as it was.`,
      runId: result.value.id,
    });
    select(result.value.id);
  };

  const actsOf = (run: Run) => ({
    onCancel: canCancelRun(session, run) ? () => setCancelling(run) : undefined,
    onRunAgain: canRunAgain(session, run) ? () => void runAgainNow(run) : undefined,
  });

  const openRun = detail?.run.id === openRunId ? detail : undefined;

  return (
    <>
      <PageHeader title={title} />
      {index !== undefined && index.visibleCount > 0 && (
        <FilterBar
          fields={runFieldsFor(seesEveryone)}
          query={query}
          facets={index.facets}
          onQueryChange={(next) => view.setQuery(next)}
          searchLabel="Search runs"
          searchPlaceholder="Search runs — what ran, ID"
        />
      )}
      <PageContent className="@container">
        {index === undefined ? null : (
          <TableWithDrawer
            openId={openRunId}
            onClose={() => select(null)}
            drawerTitle={openRun?.run.what ?? "Run"}
            drawerSubtitle={
              openRun === undefined ? undefined : (
                <>
                  <span className="font-mono">{openRun.run.id}</span> · {sourceOf(openRun.run)}
                </>
              )
            }
            drawer={
              openRun !== undefined ? (
                <RunDrawer
                  detail={openRun}
                  nameOf={nameOf}
                  canSeeSchedules={seesEveryone}
                  canSeePlugins={hasPermission(session, "plugin.read")}
                  {...actsOf(openRun.run)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isDetailMissing ? "This run is gone, or is not yours to see." : "Loading…"}
                </p>
              )
            }
            above={
              <RunsAbove
                index={index}
                session={session}
                nameOf={nameOf}
                notice={notice}
                onDismissNotice={() => setNotice(null)}
                openRunId={openRunId}
                onOpen={select}
                onCancel={(run) => setCancelling(run)}
                isFiltered={!tasksView.isSameQuery(query, {})}
              />
            }
            table={{
              rows: index.visibleCount === 0 ? [] : index.finished,
              rowId: (run) => run.id,
              columns: runColumns({ asOf: index.asOf, nameOf, onOpen: select }),
              onOpen: select,
              emptyText: index.visibleCount === 0 ? "" : "No finished run matches these filters.",
              noteOf: (run) =>
                run.failure === null ? null : (
                  <FailureNote run={run} onRunAgain={actsOf(run).onRunAgain} />
                ),
              cardOf: (run) => (
                <RunCard run={run} asOf={index.asOf} nameOf={nameOf} onOpen={select} />
              ),
            }}
            below={
              index.visibleCount > 0 && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Runs are kept for{" "}
                  <b className="font-semibold">{daysText(index.retention.days)}</b>, failed and
                  cancelled ones for{" "}
                  <b className="font-semibold">{daysText(index.retention.failedDays)}</b>. Nobody
                  deletes them by hand: this is the record of what changed the data.{" "}
                  {hasPermission(session, "task.schedule") && (
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => setIsRetentionOpen(true)}
                    >
                      Change…
                    </button>
                  )}
                </p>
              )
            }
          />
        )}
      </PageContent>

      {cancelling !== null && (
        <CancelRunDialog
          isOpen
          onClose={() => setCancelling(null)}
          run={cancelling}
          otherStarter={
            cancelling.startedBy === null || isOwnRun(session, cancelling)
              ? null
              : starterOf(cancelling, nameOf)
          }
          onCancelled={(next) => show(next)}
        />
      )}
      {isRetentionOpen && index !== undefined && (
        <RetentionDialog
          isOpen
          onClose={() => setIsRetentionOpen(false)}
          retention={index.retention}
          onSaved={(next) => show(next)}
        />
      )}
    </>
  );
}

function daysText(days: number): string {
  return days === 365 ? "a year" : plural(days, "day");
}

interface RunsAboveProps {
  index: RunIndex;
  session: Session;
  nameOf: NameOf;
  notice: ShownNotice | null;
  onDismissNotice: () => void;
  openRunId: string | null;
  onOpen: (runId: string) => void;
  onCancel: (run: Run) => void;
  isFiltered: boolean;
}

// What sits above the finished table: a notice, the tiles, and the running runs.
function RunsAbove({
  index,
  session,
  nameOf,
  notice,
  onDismissNotice,
  openRunId,
  onOpen,
  onCancel,
  isFiltered,
}: RunsAboveProps) {
  return (
    <>
      {notice !== null && (
        <NoticeLine notice={notice} onOpenRun={onOpen} onDismiss={onDismissNotice} />
      )}
      <RunTiles index={index} />
      {index.visibleCount === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing you started has run yet. Re-checks, generated lists and ingests you start show up
          here while they run, and after.
        </p>
      ) : (
        <>
          {index.running.length > 0 && (
            <>
              <SectionTitle title="Running" count={index.running.length} />
              <div className="grid gap-2.5 @4xl:grid-cols-2">
                {index.running.map((run) => (
                  <RunningCard
                    key={run.id}
                    run={run}
                    asOf={index.asOf}
                    nameOf={nameOf}
                    isOpen={run.id === openRunId}
                    onOpen={onOpen}
                    onCancel={canCancelRun(session, run) ? () => onCancel(run) : undefined}
                  />
                ))}
              </div>
            </>
          )}
          <SectionTitle
            title={isFiltered ? "Matching runs" : "Finished"}
            count={index.finished.length}
          />
        </>
      )}
    </>
  );
}

// Running, failed in the last 7 days, and the next scheduled run, or with only the person's own
// runs, what of theirs finished. On a phone, one line.
function RunTiles({ index }: { index: RunIndex }) {
  const tier = useTier();
  const { tiles, asOf } = index;
  const runningNames = index.running.map((run) => run.what.split(" — ")[0]).join(", ");
  const failedFoot = [
    tiles.withErrorsCount > 0 ? `${tiles.withErrorsCount} finished with errors` : null,
    tiles.lastFailureAt === null
      ? "none on record"
      : `last failure ${shortDayOf(tiles.lastFailureAt)}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  const stats: Stat[] = [
    {
      label: "Running",
      value: tiles.runningCount,
      foot:
        tiles.runningCount === 0
          ? "nothing right now"
          : runningNames || "left out by the State filter",
    },
    { label: "Failed · last 7 days", value: tiles.failedCount, foot: failedFoot },
    index.schedules === null
      ? { label: "Finished · last 7 days", value: tiles.finishedCount, foot: "started by you" }
      : {
          label: "Next run",
          value: tiles.nextRun === null ? "—" : aheadText(tiles.nextRun.at, asOf),
          isText: true,
          foot: (
            <>
              {tiles.nextRun?.name}
              {tiles.nextRun !== null && " · "}
              <Link to="/schedules" className="text-primary underline-offset-2 hover:underline">
                {plural(index.schedules.activeCount, "schedule")} active
              </Link>
            </>
          ),
        },
  ];

  if (tier === "phone") {
    return (
      <p className="rounded-lg border bg-card px-3.5 py-2.5 text-xs">
        <b className="font-semibold">{tiles.runningCount}</b> running ·{" "}
        <b className="font-semibold">{tiles.failedCount}</b> failed in the last 7 days
        {tiles.nextRun !== null && <> · next {aheadText(tiles.nextRun.at, asOf)}</>}
      </p>
    );
  }

  return <StatTiles stats={stats} />;
}
