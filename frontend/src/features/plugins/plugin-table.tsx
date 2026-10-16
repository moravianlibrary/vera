// Plugins' one table, grouped twice (docs/demos/shared/page-plugins.js `table`; decided with the
// user 2026-09-26): a kind's row, which collapses, then each implementation's row with its name,
// version, what it does and what it supplies, and *New instance*; then the instances, with the
// columns the tier has room for (component-interfaces.md §2.4): Instance · Configuration · Linked
// to · Runs · Last run · state on a large screen, Configuration and Runs going as it narrows. An
// implementation with no instance says it does nothing until one is configured.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import type { PluginImplementation, PluginInstanceDetail } from "@/api/plugins";
import type { GroupLevel } from "@/components/data-table";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RunStateBadge } from "@/components/run-state-badge";
import { ToneBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { PluginKind } from "@/domain/plugins";
import { pluginKinds } from "@/domain/plugins";
import {
  pluginKindJobs,
  pluginKindLabels,
  pluginKindTones,
  suppliesOf,
  triggerLabels,
} from "@/features/plugins/plugin-words";
import type { ShownPlugins } from "@/features/plugins/plugins-view";
import { configurationText } from "@/features/plugins/plugins-view";
import type { PerTier } from "@/hooks/use-tier";
import { useTier } from "@/hooks/use-tier";
import { cadenceText } from "@/lib/format-cadence";
import { agoText } from "@/lib/format-moment";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

const smallBadge = "px-1.5 py-0 text-[0.625rem]";

export function KindBadge({ kind, className }: { kind: PluginKind; className?: string }) {
  return (
    <ToneBadge tone={pluginKindTones[kind]} className={cn(smallBadge, className)}>
      {pluginKindLabels[kind]}
    </ToneBadge>
  );
}

export function InstanceStateBadge({ instance }: { instance: PluginInstanceDetail }) {
  return instance.isEnabled ? (
    <ToneBadge tone="green" className={smallBadge}>
      enabled
    </ToneBadge>
  ) : (
    <ToneBadge tone="slate" className={smallBadge}>
      disabled
    </ToneBadge>
  );
}

export function SupplyChips({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="rounded border bg-background px-1.5 py-px text-[0.6875rem] text-muted-foreground"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// "on ingest", "every 30 min", a paused schedule said so.
export function runsPartsOf(instance: PluginInstanceDetail): string[] {
  return [
    ...instance.triggers.map((trigger) => triggerLabels[trigger]),
    ...instance.schedules.map(
      (schedule) => `${cadenceText(schedule.cadence)}${schedule.isPaused ? " (paused)" : ""}`,
    ),
  ];
}

export function runsText(instance: PluginInstanceDetail): string {
  const parts = runsPartsOf(instance);
  return parts.length === 0 ? "—" : parts.join(" + ");
}

// Each part on one line, so "every 15 min" never breaks.
function RunsCell({ instance }: { instance: PluginInstanceDetail }) {
  const parts = runsPartsOf(instance);
  if (parts.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="text-xs">
      {parts.map((part, index) => (
        <span key={part} className="whitespace-nowrap">
          {index > 0 && " + "}
          {part}
        </span>
      ))}
    </span>
  );
}

// The last run with its state when it is still on Tasks, else when it last ran at all.
function LastRun({ instance, asOf }: { instance: PluginInstanceDetail; asOf: string }) {
  const [latest] = instance.recentRuns;
  if (instance.lastRunAt === null) {
    return <span className="text-muted-foreground">never</span>;
  }

  return (
    <span className="whitespace-nowrap">
      {latest !== undefined && latest.startedAt === instance.lastRunAt && (
        <>
          <RunStateBadge run={latest} />{" "}
        </>
      )}
      <span className="text-muted-foreground">{agoText(instance.lastRunAt, asOf)}</span>
    </span>
  );
}

interface ColumnsOptions {
  asOf: string;
  implementationOf: (instance: PluginInstanceDetail) => PluginImplementation | undefined;
  categoryOf: (categoryId: string) => string;
  // A request custody's name; undefined once it is deleted.
  custodyOf: (custodyId: string) => string | undefined;
}

// ACCESS-custody-by-plugins: a custody rule names the custody it places into, and says so when
// that custody was deleted (ACCESS-custody-delete).
function CustodyLine({
  instance,
  custodyOf,
}: {
  instance: PluginInstanceDetail;
  custodyOf: ColumnsOptions["custodyOf"];
}) {
  if (instance.settings?.kind !== "Custody") {
    return null;
  }

  const name = custodyOf(instance.settings.custodyId);
  return name === undefined ? (
    <div className="text-xs text-amber-700 dark:text-amber-400">
      Its custody was deleted: it places nothing
    </div>
  ) : (
    <div className="text-xs text-muted-foreground">into {name}</div>
  );
}

export function instanceColumns({
  asOf,
  implementationOf,
  categoryOf,
  custodyOf,
}: ColumnsOptions): PerTier<readonly ColumnDefinition<PluginInstanceDetail>[]> {
  // Indented under its implementation; narrow, with the implementation's name under it.
  const nameColumn = (
    isNarrow: boolean,
    indent: string,
  ): ColumnDefinition<PluginInstanceDetail> => ({
    key: "name",
    header: "Instance",
    track: "minmax(10rem,1fr)",
    cell: (instance) => {
      const implementation = implementationOf(instance);
      const isBehind =
        implementation !== undefined && implementation.versions[0]?.version !== instance.version;
      return (
        <div className={indent}>
          <div className="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
            Instance
          </div>
          <div className="font-medium">{instance.name}</div>
          <CustodyLine instance={instance} custodyOf={custodyOf} />
          {(isNarrow || isBehind) && (
            <div className="text-xs text-muted-foreground">
              {isNarrow && implementation?.name}
              {isNarrow && isBehind && " · "}
              {isBehind && <span className="font-mono">v{instance.version}</span>}
            </div>
          )}
        </div>
      );
    },
  });
  const configuration: ColumnDefinition<PluginInstanceDetail> = {
    key: "configuration",
    header: "Configuration",
    track: "minmax(12rem,2fr)",
    cell: (instance) => (
      <span className="font-mono text-[0.6875rem] break-all text-muted-foreground">
        {configurationText(instance)}
      </span>
    ),
  };
  const linked: ColumnDefinition<PluginInstanceDetail> = {
    key: "linked",
    header: "Linked to",
    track: "max-content",
    cell: (instance) =>
      instance.linkedCategoryId === null ? (
        <span className="whitespace-nowrap text-muted-foreground">all categories</span>
      ) : (
        <span className="whitespace-nowrap">{categoryOf(instance.linkedCategoryId)}</span>
      ),
  };
  const runs: ColumnDefinition<PluginInstanceDetail> = {
    key: "runs",
    header: "Runs",
    track: "max-content",
    cell: (instance) => <RunsCell instance={instance} />,
  };
  const last: ColumnDefinition<PluginInstanceDetail> = {
    key: "last",
    header: "Last run",
    track: "max-content",
    cell: (instance) => <LastRun instance={instance} asOf={asOf} />,
  };
  const state: ColumnDefinition<PluginInstanceDetail> = {
    key: "state",
    header: "",
    track: "max-content",
    cell: (instance) => <InstanceStateBadge instance={instance} />,
  };
  return {
    large: [nameColumn(false, "pl-8"), configuration, linked, runs, last, state],
    notebook: [nameColumn(false, "pl-8"), configuration, runs, last, state],
    small: [nameColumn(true, "pl-8"), runs, state],
    phone: [nameColumn(true, "pl-4"), state],
  };
}

interface GroupsOptions {
  shown: ShownPlugins;
  // Absent without plugin.configure.
  onNewInstance?: (implementation: PluginImplementation) => void;
  isFiltered: boolean;
}

export function useInstanceGroups({
  shown,
  onNewInstance,
  isFiltered,
}: GroupsOptions): GroupLevel<PluginInstanceDetail>[] {
  const tier = useTier();
  const implementationsOf = (kind: string) =>
    shown.implementations.filter((implementation) => implementation.kind === kind);
  const kindOf = (kind: string) => pluginKinds.find((candidate) => candidate === kind);
  return [
    {
      keyOf: (instance) => instance.kind,
      keysWithin: () => pluginKinds.filter((kind) => implementationsOf(kind).length > 0),
      isCollapsible: true,
      rowClassName: "[&_td]:py-3",
      header: (key, rows) => {
        const kind = kindOf(key);
        return kind === undefined ? null : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
              Type
            </span>
            <KindBadge kind={kind} className="border-foreground/20" />
            <span className="text-xs text-muted-foreground">
              {tier === "phone" ? "" : `${pluginKindJobs[kind]} · `}
              {plural(implementationsOf(kind).length, "implementation")} ·{" "}
              {plural(rows.length, "instance")}
            </span>
          </span>
        );
      },
    },
    {
      keyOf: (instance) => instance.implementationId,
      keysWithin: (kind) =>
        implementationsOf(kind ?? "").map((implementation) => implementation.id),
      isCollapsible: false,
      isOpenable: true,
      rowClassName: "[&_td]:py-3",
      emptyText: () =>
        isFiltered
          ? "No instance in this state."
          : "No instance — it does nothing until one is configured.",
      header: (key) => {
        const implementation = shown.implementations.find((candidate) => candidate.id === key);
        return implementation === undefined ? null : (
          <ImplementationHeader
            implementation={implementation}
            isPhone={tier === "phone"}
            action={
              onNewInstance === undefined || tier === "phone" ? undefined : (
                <Button size="sm" onClick={() => onNewInstance(implementation)}>
                  New instance…
                </Button>
              )
            }
          />
        );
      },
    },
  ];
}

function ImplementationHeader({
  implementation,
  isPhone,
  action,
}: {
  implementation: PluginImplementation;
  isPhone: boolean;
  action?: ReactNode;
}) {
  const [newest] = implementation.versions;
  return (
    <div className={cn("flex items-start gap-3", isPhone ? "pl-1" : "pl-5")}>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[0.625rem] font-semibold tracking-wider text-foreground uppercase">
          Plugin
        </div>
        <div className={cn("flex flex-wrap items-baseline gap-x-2", !isPhone && "mb-1")}>
          <span className="font-semibold">{implementation.name}</span>
          <span className="font-mono text-xs text-muted-foreground">v{newest?.version}</span>
          {!isPhone && (
            <span className="text-xs text-muted-foreground">{implementation.description}</span>
          )}
        </div>
        {!isPhone && newest !== undefined && <SupplyChips items={suppliesOf(newest)} />}
      </div>
      {action}
    </div>
  );
}
