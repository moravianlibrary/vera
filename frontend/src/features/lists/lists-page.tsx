// The Digitization Lists page, browse (view-map.md §2.4): the lists on the left, the chosen one
// in the pane. Its state lives in the URL like the other views': the search, `?show=` and `?id=`
// naming the open list. The count says how much is ready to list to whoever builds lists.
// *New list* opens the editor, and needs `list.create`.
// TODO(rrandiak): labels move to i18n.

import { ListChecks } from "lucide-react";
import { useId } from "react";
import { FilterBar } from "@/components/filters/filter-bar";
import { MasterDetail } from "@/components/layout/master-detail";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Pane, paneStateOf } from "@/components/pane-state";
import { hasPermission } from "@/domain/permissions";
import { ListDetailPane } from "@/features/lists/list-detail";
import { ListRows } from "@/features/lists/list-rows";
import type { ListShow } from "@/features/lists/lists-view";
import { listQueryOf, listShowLabels, listShows, listsView } from "@/features/lists/lists-view";
import { useListQuery, useListsQuery, usePoolSizeQuery } from "@/features/lists/use-lists-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

export function ListsPage() {
  const view = useViewUrlState(listsView);
  const { query, selectedId, select } = view;
  const { data: session } = useSessionQuery();
  const lists = useListsQuery(listQueryOf(query));
  const { data: detail } = useListQuery(selectedId);
  const canBuild =
    session !== undefined &&
    (hasPermission(session, "list.create") || hasPermission(session, "list.edit"));
  const { data: pool } = usePoolSizeQuery(canBuild);
  const total = lists.summary?.total;

  if (session === undefined) {
    return null;
  }

  const title =
    visibleNavigation(session).find((entry) => entry.id === "lists")?.visibleLabel ?? "";
  const count = [
    total === undefined ? "Lists" : plural(total, "list"),
    pool === undefined
      ? null
      : `${formatCount(pool.total)} ready to list, ${formatCount(pool.pages)} pp`,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={title}
        actions={
          hasPermission(session, "list.create")
            ? [{ id: "new", label: "New list", isPrimary: true, href: "/lists/new" }]
            : []
        }
      />

      <FilterBar
        fields={listsView.fields}
        query={query}
        facets={undefined}
        onQueryChange={(next) => view.setQuery(next)}
        searchLabel="Search lists"
        searchPlaceholder="Search lists — name, ID"
        activeExtraCount={query.show === "current" ? 0 : 1}
        extras={
          <ShowSelect show={query.show} onChange={(show) => view.setQuery({ ...query, show })} />
        }
      />

      <MasterDetail
        master={
          <ListRows
            rows={lists.items}
            count={count}
            total={total}
            isLoading={lists.isLoading}
            paging={lists.paging}
            selectedId={selectedId}
            onSelect={select}
          />
        }
        detail={
          <Pane
            state={paneStateOf(selectedId, detail, "This list is gone")}
            emptyIcon={ListChecks}
            emptyText="Select a list"
            render={(ready) => (
              <ListDetailPane
                key={ready.row.list.id}
                detail={ready}
                session={session}
                onDeleted={() => select(null)}
              />
            )}
          />
        }
        detailTitle={detail?.row.list.name ?? "List"}
        detailOpen={selectedId !== null}
        onDetailOpenChange={(isOpen) => {
          if (!isOpen) {
            select(null);
          }
        }}
      />
    </>
  );
}

function ShowSelect({ show, onChange }: { show: ListShow; onChange: (show: ListShow) => void }) {
  const id = useId();
  return (
    <div className="flex h-7 items-center gap-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        Show
      </label>
      <select
        id={id}
        className="h-7 rounded-md border bg-background px-2 text-xs"
        value={show}
        onChange={(event) =>
          onChange(listShows.find((value) => value === event.target.value) ?? "current")
        }
      >
        {listShows.map((value) => (
          <option key={value} value={value}>
            {listShowLabels[value]}
          </option>
        ))}
      </select>
    </div>
  );
}
