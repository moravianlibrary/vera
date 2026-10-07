// Plugins (STATUS "Plugins"; docs/demos/shared/page-plugins.js; permissions.md §3, `plugin.read`):
// one table grouped twice, kind → implementation → instance, since that is how the model reads:
// a kind is the job, an implementation the code and what it declares, an instance a configured
// copy that runs. An implementation's row opens its contract in the drawer (`?impl=`), an
// instance's row its configuration, when it runs and what its last runs did (`?i=`). *Type*,
// *State* and the search narrow the table in place. Schedules are shown here and edited only on
// Schedules.
// TODO(rrandiak): labels move to i18n.

import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { PluginImplementation, PluginIndex, PluginInstanceDetail } from "@/api/plugins";
import { runPluginInstance } from "@/api/plugins";
import type { ViewAction } from "@/components/actions/action-bar";
import { FilterBar } from "@/components/filters/filter-bar";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { NoticeLine } from "@/components/notice-line";
import { TableWithDrawer } from "@/components/table-with-drawer";
import type { Session } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import { schedulableKinds } from "@/domain/schedules";
import type { DrawerNames } from "@/features/plugins/plugin-drawers";
import {
  ImplementationDrawer,
  InstanceDrawer,
  implementationSubtitle,
  instanceSubtitle,
} from "@/features/plugins/plugin-drawers";
import { instanceColumns, useInstanceGroups } from "@/features/plugins/plugin-table";
import type { PluginQuery, PluginSelection } from "@/features/plugins/plugins-view";
import {
  implementationParam,
  instanceParam,
  pluginFacetsOf,
  pluginsView,
  selectionOf,
  shownPluginsOf,
} from "@/features/plugins/plugins-view";
import { pluginInvalidations, usePluginsQuery } from "@/features/plugins/use-plugins-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useProposalCustodiesQuery, useRolesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { plural } from "@/lib/plural";

export interface PluginNotice {
  title: string;
  text: string;
  tone: "green" | "red";
  // The run an act started, followed on Tasks.
  runId?: string;
}

export function PluginsPage() {
  const [params, setParams] = useSearchParams();
  const { data: index } = usePluginsQuery();
  const { data: session } = useSessionQuery();
  const [notice, setNotice] = useState<PluginNotice | null>(null);
  const query = pluginsView.parseSearchParams(params);
  const selection = index === undefined ? null : selectionOf(params, index);

  // The filter is replaced and the open record kept, as in every view.
  const setQuery = (next: PluginQuery) => {
    const nextParams = pluginsView.toSearchParams(next);
    for (const name of [instanceParam, implementationParam]) {
      const value = params.get(name);
      if (value !== null) {
        nextParams.set(name, value);
      }
    }

    setParams(nextParams, { replace: true });
  };

  const open = (name: typeof instanceParam | typeof implementationParam, id: string | null) => {
    const next = new URLSearchParams(params);
    next.delete(instanceParam);
    next.delete(implementationParam);
    if (id !== null) {
      next.set(name, id);
    }

    setParams(next, { replace: true });
  };

  if (session === undefined) {
    return null;
  }

  return (
    <>
      <PageHeader title="Plugins" />
      <FilterBar
        fields={pluginsView.fields}
        query={query}
        facets={index === undefined ? undefined : pluginFacetsOf(index, query)}
        onQueryChange={setQuery}
        searchLabel="Search plugins and instances"
        searchPlaceholder="Search plugins and instances…"
      />
      <PageContent className="@container">
        {index !== undefined && (
          <PluginTable
            index={index}
            query={query}
            session={session}
            selection={selection}
            notice={notice}
            onNotice={setNotice}
            onOpenInstance={(id) => open(instanceParam, id)}
            onOpenImplementation={(id) => open(implementationParam, id)}
            onClose={() => open(instanceParam, null)}
          />
        )}
      </PageContent>
    </>
  );
}

interface PluginTableProps {
  index: PluginIndex;
  query: PluginQuery;
  session: Session;
  selection: PluginSelection | null;
  notice: PluginNotice | null;
  onNotice: (notice: PluginNotice | null) => void;
  onOpenInstance: (instanceId: string) => void;
  onOpenImplementation: (implementationId: string) => void;
  onClose: () => void;
}

function PluginTable({
  index,
  query,
  session,
  selection,
  notice,
  onNotice,
  onOpenInstance,
  onOpenImplementation,
  onClose,
}: PluginTableProps) {
  const labels = useReferenceLabels(["users", "categories"]);
  const { data: roles = [] } = useRolesQuery();
  const { data: custodies = [] } = useProposalCustodiesQuery();
  const shown = shownPluginsOf(index, query);
  const isFiltered = !pluginsView.isSameQuery(query, {});
  const groups = useInstanceGroups({ shown, isFiltered: (query.states ?? []).length > 0 });
  const canSeeTasks = hasPermission(session, "task.read");
  const run = useActionMutation({
    call: runPluginInstance,
    invalidates: pluginInvalidations,
    refusalTexts: {
      "plugin.disabled": "It is disabled; enable it first.",
      "plugin.not_runnable": "It runs only while somebody uses it.",
      403: "You may not run plugins.",
    },
  });
  const implementationOf = (instance: PluginInstanceDetail) =>
    index.implementations.find((candidate) => candidate.id === instance.implementationId);
  const names: DrawerNames = {
    userOf: labels.users,
    categoryOf: labels.categories,
    roleOf: (roleId) => roles.find((role) => role.id === roleId)?.name ?? roleId,
    custodyIdOf: (name) => custodies.find((custody) => custody.name === name)?.id,
  };
  const reach = { canSeeTasks, canSeeAccess: hasPermission(session, "access.read") };

  const runNow = async (instance: PluginInstanceDetail) => {
    const result = await run.run(instance.id);
    onNotice(
      result.isDone
        ? {
            title: `${instance.name} started`,
            text: "Follow it on Tasks.",
            tone: "green",
            runId: result.value.id,
          }
        : { title: `${instance.name} did not start`, text: result.refusal.message, tone: "red" },
    );
  };

  const instanceActions = (instance: PluginInstanceDetail): ViewAction[] => {
    const isRunnable = (schedulableKinds as readonly string[]).includes(instance.kind);
    return isRunnable && instance.isEnabled && hasPermission(session, "plugin.run")
      ? [
          {
            id: "run",
            label: "Run now",
            isPrimary: true,
            onSelect: () => void runNow(instance),
          },
        ]
      : [];
  };

  const noticeLine =
    notice === null ? null : (
      <NoticeLine
        tone={notice.tone}
        title={notice.title}
        onDismiss={() => onNotice(null)}
        className="mb-3"
      >
        {notice.text}
        {notice.runId !== undefined && (
          <>
            {" "}
            <Link
              to={`/tasks?run=${encodeURIComponent(notice.runId)}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Open the run
            </Link>
          </>
        )}
      </NoticeLine>
    );

  const drawer = drawerOf(selection, {
    index,
    names,
    reach,
    asOf: index.asOf,
    instanceActions,
    onOpenInstance,
    onOpenImplementation,
  });

  return (
    <TableWithDrawer
      openId={
        selection === null
          ? null
          : selection.kind === "instance"
            ? selection.instance.id
            : selection.implementation.id
      }
      onClose={onClose}
      drawerTitle={drawer.title}
      drawerSubtitle={drawer.subtitle}
      drawer={drawer.body}
      above={
        <>
          {noticeLine}
          <Counts index={index} />
        </>
      }
      table={{
        rows: shown.instances,
        rowId: (instance) => instance.id,
        columns: instanceColumns({
          asOf: index.asOf,
          implementationOf,
          categoryOf: labels.categories,
        }),
        groupBy: groups,
        onOpen: (id) =>
          index.instances.some((instance) => instance.id === id)
            ? onOpenInstance(id)
            : onOpenImplementation(id),
        emptyText: isFiltered ? "Nothing matches." : "No plugin is installed.",
      }}
    />
  );
}

interface DrawerOptions {
  index: PluginIndex;
  names: DrawerNames;
  reach: { canSeeTasks: boolean; canSeeAccess: boolean };
  asOf: string;
  instanceActions: (instance: PluginInstanceDetail) => ViewAction[];
  onOpenInstance: (instanceId: string) => void;
  onOpenImplementation: (implementationId: string) => void;
}

function drawerOf(selection: PluginSelection | null, options: DrawerOptions) {
  if (selection === null) {
    return { title: "", subtitle: undefined, body: null };
  }

  const { index, names, reach, asOf, instanceActions, onOpenInstance, onOpenImplementation } =
    options;
  if (selection.kind === "implementation") {
    const { implementation } = selection;
    return {
      title: implementation.name,
      subtitle: implementationSubtitle(implementation),
      body: (
        <ImplementationDrawer
          implementation={implementation}
          instances={instancesOf(index, implementation)}
          onOpenInstance={onOpenInstance}
          names={names}
          actions={[]}
        />
      ),
    };
  }

  const { instance, implementation } = selection;
  const openImplementation = () => onOpenImplementation(implementation.id);
  return {
    title: instance.name,
    subtitle: instanceSubtitle(instance, implementation),
    body: (
      <InstanceDrawer
        instance={instance}
        implementation={implementation}
        asOf={asOf}
        names={names}
        reach={reach}
        onOpenImplementation={openImplementation}
        actions={instanceActions(instance)}
      />
    ),
  };
}

function instancesOf(
  index: PluginIndex,
  implementation: PluginImplementation,
): PluginInstanceDetail[] {
  return index.instances.filter((instance) => instance.implementationId === implementation.id);
}

// "13 types · 30 implementations · 31 instances · 1 disabled".
function Counts({ index }: { index: PluginIndex }) {
  const kindCount = new Set(index.implementations.map((implementation) => implementation.kind))
    .size;
  const disabledCount = index.instances.filter((instance) => !instance.isEnabled).length;
  return (
    <p className="mb-3 text-xs text-muted-foreground">
      {plural(kindCount, "type")} · {plural(index.implementations.length, "implementation")} ·{" "}
      {plural(index.instances.length, "instance")}
      {disabledCount > 0 && ` · ${disabledCount} disabled`}
    </p>
  );
}
