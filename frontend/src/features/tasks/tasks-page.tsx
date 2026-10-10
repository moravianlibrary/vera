// Tasks: watchlists and filters above an upcoming-run strip, running cards, then a Finished
// section whose heading and table header stick in the single page scroller. A run opens in the drawer (`?run=`).
// `task.read` sees everyone's runs and next scheduled work; with `task.read_own` alone the page
// is *My Tasks*, the person's own runs.
// TODO(rrandiak): labels move to i18n.

import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Run, RunIndex } from "@/api/tasks";
import { runAgain } from "@/api/tasks";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { canOpenNavigationEntry, visibleNavigation } from "@/components/layout/navigation";
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
import { runFieldsFor, runParam, tasksView } from "@/features/tasks/tasks-view";
import { taskInvalidations, useRunQuery, useRunsQuery } from "@/features/tasks/use-tasks-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { aheadText } from "@/lib/format-moment";
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
  const runningRef = useRef<HTMLDivElement>(null);
  const [isRunningOffscreen, setIsRunningOffscreen] = useState(false);
  const [visibleFinished, setVisibleFinished] = useState({ key: "", count: 40 });
  const filterKey = JSON.stringify(view.filter);
  const visibleFinishedCount = visibleFinished.key === filterKey ? visibleFinished.count : 40;
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
      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="tasks"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={hasPermission(session, "watchlist.manage_shared")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}
      {index !== undefined && (
        <FilterBar
          key={view.filterReplacements}
          fields={runFieldsFor(seesEveryone)}
          query={query}
          facets={index.facets}
          onQueryChange={(next) => view.setQuery(next)}
          searchLabel="Search runs"
          searchPlaceholder="Search runs — what ran, ID"
        />
      )}
      {index !== undefined &&
        index.schedules !== null &&
        canOpenNavigationEntry(session, "schedules") && <NextRunsStrip index={index} />}
      <PageContent
        className="@container !pt-0 !pb-0"
        onScroll={(event) => {
          const scroller = event.currentTarget;
          const running = runningRef.current;
          setIsRunningOffscreen(
            running !== null &&
              running.getBoundingClientRect().bottom <= scroller.getBoundingClientRect().top,
          );
          if (
            scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 200 &&
            visibleFinishedCount < (index?.finished.length ?? 0)
          ) {
            setVisibleFinished({
              key: filterKey,
              count: Math.min(visibleFinishedCount + 40, index?.finished.length ?? 0),
            });
          }
        }}
      >
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
                runningRef={runningRef}
              />
            }
            table={{
              flush: true,
              rows: index.finished.slice(0, visibleFinishedCount),
              rowId: (run) => run.id,
              columns: runColumns({ asOf: index.asOf, nameOf, onOpen: select }),
              onOpen: select,
              emptyText: "No finished run matches these filters.",
              noteOf: (run) =>
                run.failure === null ? null : (
                  <FailureNote run={run} onRunAgain={actsOf(run).onRunAgain} />
                ),
              cardOf: (run) => (
                <RunCard run={run} asOf={index.asOf} nameOf={nameOf} onOpen={select} />
              ),
              stickyHeaderClassName: "top-10",
            }}
            tableSection={{
              header: (
                <div className="sticky top-0 z-20 flex h-10 items-center justify-between border-y bg-background">
                  <h2 className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
                    Finished{" "}
                    <span className="font-normal normal-case">· {index.finished.length}</span>
                  </h2>
                  {index.running.length > 0 && isRunningOffscreen && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() =>
                        runningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      Show running ↑
                    </button>
                  )}
                </div>
              ),
              className: index.running.length > 0 ? "pt-4" : "",
            }}
            below={
              <p className="sticky bottom-0 z-20 border-t bg-background py-2.5 text-xs leading-relaxed text-muted-foreground">
                Runs are kept for <b className="font-semibold">{daysText(index.retention.days)}</b>,
                failed and cancelled ones for{" "}
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
  runningRef: React.Ref<HTMLDivElement>;
}

// What sits above the finished table: a notice and the running runs.
function RunsAbove({
  index,
  session,
  nameOf,
  notice,
  onDismissNotice,
  openRunId,
  onOpen,
  onCancel,
  runningRef,
}: RunsAboveProps) {
  return (
    <>
      {notice !== null && (
        <NoticeLine notice={notice} onOpenRun={onOpen} onDismiss={onDismissNotice} />
      )}
      {index.visibleCount === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing you started has run yet. Re-checks, generated lists and ingests you start show up
          here while they run, and after.
        </p>
      ) : index.running.length > 0 ? (
        <div ref={runningRef} className="scroll-mt-4">
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
        </div>
      ) : null}
    </>
  );
}

function NextRunsStrip({ index }: { index: RunIndex }) {
  const availableRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(1);
  useLayoutEffect(() => {
    const available = availableRef.current;
    if (available === null) return;
    const measure = () =>
      setVisibleCount(Math.max(1, Math.floor((available.clientWidth + 8) / 232)));
    const observer = new ResizeObserver(measure);
    observer.observe(available);
    measure();
    return () => observer.disconnect();
  }, []);
  if (index.schedules === null) return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2 text-xs sm:px-6">
      <span className="shrink-0 font-semibold tracking-wider text-muted-foreground uppercase">
        Next runs
      </span>
      <div
        ref={availableRef}
        className="flex min-w-0 flex-1 gap-2 overflow-hidden whitespace-nowrap"
      >
        {index.nextRuns.length === 0 ? (
          <span className="text-muted-foreground">None scheduled</span>
        ) : (
          index.nextRuns.slice(0, visibleCount).map((run) => (
            <Link
              key={`${run.path}:${run.at}`}
              to={run.path}
              title={`${run.name} · ${aheadText(run.at, index.asOf)}`}
              className="w-56 max-w-full shrink-0 truncate rounded-md border bg-card px-2 py-1 hover:bg-muted"
            >
              {run.name}{" "}
              <span className="text-muted-foreground">· {aheadText(run.at, index.asOf)}</span>
            </Link>
          ))
        )}
      </div>
      <Link to="/schedules" className="shrink-0 text-primary hover:underline">
        {plural(index.schedules.activeCount, "schedule")} active
      </Link>
    </div>
  );
}
