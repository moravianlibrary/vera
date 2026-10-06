// The Documents Validations view (view-map.md §2.3): one row per iteration in the caller's
// category custody whose metadata a defect holds, or that a rule forbade, the iteration beside it.
// Its state lives in the URL like Documents': the filter, `?id=` naming the open iteration and
// `?watchlist=` the watchlist the filter was opened from; opened bare it reopens the tab last
// used, the shared *Review needed* being the queue the demo opens on.
// TODO(rrandiak): labels move to i18n.

import { ClipboardCheck } from "lucide-react";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Pane, paneStateOf } from "@/components/pane-state";
import { hasPermission } from "@/domain/permissions";
import {
  useValidationQuery,
  useValidationsQuery,
} from "@/features/validations/use-validations-query";
import { ValidationDetailPane } from "@/features/validations/validation-detail";
import { ValidationList } from "@/features/validations/validation-list";
import { validationsView } from "@/features/validations/validations-view";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";

export function ValidationsPage() {
  const view = useViewUrlState(validationsView);
  const { query, selectedId, select } = view;
  const { data: session } = useSessionQuery();
  const validations = useValidationsQuery(query);
  const { data: detail } = useValidationQuery(selectedId);
  const { data: categories = [] } = useCategoriesQuery();
  const { summary } = validations;

  if (session === undefined) {
    return null;
  }

  const title =
    visibleNavigation(session).find((entry) => entry.id === "validations")?.visibleLabel ?? "";
  const detailPane = (
    <Pane
      state={paneStateOf(selectedId, detail, "This item no longer waits here")}
      emptyIcon={ClipboardCheck}
      emptyText="Select an item"
      render={(ready) => <ValidationDetailPane detail={ready} session={session} />}
    />
  );

  return (
    <>
      <PageHeader title={title} />

      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="validations"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={hasPermission(session, "watchlist.manage_shared")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}

      <FilterBar
        // The bar holds its search as typed; a filter replaced from a tab starts it afresh.
        key={view.filterReplacements}
        fields={validationsView.fields}
        query={query}
        facets={summary?.facets}
        onQueryChange={(next) => view.setQuery(next)}
        searchLabel="Search what waits for review"
        searchPlaceholder="Search — title, catalog ID, signature, defect"
      />

      <MasterDetail
        master={
          <ValidationList
            items={validations.items}
            total={summary?.total}
            outstandingTotal={summary?.outstandingTotal}
            isLoading={validations.isLoading}
            paging={validations.paging}
            categories={categories}
            reviews={query.reviews}
            selectedId={selectedId}
            onSelect={select}
          />
        }
        detail={detailPane}
        detailTitle={detail?.row.document.title ?? "Item"}
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
