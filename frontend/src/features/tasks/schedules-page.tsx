// Schedules (page-composition.md §5 *Tasks*; docs/demos/shared/page-tasks.js `scheduleView`):
// what will run by itself and when. The timeline over the next day, week or month (`?range=`),
// then the schedules as a table, the plugin schedules and then the intention repeats, so
// everything that happens by itself is in one place. A schedule is edited here and only here
// (`task.schedule`: *New schedule*, *Edit*, *Pause…*, *Resume*); *Run now* is `plugin.run`'s. A
// repeat's definition stays on Intentions, which its row links to. `?s=` marks one schedule.

import type { ScheduleIndex, ScheduleRow, TimelineRange } from "@vera/contract/schedules";
import { timelineRanges } from "@vera/contract/schedules";
import { hasPermission } from "@vera/domain/permissions";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { resumeSchedule, runScheduleNow } from "@/api/schedules";
import { DataTable } from "@/components/data-table";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { failureOf, QueryState } from "@/components/query-state";
import { RunStateBadge } from "@/components/run-state-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import type { TimelineLane } from "@/components/visualizations/timeline";
import { Timeline } from "@/components/visualizations/timeline";
import type { TaskNotice } from "@/features/tasks/run-dialogs";
import { RunOverlayLink, useOpenRunOverlay } from "@/features/tasks/run-overlay-link";
import type { NameOf, ShownNotice } from "@/features/tasks/run-parts";
import { NoticeLine, Sub } from "@/features/tasks/run-parts";
import {
  DeleteScheduleDialog,
  PauseScheduleDialog,
  ScheduleEditorDialog,
} from "@/features/tasks/schedule-dialogs";
import {
  focusedScheduleParam,
  rangeLabels,
  rangeOf,
  rangeParam,
  rangeTitles,
} from "@/features/tasks/schedules-view";
import { overlapLabels, overlapNotes } from "@/features/tasks/task-words";
import { taskInvalidations, useSchedulesQuery } from "@/features/tasks/use-tasks-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useSessionQuery } from "@/hooks/use-session-query";
import type { PerTier } from "@/hooks/use-tier";
import { i18n } from "@/i18n";
import { cadenceText } from "@/lib/format-cadence";
import { agoText, aheadText, dayAndTimeOf, shortDayOf } from "@/lib/format-moment";
import { cn } from "@/lib/utils";

// Which dialog is open, on which schedule.
type OpenDialog =
  | { kind: "new" }
  | { kind: "edit"; schedule: ScheduleRow }
  | { kind: "pause"; schedule: ScheduleRow }
  | { kind: "delete"; schedule: ScheduleRow };

export function SchedulesPage() {
  const { t } = useTranslation("tasks");
  const [params, setParams] = useSearchParams();
  const openRun = useOpenRunOverlay();
  const range = rangeOf(params);
  const focusedId = params.get(focusedScheduleParam);
  const { data: session } = useSessionQuery();
  const schedulesQuery = useSchedulesQuery(range);
  const { data: index } = schedulesQuery;
  const { users: nameOf } = useReferenceLabels(["users"]);
  const [notice, setNotice] = useState<ShownNotice | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const resume = useActionMutation({
    call: resumeSchedule,
    invalidates: taskInvalidations,
    refusalTexts: { "schedule.not_paused": t("schedulesPage.refusalResumed") },
  });
  const runNow = useActionMutation({
    call: runScheduleNow,
    invalidates: taskInvalidations,
    refusalTexts: { 403: t("schedulesPage.refusalRunForbidden") },
  });

  if (session === undefined) {
    return null;
  }

  const setParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) {
      next.delete(name);
    } else {
      next.set(name, value);
    }

    setParams(next, { replace: true });
  };
  const show = (next: TaskNotice, tone: ShownNotice["tone"] = "green") =>
    setNotice({ ...next, tone });
  const canSchedule = hasPermission(session, "task.schedule");

  const acts: ScheduleActs = {
    onRunNow: hasPermission(session, "plugin.run")
      ? async (schedule) => {
          const result = await runNow.run(schedule.id);
          if (!result.isDone) {
            show(
              {
                title: t("schedulesPage.runFailed", { name: schedule.name }),
                text: result.refusal.message,
              },
              "red",
            );
            return;
          }

          setParam(focusedScheduleParam, schedule.id);
          show({
            title: t("schedulesPage.runStarted", { id: result.value.id }),
            text: t("schedulesPage.runText", { name: schedule.name }),
            runId: result.value.id,
          });
        }
      : undefined,
    onPause: canSchedule ? (schedule) => setDialog({ kind: "pause", schedule }) : undefined,
    onResume: canSchedule
      ? async (schedule) => {
          const result = await resume.run(schedule.id);
          if (!result.isDone) {
            show(
              {
                title: t("schedulesPage.resumeFailed", { name: schedule.name }),
                text: result.refusal.message,
              },
              "red",
            );
            return;
          }

          setParam(focusedScheduleParam, schedule.id);
          show({
            title: t("schedulesPage.resumed", { name: schedule.name }),
            text:
              result.value.nextAt === null || index === undefined
                ? t("schedulesPage.runsAgain")
                : t("schedulesPage.nextRun", { time: aheadText(result.value.nextAt, index.asOf) }),
          });
        }
      : undefined,
    onEdit: canSchedule ? (schedule) => setDialog({ kind: "edit", schedule }) : undefined,
  };

  return (
    <>
      <PageHeader
        title={t("schedulesPage.title")}
        actions={
          canSchedule
            ? [
                {
                  id: "new",
                  label: t("schedulesPage.newSchedule"),
                  isPrimary: true,
                  onSelect: () => setDialog({ kind: "new" }),
                },
              ]
            : []
        }
      />
      <PageContent isFlushVertical className="@container">
        {notice !== null && (
          <div className="pt-4">
            <NoticeLine notice={notice} onOpenRun={openRun} onDismiss={() => setNotice(null)} />
          </div>
        )}
        {index === undefined ? (
          <QueryState
            isLoading={schedulesQuery.isLoading}
            failure={failureOf(schedulesQuery, t("schedulesPage.loadFailure"))}
            loadingText={t("schedulesPage.loading")}
          >
            <span />
          </QueryState>
        ) : (
          <>
            <ScheduleTimeline
              index={index}
              range={range}
              onRangeChange={(next) => setParam(rangeParam, next === "day" ? null : next)}
            />
            <DataTable
              flush
              rows={index.schedules}
              rowId={(schedule) => schedule.id}
              columns={scheduleColumns({ asOf: index.asOf, acts, t })}
              focusedId={focusedId}
              isLoading={schedulesQuery.isLoading}
              loadingText={t("schedulesPage.loading")}
              failure={failureOf(schedulesQuery, t("schedulesPage.loadFailure"))}
              emptyText={t("schedulesPage.empty")}
              noteOf={(schedule) =>
                schedule.pause === null ? null : <PauseNote schedule={schedule} nameOf={nameOf} />
              }
              cardOf={(schedule) => (
                <ScheduleCard schedule={schedule} asOf={index.asOf} nameOf={nameOf} acts={acts} />
              )}
            />
            <p className="py-3 text-xs leading-relaxed text-muted-foreground">
              {t("schedulesPage.finePrint")}
            </p>
          </>
        )}
      </PageContent>

      {index !== undefined && (dialog?.kind === "new" || dialog?.kind === "edit") && (
        <ScheduleEditorDialog
          isOpen
          onClose={() => setDialog(null)}
          schedule={dialog.kind === "edit" ? dialog.schedule : null}
          asOf={index.asOf}
          onDelete={
            dialog.kind === "edit"
              ? () => setDialog({ kind: "delete", schedule: dialog.schedule })
              : undefined
          }
          onSaved={(row, next) => {
            setParam(focusedScheduleParam, row.id);
            show(next);
          }}
        />
      )}
      {dialog?.kind === "pause" && (
        <PauseScheduleDialog
          isOpen
          onClose={() => setDialog(null)}
          schedule={dialog.schedule}
          onPaused={(next) => {
            setParam(focusedScheduleParam, dialog.schedule.id);
            show(next);
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteScheduleDialog
          isOpen
          onClose={() => setDialog(null)}
          schedule={dialog.schedule}
          onDeleted={(next) => show(next)}
        />
      )}
    </>
  );
}

interface ScheduleActs {
  // Each absent when the person may not.
  onRunNow?: (schedule: ScheduleRow) => Promise<void>;
  onPause?: (schedule: ScheduleRow) => void;
  onResume?: (schedule: ScheduleRow) => Promise<void>;
  onEdit?: (schedule: ScheduleRow) => void;
}

function ScheduleButtons({ schedule, acts }: { schedule: ScheduleRow; acts: ScheduleActs }) {
  if (schedule.source.kind === "repeat") {
    return (
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to={`/intentions?t=${encodeURIComponent(schedule.source.templateId)}`}>
            {i18n.t("tasks:schedulesPage.editIntentions")}
          </Link>
        </Button>
      </div>
    );
  }

  const { onRunNow, onPause, onResume, onEdit } = acts;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {onRunNow !== undefined && (
        <Button variant="outline" size="sm" onClick={() => void onRunNow(schedule)}>
          {i18n.t("tasks:schedulesPage.runNow")}
        </Button>
      )}
      {schedule.pause === null
        ? onPause !== undefined && (
            <Button variant="outline" size="sm" onClick={() => onPause(schedule)}>
              {i18n.t("tasks:schedulesPage.pause")}
            </Button>
          )
        : onResume !== undefined && (
            <Button variant="outline" size="sm" onClick={() => void onResume(schedule)}>
              {i18n.t("tasks:schedulesPage.resume")}
            </Button>
          )}
      {onEdit !== undefined && (
        <Button variant="outline" size="sm" onClick={() => onEdit(schedule)}>
          {i18n.t("tasks:schedulesPage.edit")}
        </Button>
      )}
    </div>
  );
}

function PauseNote({ schedule, nameOf }: { schedule: ScheduleRow; nameOf: NameOf }) {
  if (schedule.pause === null) {
    return null;
  }

  return (
    <StatusNote tone="slate" title={i18n.t("tasks:schedulesPage.pausedTitle")}>
      {i18n.t("tasks:schedulesPage.pausedBy", {
        name: nameOf(schedule.pause.pausedBy),
        date: shortDayOf(schedule.pause.pausedAt),
        reason: schedule.pause.reason,
      })}
    </StatusNote>
  );
}

function sourceLine(schedule: ScheduleRow, isNarrow: boolean): string {
  if (schedule.source.kind === "repeat") {
    return i18n.t("tasks:schedulesPage.repeatSource");
  }

  const { instance } = schedule.source;
  return [instance.name, isNarrow ? cadenceText(schedule.cadence) : instance.plugin].join(" · ");
}

function nextText(schedule: ScheduleRow, asOf: string) {
  return schedule.nextAt === null ? (
    <span className="text-muted-foreground">{i18n.t("tasks:schedulesPage.paused")}</span>
  ) : (
    <span className="whitespace-nowrap" title={dayAndTimeOf(schedule.nextAt)}>
      {aheadText(schedule.nextAt, asOf)}
    </span>
  );
}

function LastRun({ schedule, asOf }: { schedule: ScheduleRow; asOf: string }) {
  const { lastRun } = schedule;
  if (lastRun === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <RunOverlayLink runId={lastRun.id} className="whitespace-nowrap">
      <RunStateBadge run={lastRun} />{" "}
      <span className="text-muted-foreground">{agoText(lastRun.startedAt, asOf)}</span>
    </RunOverlayLink>
  );
}

interface ScheduleColumnsOptions {
  asOf: string;
  acts: ScheduleActs;
  t?: (key: string) => string;
}

// The demo's columns per tier (component-interfaces.md §2.4).
export function scheduleColumns({
  asOf,
  acts,
  t,
}: ScheduleColumnsOptions): PerTier<readonly ColumnDefinition<ScheduleRow>[]> {
  const translate = t ?? ((key: string) => i18n.t(`tasks:${key}`));
  const what = (isNarrow: boolean, isLarge: boolean): ColumnDefinition<ScheduleRow> => ({
    key: "what",
    header: translate("schedulesPage.what"),
    track: "minmax(14rem,2fr)",
    cell: (schedule) => (
      <>
        <div className="font-medium">{schedule.name}</div>
        <Sub>
          {isLarge && schedule.source.kind === "plugin"
            ? schedule.source.instance.name
            : sourceLine(schedule, isNarrow)}
        </Sub>
      </>
    ),
  });
  const plugin: ColumnDefinition<ScheduleRow> = {
    key: "plugin",
    header: translate("schedulesPage.plugin"),
    track: "minmax(8rem,1fr)",
    cell: (schedule) =>
      schedule.source.kind === "plugin" ? (
        schedule.source.instance.plugin
      ) : (
        <span className="text-muted-foreground">{i18n.t("tasks:schedulesPage.core")}</span>
      ),
  };
  const cadence = (withOverlap: boolean): ColumnDefinition<ScheduleRow> => ({
    key: "cadence",
    header: translate("schedulesPage.runs"),
    track: "minmax(9rem,1fr)",
    cell: (schedule) => (
      <>
        {cadenceText(schedule.cadence)}
        {withOverlap && schedule.source.kind === "plugin" && (
          <Sub>{translate(overlapNotes[schedule.overlap])}</Sub>
        )}
      </>
    ),
  });
  const overlap: ColumnDefinition<ScheduleRow> = {
    key: "overlap",
    header: translate("schedulesPage.ifStillRunning"),
    track: "max-content",
    cell: (schedule) =>
      schedule.source.kind === "plugin"
        ? translate(overlapLabels[schedule.overlap]).toLowerCase()
        : "—",
  };
  const last: ColumnDefinition<ScheduleRow> = {
    key: "last",
    header: translate("schedulesPage.lastRun"),
    track: "max-content",
    cell: (schedule) => <LastRun schedule={schedule} asOf={asOf} />,
  };
  const next: ColumnDefinition<ScheduleRow> = {
    key: "next",
    header: translate("schedulesPage.nextHeader"),
    track: "max-content",
    cell: (schedule) => nextText(schedule, asOf),
  };
  const act: ColumnDefinition<ScheduleRow> = {
    key: "act",
    header: "",
    track: "max-content",
    cell: (schedule) => <ScheduleButtons schedule={schedule} acts={acts} />,
  };

  return {
    large: [what(false, true), plugin, cadence(false), overlap, last, next, act],
    notebook: [what(false, false), cadence(true), last, next, act],
    small: [what(true, false), next, act],
    phone: [what(true, false), next, act],
  };
}

function ScheduleCard({
  schedule,
  asOf,
  nameOf,
  acts,
}: {
  schedule: ScheduleRow;
  asOf: string;
  nameOf: NameOf;
  acts: ScheduleActs;
}) {
  const { t } = useTranslation("tasks");
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <b className="font-semibold">{schedule.name}</b>
        {nextText(schedule, asOf)}
      </div>
      <Sub>
        {cadenceText(schedule.cadence)}
        {schedule.lastRun !== null &&
          ` · ${t("schedulesPage.lastRunTime", { time: agoText(schedule.lastRun.startedAt, asOf) })}`}
      </Sub>
      {schedule.pause !== null && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {i18n.t("tasks:schedulesPage.pausedByShort", {
            name: nameOf(schedule.pause.pausedBy),
            reason: schedule.pause.reason,
          })}
        </p>
      )}
      <div className="mt-2.5">
        <ScheduleButtons schedule={schedule} acts={acts} />
      </div>
    </>
  );
}

function ScheduleTimeline({
  index,
  range,
  onRangeChange,
}: {
  index: ScheduleIndex;
  range: TimelineRange;
  onRangeChange: (range: TimelineRange) => void;
}) {
  const { t } = useTranslation("tasks");
  const lanes: TimelineLane[] = index.schedules.map((schedule) => ({
    id: schedule.id,
    label: schedule.name.split(" — ")[0] ?? schedule.name,
    runsAt: schedule.window.runsAt.map((at) => new Date(at)),
    runCount: schedule.window.runCount,
    isPaused: schedule.pause !== null,
    bandText: cadenceText(schedule.cadence),
    emptyText:
      schedule.nextAt === null
        ? ""
        : t("schedulesPage.nextRunTime", { time: aheadText(schedule.nextAt, index.asOf) }),
    isRepeat: schedule.source.kind === "repeat",
  }));

  return (
    <section className="py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t(rangeTitles[range])}</h2>
        <fieldset className="flex rounded-md border p-0.5">
          <legend className="sr-only">{t("schedulesPage.window")}</legend>
          {timelineRanges.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === range}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs",
                value === range
                  ? "bg-secondary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onRangeChange(value)}
            >
              {t(rangeLabels[value])}
            </button>
          ))}
        </fieldset>
      </div>
      <Timeline
        span={range}
        now={new Date(index.asOf)}
        end={new Date(index.windowEnd)}
        lanes={lanes}
      />
      <p className="mt-3 text-xs text-muted-foreground">{t("schedulesPage.timelineFinePrint")}</p>
    </section>
  );
}
