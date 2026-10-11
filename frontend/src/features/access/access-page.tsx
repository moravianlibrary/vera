import { useState } from "react";
import { useSearchParams } from "react-router";
import type { AccessIndex } from "@/api/access";
import { ActionBar } from "@/components/actions/action-bar";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filters/filter-bar";
import { TabButton, TabStrip } from "@/components/filters/tab-strip";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { NoticeLine } from "@/components/notice-line";
import { Button } from "@/components/ui/button";
import {
  categoryCustodyOf,
  heldRoleIdsOf,
  holdersOf,
  projectsOf,
  proposalCustodyOf,
} from "@/domain/access";
import { hasPermission } from "@/domain/permissions";
import type { AccessDialog } from "@/features/access/access-acts";
import {
  AccessDialogView,
  headerActionsFor,
  recordActionsFor,
} from "@/features/access/access-acts";
import type { AccessNotice } from "@/features/access/access-dialogs";
import { CategoryAccessDetail } from "@/features/access/access-management-detail";
import {
  AgentBadge,
  CustodyRecordView,
  GroupRecord,
  namesOf,
  RoleRecord,
  UserRecord,
} from "@/features/access/access-records";
import { AccessRelationships } from "@/features/access/access-relationships";
import { categoryPath, categorySourcesOf, uniquePeople } from "@/features/access/access-resources";
import type { AccessQuery, AccessSelection } from "@/features/access/access-view";
import {
  accessView,
  selectionParams,
  userShowLabels,
  userShows,
} from "@/features/access/access-view";
import { useAccessQuery } from "@/features/access/use-access-query";
import { useLoadMore } from "@/hooks/use-load-more";
import { usePluginInstancesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import type { ListFieldDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

type View = "users" | "roles" | "groups" | "custodies";
type CustodyType = "proposals" | "categories";
type Selected = AccessSelection | { kind: "categories"; id: string };
type Row = {
  id: string;
  title: string;
  secondary: string;
  third: string;
  groups?: string;
  placement?: string;
  access: string;
  kind: Selected["kind"];
};
const views: View[] = ["users", "roles", "groups", "custodies"];
const loadSize = 25;

function selectionFrom(params: URLSearchParams): Selected | null {
  for (const [kind, key] of Object.entries({
    users: "u",
    roles: "r",
    groups: "g",
    custodies: "c",
    categories: "category",
  })) {
    const id = params.get(key);
    if (id) return { kind: kind as Selected["kind"], id };
  }
  return null;
}

function viewOf(params: URLSearchParams, selected: Selected | null): View {
  if (selected?.kind === "roles") return "roles";
  if (selected?.kind === "groups") return "groups";
  if (["custodies", "categories"].includes(selected?.kind ?? "")) return "custodies";
  if (selected?.kind === "users") return "users";
  const explicit = params.get("view");
  if (views.includes(explicit as View)) return explicit as View;
  return "users";
}

function rowsOf(
  index: AccessIndex,
  view: View,
  type: CustodyType,
  pluginNames: (id: string) => string,
): Row[] {
  if (view === "users")
    return index.users.map((user) => ({
      id: user.id,
      kind: "users",
      title: user.name,
      secondary: user.email || user.entry || "—",
      third:
        heldRoleIdsOf(user)
          .map((id) => index.roles.find((role) => role.id === id)?.name ?? id)
          .join(", ") || "—",
      groups:
        user.groupIds
          .map((id) => index.groups.find((group) => group.id === id)?.name ?? id)
          .join(", ") || "—",
      access: [
        `${new Set(projectsOf(user.id, index.groups, index.projects).map((entry) => entry.projectId)).size} projects`,
        `${new Set(proposalCustodyOf(user.id, index.groups, index.custodies).map((entry) => entry.custodyId)).size} proposal sets`,
        `${new Set(categoryCustodyOf(user.id, index.groups, index.categoryMemberships).map((entry) => entry.categoryId)).size} categories`,
      ].join(" · "),
    }));
  if (view === "roles")
    return index.roles.map((role) => ({
      id: role.id,
      kind: "roles",
      title: role.name,
      secondary: role.description,
      third: `${role.grants.length} grants`,
      access: `${holdersOf(index.users, role.id).length} holders${role.isShipped ? " · Shipped" : ""}`,
    }));
  if (view === "groups")
    return index.groups.map((group) => ({
      id: group.id,
      kind: "groups",
      title: group.name,
      secondary: group.description,
      third: `${group.memberIds.length} members`,
      access: `${index.custodies.filter((custody) => custody.groupIds.includes(group.id)).length} proposal sets · ${group.categoryIds.length} categories · ${index.projects.filter((project) => project.memberGroupIds.includes(group.id)).length} projects`,
    }));
  if (type === "proposals")
    return index.custodies.map((custody) => ({
      id: custody.id,
      kind: "custodies",
      title: custody.name,
      secondary: custody.description,
      third: `${custody.memberIds.length} direct · ${custody.groupIds.length} groups`,
      placement: custody.isFallback
        ? "Fallback"
        : custody.placedByIds.map(pluginNames).join(", ") || "No rule names it",
      access: `${custody.openCount} open proposals${custody.isFallback ? " · Fallback" : ""}`,
    }));
  return index.categories.map((category) => ({
    id: category.id,
    kind: "categories",
    title: categoryPath(index, category.id),
    secondary: "",
    third: `${categorySourcesOf(index, category.id).filter((source) => source.viaGroupId === null).length} direct · ${new Set(categorySourcesOf(index, category.id).flatMap((source) => source.viaGroupId ?? [])).size} groups`,
    access: `${uniquePeople(categorySourcesOf(index, category.id)).length} people`,
  }));
}

function matches(row: Row, query: AccessQuery, index: AccessIndex): boolean {
  const search = query.search?.trim().toLowerCase();
  if (
    search &&
    ![row.title, row.secondary, row.third, row.placement ?? "", row.access, row.id].some((part) =>
      part.toLowerCase().includes(search),
    )
  )
    return false;
  if (row.kind === "users") {
    const user = index.users.find((candidate) => candidate.id === row.id);
    if (!user) return false;
    const shows = [user.kind, ...(heldRoleIdsOf(user).length === 0 ? ["none"] : [])];
    if (query.show?.length && !query.show.some((value) => shows.includes(value))) return false;
    if (query.roleIds?.length && !query.roleIds.some((id) => heldRoleIdsOf(user).includes(id)))
      return false;
    if (query.groupIds?.length && !query.groupIds.some((id) => user.groupIds.includes(id)))
      return false;
    if (
      query.projectIds?.length &&
      !query.projectIds.some((id) =>
        projectsOf(user.id, index.groups, index.projects).some((entry) => entry.projectId === id),
      )
    )
      return false;
    if (
      query.custodyIds?.length &&
      !query.custodyIds.some((id) =>
        proposalCustodyOf(user.id, index.groups, index.custodies).some(
          (entry) => entry.custodyId === id,
        ),
      )
    )
      return false;
    if (
      query.categoryIds?.length &&
      !query.categoryIds.some((id) =>
        categorySourcesOf(index, id).some((source) => source.userId === user.id),
      )
    )
      return false;
  }
  if (row.kind === "custodies" || row.kind === "categories") {
    const custody = index.custodies.find((item) => item.id === row.id);
    const sources =
      row.kind === "custodies"
        ? custody === undefined
          ? []
          : [
              ...custody.memberIds.map((userId) => ({ userId, viaGroupId: null })),
              ...index.groups
                .filter((group) => custody.groupIds.includes(group.id))
                .flatMap((group) =>
                  group.memberIds.map((userId) => ({ userId, viaGroupId: group.id })),
                ),
            ]
        : categorySourcesOf(index, row.id);
    if (
      query.sources?.length &&
      !query.sources.some((source) =>
        source === "none"
          ? sources.length === 0
          : sources.some((item) =>
              source === "direct" ? item.viaGroupId === null : item.viaGroupId !== null,
            ),
      )
    )
      return false;
    if (
      row.kind === "custodies" &&
      query.pluginIds?.length &&
      !query.pluginIds.some((id) => custody?.placedByIds.includes(id))
    )
      return false;
  }
  return true;
}

function fieldsFor(
  index: AccessIndex,
  view: View,
  type: CustodyType,
  pluginInstances: readonly { id: string; name: string }[],
) {
  const field = (
    key: ListFieldDefinition<AccessQuery>["key"],
    label: string,
    records: readonly { id: string; name: string }[],
  ): ListFieldDefinition<AccessQuery> => ({
    key,
    label,
    field: vocabulary(
      records.map((record) => record.id),
      Object.fromEntries(records.map((record) => [record.id, record.name])),
    ),
  });
  if (view === "users")
    return [
      {
        key: "show" as const,
        label: "Show",
        field: vocabulary(userShows, userShowLabels),
        isQuick: true,
      },
      field("roleIds", "Role", index.roles),
      field("groupIds", "Group", index.groups),
      field("projectIds", "Project", index.projects),
      field("custodyIds", "Proposal custody", index.custodies),
      field("categoryIds", "Category custody", index.categories),
    ];
  if (view === "custodies")
    return [
      {
        key: "sources" as const,
        label: "Custodians",
        field: vocabulary(["direct", "group", "none"], {
          direct: "Direct",
          group: "Via group",
          none: "None",
        }),
        isQuick: true,
      },
      ...(type === "proposals" ? [field("pluginIds", "Custody plugin", pluginInstances)] : []),
    ];
  return [];
}

export function AccessPage() {
  const [params, setParams] = useSearchParams();
  const { data: index } = useAccessQuery();
  const { data: session } = useSessionQuery();
  const { data: pluginInstances = [] } = usePluginInstancesQuery();
  const [dialog, setDialog] = useState<AccessDialog | null>(null);
  const [notice, setNotice] = useState<AccessNotice | null>(null);
  const [exploring, setExploring] = useState(false);
  const [savedFilters, setSavedFilters] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState({ key: "", count: loadSize });
  const selected = selectionFrom(params);
  const view = viewOf(params, selected);
  const type: CustodyType =
    params.get("type") === "categories" || selected?.kind === "categories"
      ? "categories"
      : "proposals";
  const query = accessView.parseSearchParams(params);
  const listKey = `${view}:${type}:${accessView.toSearchParams(query).toString()}`;
  const loadedCount = loaded.key === listKey ? loaded.count : loadSize;
  const names =
    index &&
    namesOf(index, {
      categoryOf: (id) => categoryPath(index, id),
      instanceOf: (id) => pluginInstances.find((item) => item.id === id)?.name ?? id,
    });
  const pluginName = (id: string) => pluginInstances.find((item) => item.id === id)?.name ?? id;
  const allRows = index ? rowsOf(index, view, type, pluginName) : [];
  const visible = index ? allRows.filter((row) => matches(row, query, index)) : [];
  const shown = visible.slice(0, loadedCount);
  const sentinelRef = useLoadMore(
    shown.length < visible.length,
    false,
    () => setLoaded({ key: listKey, count: loadedCount + loadSize }),
    `${listKey}:${shown.length}`,
  );
  const selectedRow =
    selected && index
      ? allRows.find((row) => row.id === selected.id && row.kind === selected.kind)
      : undefined;
  const canManage = session ? hasPermission(session, "access.manage") : false;
  const setQuery = (next: AccessQuery) => {
    const changed = new URLSearchParams(params);
    for (const key of [
      "q",
      "show",
      "role",
      "group",
      "project",
      "custody",
      "plugin",
      "categoryCustody",
      "source",
    ])
      changed.delete(key);
    accessView.toSearchParams(next).forEach((value, key) => {
      changed.set(key, value);
    });
    changed.delete("page");
    setParams(changed, { replace: true });
  };
  const open = (choice: Selected | null) => {
    const targetView =
      choice?.kind === "roles"
        ? "roles"
        : choice?.kind === "groups"
          ? "groups"
          : choice?.kind === "custodies" || choice?.kind === "categories"
            ? "custodies"
            : "users";
    const targetType = choice?.kind === "categories" ? "categories" : "proposals";
    const targetKey = `${targetView}:${targetType}`;
    const currentKey = `${view}:${type}`;
    if (choice && targetView !== view) {
      setSavedFilters((old) => ({
        ...old,
        [currentKey]: accessView.toSearchParams(query).toString(),
      }));
    }
    const next =
      choice && targetView !== view
        ? new URLSearchParams(savedFilters[targetKey] ?? "")
        : new URLSearchParams(params);
    next.delete("page");
    for (const key of Object.values({
      ...selectionParams,
      categories: "category",
    }))
      next.delete(key);
    if (choice) {
      const key = ({ ...selectionParams, categories: "category" } as Record<string, string>)[
        choice.kind
      ];
      next.set(key, choice.id);
      next.set(
        "view",
        choice.kind === "users"
          ? "users"
          : choice.kind === "roles"
            ? "roles"
            : choice.kind === "groups"
              ? "groups"
              : "custodies",
      );
      if (choice.kind === "custodies") next.set("type", "proposals");
      if (choice.kind === "categories") next.set("type", "categories");
      next.delete("sets");
    }
    setExploring(false);
    setParams(next, { replace: true });
  };
  const changeView = (nextView: View, nextType: CustodyType = type) => {
    const currentKey = `${view}:${type}`;
    const nextKey = `${nextView}:${nextType}`;
    setSavedFilters((old) => ({
      ...old,
      [currentKey]: accessView.toSearchParams(query).toString(),
    }));
    const next = new URLSearchParams(savedFilters[nextKey] ?? "");
    next.delete("page");
    if (nextView !== "users") next.set("view", nextView);
    if (nextView === "custodies") next.set("type", nextType);
    setExploring(false);
    setParams(next);
  };
  const fields = index
    ? fieldsFor(
        index,
        view,
        type,
        pluginInstances.filter((instance) =>
          index.custodies.some((custody) => custody.placedByIds.includes(instance.id)),
        ),
      )
    : [];
  const facets = index
    ? Object.fromEntries(
        fields.map(({ key, field }) => [
          key,
          field.kind === "vocabulary"
            ? field.values.map((value) => ({
                value,
                count: allRows.filter((row) => matches(row, { ...query, [key]: [value] }, index))
                  .length,
              }))
            : [],
        ]),
      )
    : {};
  const selectedUser =
    selected?.kind === "users" ? index?.users.find((user) => user.id === selected.id) : undefined;
  const selectedRole =
    selected?.kind === "roles" ? index?.roles.find((role) => role.id === selected.id) : undefined;
  const selectedGroup =
    selected?.kind === "groups"
      ? index?.groups.find((group) => group.id === selected.id)
      : undefined;
  const selectedCustody =
    selected?.kind === "custodies"
      ? index?.custodies.find((custody) => custody.id === selected.id)
      : undefined;
  const columns: ColumnDefinition<Row>[] = [
    {
      key: "name",
      header:
        view === "users"
          ? "USER"
          : view === "roles"
            ? "ROLE"
            : view === "groups"
              ? "GROUP"
              : type === "proposals"
                ? "PROPOSAL CUSTODY SET"
                : "CATEGORY",
      track: "minmax(14rem,2fr)",
      cell: (row) => (
        <div>
          <span className="font-medium">{row.title}</span>
          {row.kind === "users" &&
            index?.users.find((user) => user.id === row.id)?.kind === "agent" && (
              <>
                {" "}
                <AgentBadge />
              </>
            )}
          <p className="text-xs text-muted-foreground">{row.secondary}</p>
        </div>
      ),
    },
    {
      key: "third",
      header:
        view === "users"
          ? "ROLES"
          : view === "roles"
            ? "GRANTS"
            : view === "groups"
              ? "MEMBERS"
              : "MEMBERSHIP",
      track: "minmax(8rem,1fr)",
      cell: (row) => row.third,
    },
    ...(view === "users"
      ? [
          {
            key: "groups",
            header: "GROUPS",
            track: "minmax(8rem,1fr)",
            cell: (row: Row) => row.groups ?? "—",
          },
        ]
      : []),
    ...(view === "custodies" && type === "proposals"
      ? [
          {
            key: "placement",
            header: "CUSTODY PLUGINS",
            track: "minmax(9rem,1fr)",
            cell: (row: Row) => row.placement ?? "—",
          },
        ]
      : []),
    {
      key: "access",
      header: view === "users" ? "RESOURCE ACCESS" : "ACCESS",
      track: "minmax(11rem,1fr)",
      cell: (row) => row.access,
    },
  ];
  const detailActions =
    selectedRow && selected && selected.kind !== "categories" && index
      ? recordActionsFor(index, selected as AccessSelection, setDialog, {
          canManageAccess: canManage,
          canManageShared: false,
        })
      : [];
  const detail =
    selectedRow && selected && index && names ? (
      exploring ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => setExploring(false)}>
            Back to details
          </Button>
          <h2 className="mt-4 text-base font-semibold">{selectedRow?.title ?? selected.id}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Immediate relationships</p>
          {selected.kind !== "watchlists" && (
            <div className="mt-4">
              <AccessRelationships
                index={index}
                names={names}
                selected={{ kind: selected.kind, id: selected.id }}
                onSelect={open}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setExploring(true)}>
              Explore relationships
            </Button>
            <ActionBar actions={detailActions} cap={1} menuLabel="More" />
          </div>
          {selectedUser && (
            <UserRecord index={index} names={names} onSelect={open} user={selectedUser} />
          )}
          {selectedRole && (
            <RoleRecord index={index} names={names} onSelect={open} role={selectedRole} />
          )}
          {selectedGroup && (
            <GroupRecord index={index} names={names} onSelect={open} group={selectedGroup} />
          )}
          {selectedCustody && (
            <CustodyRecordView
              index={index}
              names={names}
              onSelect={open}
              custody={selectedCustody}
            />
          )}
          {selected.kind === "categories" && (
            <CategoryAccessDetail
              index={index}
              names={names}
              onSelect={open}
              categoryId={selected.id}
            />
          )}
        </>
      )
    ) : (
      <p className="text-sm text-muted-foreground">This record is no longer available.</p>
    );
  if (!session) return null;
  return (
    <>
      <PageHeader title="Users management" actions={canManage ? headerActionsFor(setDialog) : []} />
      <TabStrip label="Users management views">
        {views.map((item) => (
          <TabButton key={item} selected={view === item} onClick={() => changeView(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </TabButton>
        ))}
      </TabStrip>
      {view === "custodies" && (
        <TabStrip label="Custody resources">
          {(
            [
              ["Proposal sets", "proposals"],
              ["Categories", "categories"],
            ] as const
          ).map(([label, nextType]) => (
            <TabButton
              key={label}
              selected={type === nextType}
              onClick={() => changeView("custodies", nextType)}
            >
              {label}
            </TabButton>
          ))}
        </TabStrip>
      )}
      <FilterBar
        key={`${view}:${type}`}
        fields={fields}
        query={query}
        facets={facets}
        onQueryChange={setQuery}
        searchLabel={`Search ${view}`}
        searchPlaceholder={`Search ${view}…`}
      />
      <MasterDetail
        key={listKey}
        master={
          <>
            {notice && (
              <NoticeLine
                tone="green"
                title={notice.title}
                onDismiss={() => setNotice(null)}
                className="mx-4 mt-4 sm:mx-6"
              >
                {notice.text}
              </NoticeLine>
            )}
            {!index ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">Loading users management…</p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground sm:px-6">
                  <span>
                    {visible.length}{" "}
                    {view === "users"
                      ? "users"
                      : view === "roles"
                        ? "roles"
                        : view === "groups"
                          ? "groups"
                          : type === "proposals"
                            ? "proposal custody sets"
                            : "categories"}
                  </span>
                  <span>{shown.length} shown</span>
                </div>
                <div className="overflow-x-auto">
                  <DataTable
                    rows={shown}
                    rowId={(row) => row.id}
                    columns={{
                      phone: columns,
                      small: [columns[0], ...columns.slice(-1)].filter(
                        (column): column is ColumnDefinition<Row> => column !== undefined,
                      ),
                      notebook: columns,
                      large: columns,
                    }}
                    onOpen={(id) => {
                      const row = shown.find((item) => item.id === id);
                      if (row) open({ kind: row.kind, id });
                    }}
                    emptyText="No records match this search."
                    focusedId={selected?.id}
                    cardOf={(row) => (
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => open({ kind: row.kind, id: row.id })}
                      >
                        <b>{row.title}</b>
                        <p className="text-xs text-muted-foreground">{row.secondary}</p>
                        <p className="mt-1 text-xs">
                          {row.third} · {row.groups ? `${row.groups} · ` : ""}
                          {row.access}
                        </p>
                      </button>
                    )}
                    flush
                  />
                </div>
                <div ref={sentinelRef} className="h-px" aria-hidden="true" />
                {shown.length < visible.length && (
                  <p className="px-4 py-3 text-center text-xs text-muted-foreground">
                    Loading more…
                  </p>
                )}
              </>
            )}
          </>
        }
        detail={
          selected ? (
            detail
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a {view === "custodies" ? "resource" : view.slice(0, -1)} to inspect its access
              and relationships.
            </p>
          )
        }
        detailTitle={selectedRow?.title ?? "Record unavailable"}
        detailDescription={selectedRow?.secondary}
        detailOpen={selected !== null}
        onDetailOpenChange={(isOpen) => {
          if (!isOpen) open(null);
        }}
      />
      {dialog && index && names && (
        <AccessDialogView
          dialog={dialog}
          index={index}
          names={names}
          onClose={() => setDialog(null)}
          onDone={(nextNotice, nextSelection) => {
            setNotice(nextNotice);
            setDialog(null);
            if (nextSelection) open(nextSelection);
          }}
        />
      )}
    </>
  );
}
