// Users & Groups (view-catalog.md *Users & Groups*; docs/demos/shared/page-access.js): one view,
// three linked columns with the user in the middle, Roles · Users · Groups and proposal
// custodies, since these are separate things and the page exists to show how they meet. The
// left answers what a person may do, the right what they are responsible for. Selecting any
// record lights up what it is connected to, draws the links, and opens it underneath. The search
// and *Show* narrow the columns. A phone switches between the columns with tabs.
// TODO(rrandiak): labels move to i18n.

import { useSearchParams } from "react-router";
import type { AccessIndex } from "@/api/access";
import type { AccessRecordKind } from "@/api/routes";
import { FilterBar } from "@/components/filters/filter-bar";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { LinkedItem, LinkedSection } from "@/components/linked-columns";
import { LinkedColumns } from "@/components/linked-columns";
import { ToneBadge } from "@/components/status-badge";
import { custodyMembersOf, heldRoleIdsOf, holdersOf } from "@/domain/access";
import { linksOf } from "@/features/access/access-links";
import type { AccessNames } from "@/features/access/access-records";
import {
  AgentBadge,
  CustodyRecordView,
  GroupRecord,
  namesOf,
  RoleRecord,
  UserRecord,
} from "@/features/access/access-records";
import type { AccessQuery, AccessSelection } from "@/features/access/access-view";
import {
  accessView,
  filteredIndex,
  selectionOf,
  selectionParams,
  showFacetsOf,
} from "@/features/access/access-view";
import { useAccessQuery } from "@/features/access/use-access-query";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { plural } from "@/lib/plural";

export function AccessPage() {
  const [params, setParams] = useSearchParams();
  const { data: index } = useAccessQuery();
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

  return (
    <>
      <PageHeader title="Users & Groups" />
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
            names={namesOf(index, {
              categoryOf: labels.categories,
              instanceOf: labels.pluginInstances,
            })}
            selection={selectionOf(params, index)}
            onSelect={select}
            onShowWithoutRole={() => setQuery({ ...query, show: ["none"] })}
          />
        )}
      </PageContent>
    </>
  );
}

interface AccessColumnsProps {
  index: AccessIndex;
  // What the search and Show leave in the columns; the record reads the whole index.
  shown: AccessIndex;
  names: AccessNames;
  selection: AccessSelection | null;
  onSelect: (selection: AccessSelection) => void;
  onShowWithoutRole: () => void;
}

function AccessColumns({
  index,
  shown,
  names,
  selection,
  onSelect,
  onShowWithoutRole,
}: AccessColumnsProps) {
  if (selection === null) {
    return <p className="text-sm text-muted-foreground">Nobody here yet.</p>;
  }

  const { tags, lines } = linksOf(index, selection);
  const sections = sectionsOf(index, shown, names);
  const recordProps = { index, names, onSelect };
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
    }
  })();

  return (
    <>
      <Counts index={index} onShowWithoutRole={onShowWithoutRole} />
      <LinkedColumns
        columns={[[sections.roles], [sections.users], [sections.groups, sections.custodies]]}
        tabOrder={["users", "roles", "groups", "custodies"]}
        selected={selection}
        tags={tags}
        lines={lines}
        onSelect={onSelect}
        record={record}
      />
    </>
  );
}

// "10 people · 2 agents · 5 roles · 3 groups · 4 custodies · 1 with no role yet".
function Counts({
  index,
  onShowWithoutRole,
}: {
  index: AccessIndex;
  onShowWithoutRole: () => void;
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
  const roles: LinkedSection<AccessRecordKind> = {
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
  const users: LinkedSection<AccessRecordKind> = {
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
  const groups: LinkedSection<AccessRecordKind> = {
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
  const custodies: LinkedSection<AccessRecordKind> = {
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
  return { roles, users, groups, custodies };
}
