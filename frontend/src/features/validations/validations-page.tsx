// The Documents Validations view (view-map.md §2.3): one row per iteration in the caller's
// category custody whose metadata a defect holds, or that a rule forbade, the iteration beside it.
// Its state lives in the URL like Documents': the filter, `?id=` naming the open iteration and
// `?watchlist=` the watchlist the filter was opened from; opened bare it reopens the tab last
// used, the shared *Review needed* being the queue the demo opens on.
// TODO(rrandiak): labels move to i18n.

import type { ValidationDetail } from "@vera/contract/validations";
import { hasPermission } from "@vera/domain/permissions";
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import type { PaneState } from "@/components/pane-state";
import { Pane, paneStateOf } from "@/components/pane-state";
import { failureOf } from "@/components/query-state";
import {
  filterablePropertiesOf,
  usePropertiesQuery,
} from "@/features/properties/use-properties-query";
import {
  useValidationQuery,
  useValidationsQuery,
} from "@/features/validations/use-validations-query";
import type { LeftOutcome } from "@/features/validations/validation-detail";
import { ValidationDetailPane } from "@/features/validations/validation-detail";
import { ValidationList } from "@/features/validations/validation-list";
import { validationsView } from "@/features/validations/validations-view";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";

export function ValidationsPage() {
  const view = useViewUrlState(validationsView);
  const { data: propertyIndex } = usePropertiesQuery();
  const { query, selectedId, grouping, select } = view;
  const [left, setLeft] = useState<LeftOutcome | null>(null);
  const { data: session } = useSessionQuery();
  const validations = useValidationsQuery(query, grouping);
  const validationQuery = useValidationQuery(selectedId);
  const { data: detail } = validationQuery;
  const { data: categories = [] } = useCategoriesQuery();
  const { summary } = validations;

  if (session === undefined) {
    return null;
  }

  const title =
    visibleNavigation(session).find((entry) => entry.id === "validations")?.visibleLabel ?? "";
  // An act that took the item out of the view says so where it was, until another is opened.
  const paneState: PaneState<ValidationDetail> =
    detail === null && left?.iterationId === selectedId
      ? { kind: "outcome", outcome: left }
      : paneStateOf(
          selectedId,
          detail,
          "This item no longer waits here",
          failureOf(validationQuery, "Could not load this validation."),
        );
  const detailPane = (
    <Pane
      state={paneState}
      emptyIcon={ClipboardCheck}
      emptyText="Select an item"
      render={(ready) => (
        <ValidationDetailPane
          key={ready.row.iteration.id}
          detail={ready}
          session={session}
          onLeft={setLeft}
        />
      )}
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
          canShare={hasPermission(session, "watchlist.manage_system")}
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
        properties={{
          definitions: filterablePropertiesOf(propertyIndex?.definitions, false),
          params: query.properties,
          facets: summary?.propertyFacets,
          onChange: (properties) => view.setQuery({ ...query, properties }),
        }}
        searchLabel="Search what waits for review"
        searchPlaceholder="Search — title, catalog ID, shelf mark, defect"
      />

      <MasterDetail
        master={
          <ValidationList
            items={validations.items}
            groups={validations.slices?.flatMap((slice) => slice.groups) ?? []}
            grouping={grouping}
            onGroupingChange={view.setGrouping}
            total={summary?.total}
            outstandingTotal={summary?.outstandingTotal}
            isLoading={validations.isLoading}
            failure={failureOf(validations, "Could not load validations.")}
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
        swipe={{
          items: validations.items ?? [],
          idOf: (row) => row.iteration.id,
          labelOf: (row) => row.document.title,
          currentId: selectedId,
          onSelect: select,
          onNearEnd: validations.paging.onLoadMore,
        }}
      />
    </>
  );
}
