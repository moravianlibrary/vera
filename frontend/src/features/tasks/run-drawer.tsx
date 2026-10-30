// One run in the drawer (docs/demos/shared/page-tasks.js `openRun`): its state and how far it is,
// why it failed or was skipped, what ran and what started it, what it changed, its items (All or
// only the Errors), its log, and *Cancel…*, *Run again* and *Download log*. A link to its
// schedule is for `task.read`, who sees Schedules; to its plugin for `plugin.read`.

import type { RunDetail, RunItem } from "@vera/contract/tasks";
import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { getRunLog } from "@/api/tasks";
import { DetailCard, FactGrid, FinePrint } from "@/components/detail-card";
import { RunStateBadge } from "@/components/run-state-badge";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { RunProgress } from "@/components/visualizations/run-progress";
import { pluginInstanceHrefOf } from "@/features/plugins/plugins-view";
import type { NameOf } from "@/features/tasks/run-parts";
import { starterOf } from "@/features/tasks/run-parts";
import { repeatNameOf, timeLeftText, tookText } from "@/features/tasks/task-words";
import { i18n } from "@/i18n";
import { cadenceText } from "@/lib/format-cadence";
import { agoText, clockTimeOf, dayAndTimeOf } from "@/lib/format-moment";
import { formatCount } from "@/lib/format-number";
import { cn } from "@/lib/utils";

const linkClass = "text-primary underline-offset-2 hover:underline";

interface RunDrawerProps {
  detail: RunDetail;
  nameOf: NameOf;
  canSeeSchedules: boolean;
  canSeePlugins: boolean;
  // Absent when the person may not.
  onCancel?: () => void;
  onRunAgain?: () => void;
}

export function RunDrawer({
  detail,
  nameOf,
  canSeeSchedules,
  canSeePlugins,
  onCancel,
  onRunAgain,
}: RunDrawerProps) {
  const { t } = useTranslation("tasks");
  const { run, asOf } = detail;
  const isRunning = run.state === "Running";

  const facts = [
    {
      label: t("runDrawer.plugin"),
      value: <PluginFact detail={detail} canSeePlugins={canSeePlugins} />,
    },
    {
      label: t("runDrawer.trigger"),
      value: <TriggerFact detail={detail} nameOf={nameOf} canSeeSchedules={canSeeSchedules} />,
    },
    {
      label: t("runDrawer.started"),
      value: (
        <>
          {dayAndTimeOf(run.startedAt)}{" "}
          <span className="text-muted-foreground">· {agoText(run.startedAt, asOf)}</span>
        </>
      ),
    },
    {
      label: isRunning ? t("runDrawer.runningFor") : t("runDrawer.took"),
      value: tookText(run, asOf),
    },
    ...(run.itemCount > 0
      ? [
          {
            label: t("runDrawer.items"),
            value: (
              <>
                {formatCount(run.doneCount)} / {formatCount(run.itemCount)}
                {run.errorCount > 0 && (
                  <span className="text-tone-red-foreground">
                    {" "}
                    · {t("runDrawer.errorsCount", { count: formatCount(run.errorCount) })}
                  </span>
                )}
              </>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-4 text-ui">
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <RunStateBadge run={run} />
          {run.secondsLeft !== null && (
            <span className="text-xs text-muted-foreground">{timeLeftText(run.secondsLeft)}</span>
          )}
        </div>
        {(isRunning || run.state === "Cancelled") && (
          <RunProgress
            done={run.doneCount}
            total={run.itemCount}
            errors={run.errorCount}
            form="card"
          />
        )}
        {run.failure !== null && (
          <StatusNote tone="red" title={t("runDrawer.failed")}>
            {run.failure}
          </StatusNote>
        )}
        {run.note !== null && (
          <StatusNote
            tone="slate"
            title={run.state === "Skipped" ? t("runDrawer.skipped") : t("runDrawer.note")}
          >
            {run.note}
          </StatusNote>
        )}
      </div>

      <DetailCard title={t("runDrawer.run")}>
        <FactGrid facts={facts} />
      </DetailCard>

      <DetailCard title={t("runDrawer.whatChanged")}>
        {run.changes !== null && run.changes.length > 0 ? (
          <ul className="grid list-disc gap-1 pl-5">
            {run.changes.map((change) => (
              <li key={change.label}>
                <Link to={change.path} className={linkClass}>
                  {change.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            {isRunning
              ? t("runDrawer.shownWhenFinished")
              : run.state === "Done"
                ? t("runDrawer.nothingKnown")
                : t("runDrawer.nothing")}
          </p>
        )}
      </DetailCard>

      {run.itemCount > 1 && <ItemsCard detail={detail} />}

      <DetailCard title={t("runDrawer.log")}>
        <pre className="max-h-72 overflow-auto rounded-md bg-muted px-3 py-2.5 font-mono text-caption leading-relaxed whitespace-pre-wrap">
          {detail.log.map((line) => (
            <div
              key={`${line.at}-${line.text}`}
              className={cn(line.isError && "text-tone-red-foreground")}
            >
              [{clockTimeOf(line.at)}:{secondsOf(line.at)}] {line.text}
            </div>
          ))}
        </pre>
      </DetailCard>

      <div className="flex flex-wrap gap-2">
        {onRunAgain !== undefined && (
          <Button size="sm" onClick={onRunAgain}>
            {t("runParts.runAgain")}
          </Button>
        )}
        {onCancel !== undefined && (
          <Button size="sm" variant="outline" onClick={onCancel}>
            {t("runParts.cancel")}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => void downloadLog(run.id)}>
          <Download />
          {t("runDrawer.downloadLog")}
        </Button>
      </div>
    </div>
  );
}

function secondsOf(moment: string): string {
  return String(new Date(moment).getSeconds()).padStart(2, "0");
}

function PluginFact({ detail, canSeePlugins }: { detail: RunDetail; canSeePlugins: boolean }) {
  const { source } = detail.run;
  if (source.kind === "core") {
    return (
      <>
        {source.name}{" "}
        <span className="text-muted-foreground">· {i18n.t("tasks:runDrawer.core")}</span>
      </>
    );
  }

  const name = canSeePlugins ? (
    <Link to={pluginInstanceHrefOf(source.instance.id)} className={linkClass}>
      {source.instance.name}
    </Link>
  ) : (
    source.instance.name
  );
  return (
    <>
      {name} <span className="text-muted-foreground">· {source.instance.plugin}</span>
    </>
  );
}

function TriggerFact({
  detail,
  nameOf,
  canSeeSchedules,
}: {
  detail: RunDetail;
  nameOf: NameOf;
  canSeeSchedules: boolean;
}): ReactNode {
  const { run } = detail;
  const { trigger } = run;
  switch (trigger.kind) {
    case "schedule":
      return (
        <>
          {i18n.t("tasks:runDrawer.schedule", { cadence: cadenceText(trigger.cadence) })}
          {canSeeSchedules && (
            <>
              {" · "}
              <Link
                to={`/schedules?s=${encodeURIComponent(trigger.scheduleId)}`}
                className={linkClass}
              >
                {i18n.t("tasks:runDrawer.seeSchedule")}
              </Link>
            </>
          )}
        </>
      );
    case "repeat":
      return (
        <>
          {i18n.t("tasks:runDrawer.intentionRepeat")}{" "}
          <Link
            to={`/intentions?t=${encodeURIComponent(trigger.templateId)}`}
            className={linkClass}
          >
            {repeatNameOf(trigger.name)}
          </Link>
        </>
      );
    case "approval":
      return (
        <>
          {i18n.t("tasks:runDrawer.approval", { name: starterOf(run, nameOf) })}{" "}
          <Link to={trigger.from.path} className={linkClass}>
            {trigger.from.label}
          </Link>
          {i18n.t("tasks:runDrawer.ingestManual")}
        </>
      );
    case "manual":
      return (
        <>
          {starterOf(run, nameOf)}, from{" "}
          <Link to={trigger.from.path} className={linkClass}>
            {trigger.from.label}
          </Link>
        </>
      );
  }
}

const itemTabs = ["all", "errors"] as const;
type ItemTab = (typeof itemTabs)[number];

function ItemsCard({ detail }: { detail: RunDetail }) {
  const { t } = useTranslation("tasks");
  const [tab, setTab] = useState<ItemTab>("all");
  const items = tab === "errors" ? detail.errors : detail.items;
  const total = tab === "errors" ? detail.run.errorCount : detail.run.doneCount;
  const tabLabels = {
    all: t("runDrawer.all"),
    errors: t("runDrawer.errorsTab", { count: detail.run.errorCount }),
  } as const satisfies Record<ItemTab, string>;

  return (
    <DetailCard title={t("runDrawer.items")}>
      <div role="tablist" aria-label={t("runDrawer.items")} className="mb-2 flex gap-1">
        {itemTabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              tab === value ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => setTab(value)}
          >
            {tabLabels[value]}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{i18n.t("tasks:runDrawer.noErrors")}</p>
      ) : (
        <ul className="grid divide-y">
          {items.map((item) => (
            <ItemRow key={item.iterationId} item={item} />
          ))}
        </ul>
      )}
      <FinePrint>
        {t("runDrawer.showingItems", { shown: items.length, total: formatCount(total) })}
      </FinePrint>
    </DetailCard>
  );
}

function ItemRow({ item }: { item: RunItem }) {
  return (
    <li className="flex items-start justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="font-mono text-xs">{item.iterationId}</span> {item.title}
        {item.error !== null && (
          <span className="block text-xs text-tone-red-foreground">{item.error}</span>
        )}
      </span>
      <ToneBadge tone={item.error === null ? "green" : "red"}>
        {item.error === null ? i18n.t("tasks:runDrawer.ok") : i18n.t("tasks:runDrawer.error")}
      </ToneBadge>
    </li>
  );
}

// Saved as a file, from the server's text.
async function downloadLog(runId: string): Promise<void> {
  const text = await getRunLog(runId);
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${runId}.log`;
  link.click();
  URL.revokeObjectURL(url);
}
