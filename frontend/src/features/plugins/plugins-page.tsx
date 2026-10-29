// Plugins (STATUS "Plugins"; docs/demos/shared/page-plugins.js; permissions.md §3, `plugin.read`):
// one table grouped twice, kind → implementation → instance, since that is how the model reads:
// a kind is the job, an implementation the code and what it declares, an instance a configured
// copy that runs. An implementation's row opens its contract in the drawer (`?impl=`), an
// instance's row its configuration, when it runs and what its last runs did (`?i=`). *Type*,
// *State* and the search narrow the table in place. Schedules are shown here and edited only on
// Schedules.
// TODO(rrandiak): labels move to i18n.

import type {
  PluginImplementation,
  PluginIndex,
  PluginInstanceDetail,
} from "@vera/contract/plugins";
import type { Session } from "@vera/domain/entities";
import { hasPermission } from "@vera/domain/permissions";
import type { ReactNode } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { enablePluginInstance, runPluginInstance } from "@/api/plugins";
import type { ViewAction } from "@/components/actions/action-bar";
import { FilterBar } from "@/components/filters/filter-bar";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { NoticeLine } from "@/components/notice-line";
import { TableWithDrawer } from "@/components/table-with-drawer";
import type { PluginDialog, PluginNotice } from "@/features/plugins/plugin-acts";
import {
  headerActionsFor,
  implementationActionsFor,
  instanceActionsFor,
  PluginDialogView,
} from "@/features/plugins/plugin-acts";
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
import { RunOverlayLink } from "@/features/tasks/run-overlay-link";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useRequestCustodiesQuery, useRolesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { plural } from "@/lib/plural";

export function PluginsPage() {
  const [params, setParams] = useSearchParams();
  const { data: index } = usePluginsQuery();
  const { data: session } = useSessionQuery();
  const [notice, setNotice] = useState<PluginNotice | null>(null);
  const [dialog, setDialog] = useState<PluginDialog | null>(null);
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
      <PageHeader title="Plugins" actions={headerActionsFor(session, setDialog)} />
      <FilterBar
        fields={pluginsView.fields}
        query={query}
        facets={index === undefined ? undefined : pluginFacetsOf(index, query)}
        onQueryChange={setQuery}
        searchLabel="Search plugins and instances"
        searchPlaceholder="Search plugins and instances…"
      />
      <PageContent isFlushVertical className="@container">
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
            onDialog={setDialog}
          />
        )}
      </PageContent>
      {dialog !== null && index !== undefined && (
        <PluginDialogView
          dialog={dialog}
          index={index}
          onClose={() => setDialog(null)}
          onDone={(next, opened) => {
            setNotice(next);
            setDialog(null);
            if (opened?.instanceId !== undefined) {
              open(instanceParam, opened.instanceId);
            } else if (opened?.implementationId !== undefined) {
              open(implementationParam, opened.implementationId);
            }
          }}
        />
      )}
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
  onDialog: (dialog: PluginDialog) => void;
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
  onDialog,
}: PluginTableProps) {
  const labels = useReferenceLabels(["users", "categories"]);
  const { data: roles = [] } = useRolesQuery();
  const { data: custodies = [] } = useRequestCustodiesQuery();
  const shown = shownPluginsOf(index, query);
  const isFiltered = !pluginsView.isSameQuery(query, {});
  const groups = useInstanceGroups({
    shown,
    isFiltered: (query.states ?? []).length > 0,
    onNewInstance: hasPermission(session, "plugin.configure")
      ? (implementation) => onDialog({ kind: "newInstance", implementationId: implementation.id })
      : undefined,
  });
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
  const enable = useActionMutation({
    call: enablePluginInstance,
    invalidates: pluginInvalidations,
    refusalTexts: { "plugin.contract": "Its version was built for a contract VERA does not run." },
  });
  const implementationOf = (instance: PluginInstanceDetail) =>
    index.implementations.find((candidate) => candidate.id === instance.implementationId);
  const custodyOf = (custodyId: string) =>
    custodies.find((custody) => custody.id === custodyId)?.name;
  const names: DrawerNames = {
    userOf: labels.users,
    categoryOf: labels.categories,
    roleOf: (roleId) => roles.find((role) => role.id === roleId)?.name ?? roleId,
    custodyOf,
  };
  const reach = {
    canSeeTasks,
    canSeeAccess: hasPermission(session, "access.read"),
    canSeeHooks: hasPermission(session, "hook.read"),
  };

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

  const enableNow = async (instance: PluginInstanceDetail) => {
    const result = await enable.run(instance.id);
    onNotice(
      result.isDone
        ? {
            title: `${instance.name} enabled`,
            text: "It runs from its next trigger.",
            tone: "green",
          }
        : { title: `${instance.name} stays disabled`, text: result.refusal.message, tone: "red" },
    );
  };

  const instanceActions = (
    instance: PluginInstanceDetail,
    implementation: PluginImplementation,
  ): ViewAction[] =>
    instanceActionsFor(session, instance, implementation, {
      open: onDialog,
      onRun: () => void runNow(instance),
      onEnable: () => void enableNow(instance),
    });

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
            <RunOverlayLink
              runId={notice.runId}
              className="text-primary underline-offset-2 hover:underline"
            >
              Open the run
            </RunOverlayLink>
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
    implementationActions: (implementation) =>
      implementationActionsFor(session, implementation, onDialog),
    onOpenInstance,
    onOpenImplementation,
    notice: noticeLine,
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
          {selection === null && noticeLine !== null && <div className="pt-4">{noticeLine}</div>}
          {isFiltered && shown.instances.length > 0 && (
            <p className="py-3 text-xs text-muted-foreground">
              {plural(shown.instances.length, "matching instance")}
            </p>
          )}
        </>
      }
      table={{
        flush: true,
        rows: shown.instances,
        rowId: (instance) => instance.id,
        columns: instanceColumns({
          asOf: index.asOf,
          implementationOf,
          categoryOf: labels.categories,
          custodyOf,
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
  reach: { canSeeTasks: boolean; canSeeAccess: boolean; canSeeHooks: boolean };
  asOf: string;
  instanceActions: (
    instance: PluginInstanceDetail,
    implementation: PluginImplementation,
  ) => ViewAction[];
  implementationActions: (implementation: PluginImplementation) => ViewAction[];
  // What was just done: in the open drawer, which covers the page on a phone.
  notice: ReactNode;
  onOpenInstance: (instanceId: string) => void;
  onOpenImplementation: (implementationId: string) => void;
}

function drawerOf(selection: PluginSelection | null, options: DrawerOptions) {
  if (selection === null) {
    return { title: "", subtitle: undefined, body: null };
  }

  const {
    index,
    names,
    reach,
    asOf,
    instanceActions,
    implementationActions,
    onOpenInstance,
    onOpenImplementation,
    notice,
  } = options;
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
          actions={implementationActions(implementation)}
          notice={notice}
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
        actions={instanceActions(instance, implementation)}
        notice={notice}
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
