// Tasks: watchlists and filters above an upcoming-run strip, running cards, then a Finished
// section whose heading and table header stick in the single page scroller. A run opens in the drawer (`?run=`).
// `task.read` sees everyone's runs and next scheduled work; with `task.read_own` alone the page
// is *My Tasks*, the person's own runs.

import type { Run, RunIndex } from "@vera/contract/tasks";
import type { Session } from "@vera/domain/entities";
import { hasPermission } from "@vera/domain/permissions";
import { canCancelRun, canRunAgain, isOwnRun } from "@vera/domain/tasks";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { runAgain } from "@/api/tasks";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { canOpenNavigationEntry, visibleNavigation } from "@/components/layout/navigation";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { failureOf } from "@/components/query-state";
import { TableWithDrawer } from "@/components/table-with-drawer";
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
import { i18n } from "@/i18n";
import { aheadText } from "@/lib/format-moment";

export function TasksPage() {
  const { t } = useTranslation("tasks");
  const view = useViewUrlState(tasksView, runParam);
  const { query, selectedId: openRunId, select } = view;
  const { data: session } = useSessionQuery();
  const runsQuery = useRunsQuery(query);
  const { data: index } = runsQuery;
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
      "task.not_rerunnable": t("tasksPage.refusalNotRerunnable"),
      403: t("tasksPage.refusalRunForbidden"),
    },
  });

  if (session === undefined) {
    return null;
  }

  const title =
    visibleNavigation(session).find((entry) => entry.id === "tasks")?.visibleLabel ??
    "tasksPage.title";
  const seesEveryone = hasPermission(session, "task.read");
  const show = (next: TaskNotice, tone: ShownNotice["tone"] = "green") =>
    setNotice({ ...next, tone });

  const runAgainNow = async (run: Run) => {
    const result = await rerun.run(run.id);
    if (!result.isDone) {
      show(
        { title: t("tasksPage.runAgainFailed", { id: run.id }), text: result.refusal.message },
        "red",
      );
      return;
    }

    show({
      title: t("tasksPage.runAgainStarted", { id: result.value.id }),
      text: t("tasksPage.runAgainText", { what: run.what, id: run.id }),
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
      <PageHeader title={t(title)} />
      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="tasks"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={hasPermission(session, "watchlist.manage_system")}
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
          searchLabel={t("tasksPage.searchLabel")}
          searchPlaceholder={t("tasksPage.searchPlaceholder")}
        />
      )}
      {index !== undefined &&
        index.schedules !== null &&
        canOpenNavigationEntry(session, "schedules") && <NextRunsStrip index={index} />}
      <PageContent
        isFlushVertical
        className="@container"
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
        {index === undefined ? (
          <TableWithDrawer
            openId={null}
            onClose={() => {}}
            drawerTitle=""
            drawer={null}
            table={{
              rows: [],
              rowId: (run: Run) => run.id,
              columns: runColumns({ asOf: new Date().toISOString(), nameOf, onOpen: select }),
              emptyText: t("tasksPage.emptyFinished"),
              isLoading: runsQuery.isLoading,
              loadingText: t("tasksPage.loading"),
              failure: failureOf(runsQuery, t("tasksPage.loadFailure")),
            }}
          />
        ) : (
          <TableWithDrawer
            openId={openRunId}
            onClose={() => select(null)}
            drawerTitle={openRun?.run.what ?? t("tasksPage.run")}
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
                  {isDetailMissing ? t("tasksPage.runUnavailable") : t("tasksPage.loading")}
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
              emptyText: t("tasksPage.emptyFinished"),
              isLoading: false,
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
                <div className="sticky top-0 z-20 grid h-10 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-y bg-background">
                  <h2 className="min-w-0 truncate text-caption font-semibold tracking-wider text-muted-foreground uppercase">
                    {t("tasksPage.finished")}{" "}
                    <span className="font-normal normal-case">· {index.finished.length}</span>
                  </h2>
                  {index.running.length > 0 && isRunningOffscreen && (
                    <button
                      type="button"
                      className="col-start-2 text-xs font-medium text-primary hover:underline"
                      onClick={() =>
                        runningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      {t("tasksPage.scrollRunning")}
                    </button>
                  )}
                </div>
              ),
              className: index.running.length > 0 ? "pt-4" : "",
            }}
            swipe={{
              items: index.finished.slice(0, visibleFinishedCount),
              idOf: (run) => run.id,
              labelOf: (run) => run.what,
              currentId: openRunId,
              onSelect: select,
              onNearEnd: () =>
                setVisibleFinished({
                  key: filterKey,
                  count: Math.min(visibleFinishedCount + 40, index.finished.length),
                }),
            }}
            below={
              <p className="sticky bottom-0 z-20 border-t bg-background py-2.5 text-xs leading-relaxed text-muted-foreground">
                {t("tasksPage.retention", {
                  days: daysText(index.retention.days),
                  failedDays: daysText(index.retention.failedDays),
                })}{" "}
                {hasPermission(session, "task.schedule") && (
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => setIsRetentionOpen(true)}
                  >
                    {t("tasksPage.changeRetention")}
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
  return days === 365
    ? i18n.t("tasks:tasksPage.year")
    : i18n.t("tasks:tasksPage.days", { count: days });
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
  const { t } = useTranslation("tasks");
  return (
    <>
      {notice !== null && (
        <NoticeLine notice={notice} onOpenRun={onOpen} onDismiss={onDismissNotice} />
      )}
      {index.visibleCount === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("tasksPage.noRunsYet")}</p>
      ) : index.running.length > 0 ? (
        <div ref={runningRef} className="scroll-mt-4">
          <SectionTitle title={t("tasksPage.running")} count={index.running.length} />
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
  const { t } = useTranslation("tasks");
  const availableRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(1);
  useLayoutEffect(() => {
    const available = availableRef.current;
    if (available === null) return;
    const measure = () => {
      let usedWidth = 0;
      let count = 0;
      for (const chip of available.querySelectorAll<HTMLElement>("[data-next-run]")) {
        const nextWidth = chip.getBoundingClientRect().width + (count > 0 ? 8 : 0);
        if (count > 0 && usedWidth + nextWidth > available.clientWidth) break;
        usedWidth += nextWidth;
        count += 1;
      }
      setVisibleCount(Math.max(1, count));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(available);
    measure();
    return () => observer.disconnect();
  });
  if (index.schedules === null) return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2 text-xs sm:px-6">
      <span className="shrink-0 font-semibold tracking-wider text-muted-foreground uppercase">
        {t("tasksPage.nextRuns")}
      </span>
      <div
        ref={availableRef}
        className="flex min-w-0 flex-1 gap-2 overflow-hidden whitespace-nowrap"
      >
        {index.nextRuns.length === 0 ? (
          <span className="text-muted-foreground">{i18n.t("tasks:tasksPage.noneScheduled")}</span>
        ) : (
          index.nextRuns.map((run, position) => (
            <Link
              key={`${run.path}:${run.at}`}
              data-next-run
              to={run.path}
              title={`${run.name} · ${aheadText(run.at, index.asOf)}`}
              aria-hidden={position >= visibleCount}
              tabIndex={position >= visibleCount ? -1 : undefined}
              className={`flex w-fit max-w-[min(20rem,100%)] shrink-0 items-center gap-1 rounded-md border bg-card px-2 py-1 hover:bg-muted ${position >= visibleCount ? "invisible" : ""}`}
            >
              <span className="min-w-0 truncate">{run.name}</span>
              <span className="shrink-0 text-muted-foreground">
                · {aheadText(run.at, index.asOf)}
              </span>
            </Link>
          ))
        )}
      </div>
      <Link to="/schedules" className="shrink-0 text-primary hover:underline">
        {t("tasksPage.activeSchedules", { count: index.schedules.activeCount })}
      </Link>
    </div>
  );
}
