// Shape: Master–detail.
// The Digitization Lists page, browse (view-map.md §2.4): the lists on the left, the chosen one
// in the pane. Its state lives in the URL like the other views': filters and `?id=`
// naming the open list. The count says how much is ready to list to whoever builds lists.
// *New list* opens the editor, and needs `list.create`.

import { hasPermission } from "@vera/domain/permissions";
import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Pane, paneStateOf } from "@/components/pane-state";
import { failureOf } from "@/components/query-state";
import { ListDetailPane } from "@/features/lists/list-detail";
import { ListRows } from "@/features/lists/list-rows";
import { listsView } from "@/features/lists/lists-view";
import { useListQuery, useListsQuery, usePoolSizeQuery } from "@/features/lists/use-lists-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { formatCount } from "@/lib/format-number";

export function ListsPage() {
  const { t } = useTranslation("lists");
  const view = useViewUrlState(listsView);
  const { query, selectedId, select } = view;
  const { data: session } = useSessionQuery();
  const lists = useListsQuery(query);
  const listQuery = useListQuery(selectedId);
  const { data: detail } = listQuery;
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
    total === undefined ? t("listsPage.lists") : t("listsPage.list", { count: total }),
    pool === undefined
      ? null
      : t("listsPage.poolCount", {
          total: formatCount(pool.total),
          pages: formatCount(pool.pages),
        }),
  ]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={t(title)}
        actions={
          hasPermission(session, "list.create")
            ? [{ id: "new", label: t("listsPage.newList"), isPrimary: true, href: "/lists/new" }]
            : []
        }
      />

      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="lists"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={hasPermission(session, "watchlist.manage_system")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}

      <FilterBar
        key={view.filterReplacements}
        fields={listsView.fields}
        query={query}
        facets={lists.summary?.facets}
        onQueryChange={(next) => view.setQuery(next)}
        searchLabel={t("listsPage.searchLabel")}
        searchPlaceholder={t("listsPage.searchPlaceholder")}
      />

      <MasterDetail
        master={
          <ListRows
            rows={lists.items}
            count={count}
            total={total}
            isLoading={lists.isLoading}
            failure={failureOf(lists, t("listsPage.loadFailure"))}
            paging={lists.paging}
            selectedId={selectedId}
            onSelect={select}
          />
        }
        detail={
          <Pane
            state={paneStateOf(
              selectedId,
              detail,
              t("listsPage.gone"),
              failureOf(listQuery, t("listsPage.loadOneFailure")),
            )}
            emptyIcon={ListChecks}
            emptyText={t("listsPage.selectList")}
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
        detailTitle={detail?.row.list.name ?? t("listsPage.list")}
        detailOpen={selectedId !== null}
        onDetailOpenChange={(isOpen) => {
          if (!isOpen) {
            select(null);
          }
        }}
        swipe={{
          items: lists.items ?? [],
          idOf: (row) => row.list.id,
          labelOf: (row) => row.list.name,
          currentId: selectedId,
          onSelect: select,
          onNearEnd: lists.paging.onLoadMore,
        }}
      />
    </>
  );
}
