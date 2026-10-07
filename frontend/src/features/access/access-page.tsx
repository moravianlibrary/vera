// Users & Groups (view-catalog.md *Users & Groups*; docs/demos/shared/page-access.js): one view,
// three linked columns with the user in the middle, Roles · Users · Groups and proposal
// custodies, since these are separate things and the page exists to show how they meet. The
// left answers what a person may do, the right what they are responsible for. Selecting any
// record lights up what it is connected to, draws the links, and opens it underneath. The search
// and *Show* narrow the columns. A phone switches between the columns with tabs.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import type { AccessIndex } from "@/api/access";
import { ActionBar } from "@/components/actions/action-bar";
import { FilterBar } from "@/components/filters/filter-bar";
import { viewLabels } from "@/components/filters/share-watchlist-dialog";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { LinkedItem, LinkedSection } from "@/components/linked-columns";
import { LinkedColumns } from "@/components/linked-columns";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { custodyMembersOf, heldRoleIdsOf, holdersOf } from "@/domain/access";
import type { WatchlistAudience } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import type { AccessDialog } from "@/features/access/access-acts";
import {
  AccessDialogView,
  headerActionsFor,
  recordActionsFor,
} from "@/features/access/access-acts";
import type { AccessNotice } from "@/features/access/access-dialogs";
import { linksOf } from "@/features/access/access-links";
import type { AccessNames } from "@/features/access/access-records";
import {
  AgentBadge,
  CustodyRecordView,
  GroupRecord,
  namesOf,
  RoleRecord,
  SharedWatchlistRecord,
  UserRecord,
} from "@/features/access/access-records";
import type {
  AccessQuery,
  AccessSelection,
  AccessSelectionKind,
} from "@/features/access/access-view";
import {
  accessView,
  filteredIndex,
  selectionOf,
  selectionParams,
  showFacetsOf,
} from "@/features/access/access-view";
import { useAccessQuery } from "@/features/access/use-access-query";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useSessionQuery } from "@/hooks/use-session-query";
import { plural } from "@/lib/plural";

export function AccessPage() {
  const [params, setParams] = useSearchParams();
  const { data: index } = useAccessQuery();
  const { data: session } = useSessionQuery();
  const [dialog, setDialog] = useState<AccessDialog | null>(null);
  const [notice, setNotice] = useState<AccessNotice | null>(null);
  const selection = index === undefined ? null : selectionOf(params, index);
  const may = {
    canManageAccess: session !== undefined && hasPermission(session, "access.manage"),
    canManageShared: session !== undefined && hasPermission(session, "watchlist.manage_shared"),
  };
  const recordActions =
    index === undefined || selection === null
      ? []
      : recordActionsFor(index, selection, setDialog, may);
  const labels = useReferenceLabels(["categories", "pluginInstances"]);
  const query = accessView.parseSearchParams(params);

  // The filter is replaced and the selection kept, as in every view.
  const setQuery = (next: AccessQuery) => {
    const nextParams = accessView.toSearchParams(next);
    for (const name of Object.values(selectionParams)) {
      const value = params.get(name);
      if (value !== null) {
        nextParams.set(name, value);
      }
    }

    setParams(nextParams, { replace: true });
  };

  const select = ({ kind, id }: AccessSelection) => {
    const next = new URLSearchParams(params);
    for (const name of Object.values(selectionParams)) {
      next.delete(name);
    }

    next.set(selectionParams[kind], id);
    setParams(next, { replace: true });
  };

  const names =
    index === undefined
      ? null
      : namesOf(index, { categoryOf: labels.categories, instanceOf: labels.pluginInstances });

  return (
    <>
      <PageHeader
        title="Users & Groups"
        actions={may.canManageAccess ? headerActionsFor(setDialog) : []}
      />
      <FilterBar
        fields={accessView.fields}
        query={query}
        facets={index === undefined ? undefined : showFacetsOf(index, query)}
        onQueryChange={setQuery}
        searchLabel="Search users, roles, groups and custodies"
        searchPlaceholder="Search people, roles, groups, custodies…"
      />
      <PageContent>
        {index !== undefined && (
          <AccessColumns
            index={index}
            shown={filteredIndex(index, query)}
            names={names}
            selection={selection}
            onSelect={select}
            onShowWithoutRole={() => setQuery({ ...query, show: ["none"] })}
            notice={
              notice === null ? undefined : (
                <NoticeLine notice={notice} onDismiss={() => setNotice(null)} />
              )
            }
            recordActions={
              recordActions.length === 0 ? undefined : <ActionBar actions={recordActions} />
            }
          />
        )}
      </PageContent>
      {dialog !== null && index !== undefined && names !== null && (
        <AccessDialogView
          dialog={dialog}
          index={index}
          names={names}
          onClose={() => setDialog(null)}
          onDone={(next, selected) => {
            setNotice(next);
            setDialog(null);
            if (selected !== undefined) {
              select(selected);
            }

            // The record, with what was done said above it, comes into view.
            requestAnimationFrame(() =>
              document.getElementById(recordAnchor)?.scrollIntoView({ block: "start" }),
            );
          }}
        />
      )}
    </>
  );
}

interface AccessColumnsProps {
  index: AccessIndex;
  // What the search and Show leave in the columns; the record reads the whole index.
  shown: AccessIndex;
  names: AccessNames | null;
  selection: AccessSelection | null;
  onSelect: (selection: AccessSelection) => void;
  onShowWithoutRole: () => void;
  // What was just done, said above the record.
  notice?: ReactNode;
  // What may be done to the selected record; absent without access.manage.
  recordActions?: ReactNode;
}

function AccessColumns({
  index,
  shown,
  names,
  selection,
  onSelect,
  onShowWithoutRole,
  notice,
  recordActions,
}: AccessColumnsProps) {
  if (selection === null || names === null) {
    return <p className="text-sm text-muted-foreground">Nobody here yet.</p>;
  }

  const { tags, lines } = linksOf(index, selection);
  const sections = sectionsOf(index, shown, names);
  const recordProps = { index, names, onSelect, actions: recordActions };
  const record = (() => {
    switch (selection.kind) {
      case "users": {
        const user = index.users.find((candidate) => candidate.id === selection.id);
        return user === undefined ? null : <UserRecord {...recordProps} user={user} />;
      }
      case "roles": {
        const role = index.roles.find((candidate) => candidate.id === selection.id);
        return role === undefined ? null : <RoleRecord {...recordProps} role={role} />;
      }
      case "groups": {
        const group = index.groups.find((candidate) => candidate.id === selection.id);
        return group === undefined ? null : <GroupRecord {...recordProps} group={group} />;
      }
      case "custodies": {
        const custody = index.custodies.find((candidate) => candidate.id === selection.id);
        return custody === undefined ? null : (
          <CustodyRecordView {...recordProps} custody={custody} />
        );
      }
      case "watchlists": {
        const watchlist = index.sharedWatchlists.find((candidate) => candidate.id === selection.id);
        return watchlist === undefined ? null : (
          <SharedWatchlistRecord {...recordProps} watchlist={watchlist} />
        );
      }
    }
  })();

  return (
    <>
      <Counts index={index} onShowWithoutRole={onShowWithoutRole} />
      <LinkedColumns
        columns={[
          [sections.roles],
          [sections.users],
          [sections.groups, sections.custodies, sections.watchlists],
        ]}
        tabOrder={["users", "roles", "groups", "custodies", "watchlists"]}
        selected={selection}
        tags={tags}
        lines={lines}
        onSelect={onSelect}
        record={
          <div id={recordAnchor} className="scroll-mt-4">
            {notice}
            {record}
          </div>
        }
      />
    </>
  );
}

const recordAnchor = "access-record";

function NoticeLine({ notice, onDismiss }: { notice: AccessNotice; onDismiss: () => void }) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <StatusNote tone="green" title={notice.title} className="flex-1">
        {notice.text}
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

// "10 people · 2 agents · 5 roles · 3 groups · 4 custodies · 1 with no role yet".
function Counts({
  index,
  onShowWithoutRole,
}: {
  index: AccessIndex;
  onShowWithoutRole: () => void;
  // What was just done, said above the record.
  notice?: ReactNode;
  // What may be done to the selected record; absent without access.manage.
  recordActions?: ReactNode;
}) {
  const agentCount = index.users.filter((user) => user.kind === "agent").length;
  const withoutRoleCount = index.users.filter((user) => heldRoleIdsOf(user).length === 0).length;
  return (
    <p className="mb-4 text-xs text-muted-foreground">
      {plural(index.users.length - agentCount, "person", "people")} · {plural(agentCount, "agent")}{" "}
      · {plural(index.roles.length, "role")} · {plural(index.groups.length, "group")} ·{" "}
      {plural(index.custodies.length, "custody", "custodies")}
      {withoutRoleCount > 0 && (
        <>
          {" · "}
          <button
            type="button"
            className="text-tone-amber-foreground underline underline-offset-2"
            onClick={onShowWithoutRole}
          >
            {withoutRoleCount} with no role yet
          </button>
        </>
      )}
    </p>
  );
}

const smallBadge = "px-1.5 py-0 text-[0.625rem]";

function sectionsOf(index: AccessIndex, shown: AccessIndex, names: AccessNames) {
  const roles: LinkedSection<AccessSelectionKind> = {
    kind: "roles",
    title: "Roles",
    tabTitle: "Roles",
    emptyText: "No role matches.",
    items: shown.roles.map(
      (role): LinkedItem => ({
        id: role.id,
        title: role.name,
        badge: role.isShipped ? undefined : (
          <ToneBadge tone="blue" className={smallBadge}>
            custom
          </ToneBadge>
        ),
        sub: `${plural(role.grants.length, "grant")} · ${plural(holdersOf(index.users, role.id).length, "person", "people")}`,
      }),
    ),
  };
  const users: LinkedSection<AccessSelectionKind> = {
    kind: "users",
    title: "Users",
    tabTitle: "Users",
    emptyText: "Nobody matches.",
    items: shown.users.map((user): LinkedItem => {
      const roleIds = heldRoleIdsOf(user);
      return {
        id: user.id,
        title: user.name,
        badge: user.kind === "agent" ? <AgentBadge /> : undefined,
        sub:
          roleIds.length === 0 ? (
            <span className="text-tone-amber-foreground">no role yet: sees nothing</span>
          ) : (
            roleIds.map(names.role).join(", ")
          ),
      };
    }),
  };
  const groups: LinkedSection<AccessSelectionKind> = {
    kind: "groups",
    title: "Groups",
    tabTitle: "Groups",
    emptyText: "No group matches.",
    items: shown.groups.map((group) => ({
      id: group.id,
      title: group.name,
      sub: plural(group.memberIds.length, "member"),
    })),
  };
  const custodies: LinkedSection<AccessSelectionKind> = {
    kind: "custodies",
    title: "Proposal custodies",
    tabTitle: "Custodies",
    emptyText: "No custody matches.",
    items: shown.custodies.map((custody) => ({
      id: custody.id,
      title: custody.name,
      badge: custody.isFallback ? (
        <ToneBadge tone="amber" className={smallBadge}>
          fallback
        </ToneBadge>
      ) : undefined,
      sub: `${plural(custody.openCount, "open proposal")} · ${plural(custodyMembersOf(custody, index.groups).length, "person", "people")}`,
    })),
  };
  const watchlists: LinkedSection<AccessSelectionKind> = {
    kind: "watchlists",
    title: "Shared watchlists",
    tabTitle: "Watchlists",
    emptyText: "No shared watchlist matches.",
    items: shown.sharedWatchlists.map((watchlist) => ({
      id: watchlist.id,
      title: watchlist.name,
      sub: `${viewLabels[watchlist.view]} · ${audienceText(watchlist.audience)} · ${plural(watchlist.reachedUserIds.length, "person", "people")}`,
    })),
  };
  return { roles, users, groups, custodies, watchlists };
}

function audienceText(audience: WatchlistAudience): string {
  switch (audience.kind) {
    case "personal":
      return "personal";
    case "everyone":
      return "everyone";
    case "some":
      return plural(
        audience.groupIds.length + audience.roleIds.length,
        "group or role",
        "groups and roles",
      );
  }
}
