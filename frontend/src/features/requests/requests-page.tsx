// The Requests view (VIEW-requests): one row per document asked for, within the reach of the
// caller's `request.read`, its asks beside it; `request.decide` adds the decision acts. It opens on awaiting a decision;
// its state lives in the URL like Documents': the filter, `?id=` naming the open document,
// `?group=` the grouping and `?watchlist=` the watchlist the filter was opened from.
// TODO(rrandiak): labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import type { RequestDetail, RequestGroup } from "@vera/contract/requests";
import { hasPermission } from "@vera/domain/permissions";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { getProposalSettings } from "@/api/proposals";
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
import { BulkApproveDialog } from "@/features/requests/bulk-approve-dialog";
import type { DecisionOutcome } from "@/features/requests/request-detail";
import { RequestDetailPane } from "@/features/requests/request-detail";
import { RequestList } from "@/features/requests/request-list";
import { requestsView } from "@/features/requests/requests-view";
import { useRequestQuery, useRequestsQuery } from "@/features/requests/use-requests-query";
import {
  useProjectsQuery,
  useRequestCustodiesQuery,
  useUsersQuery,
} from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { vocabulary } from "@/lib/view-definition";

type BatchGroup = Extract<RequestGroup, { kind: "batch" }>;

export function RequestsPage() {
  const view = useViewUrlState(requestsView);
  const { data: propertyIndex } = usePropertiesQuery();
  const { query, selectedId, grouping, select } = view;
  const [decided, setDecided] = useState<DecisionOutcome | null>(null);
  const [bulkGroup, setBulkGroup] = useState<BatchGroup | null>(null);
  const { data: session } = useSessionQuery();
  const proposals = useRequestsQuery(query, grouping);
  const requestQuery = useRequestQuery(selectedId);
  const { data: detail } = requestQuery;
  const { data: users = [] } = useUsersQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: custodies = [] } = useRequestCustodiesQuery();
  const { data: proposalSettings } = useQuery({
    queryKey: ["proposals", "settings"],
    queryFn: getProposalSettings,
    staleTime: 60_000,
  });
  const { summary } = proposals;

  if (session === undefined) {
    return null;
  }

  const title =
    visibleNavigation(session).find((entry) => entry.id === "requests")?.visibleLabel ?? "";
  const sourceField = proposalSettings?.entrySources.length
    ? [
        {
          key: "sources" as const,
          label: "Source",
          field: vocabulary(
            proposalSettings.entrySources.map(({ id }) => id),
            Object.fromEntries(proposalSettings.entrySources.map(({ id, name }) => [id, name])),
          ),
        },
      ]
    : [];

  const documentsEntry = visibleNavigation(session).find((entry) => entry.id === "documents");
  const paneState: PaneState<RequestDetail> =
    detail === null && decided?.documentId === selectedId
      ? {
          kind: "outcome",
          outcome: {
            title: decided.title,
            tone: "green",
            heading: "Decided",
            summary: decided.summary,
            next:
              documentsEntry === undefined
                ? undefined
                : {
                    label: `Open in ${documentsEntry.visibleLabel}`,
                    href: `${documentsEntry.path}?id=${encodeURIComponent(decided.documentId)}`,
                  },
          },
        }
      : paneStateOf(
          selectedId,
          detail,
          "This request is no longer within your reach",
          failureOf(requestQuery, "Could not load this request."),
        );
  const detailPane = (
    <Pane
      state={paneState}
      emptyIcon={Inbox}
      emptyText="Select a request"
      render={(ready) => (
        <RequestDetailPane detail={ready} session={session} onDecided={setDecided} />
      )}
    />
  );

  return (
    <>
      <PageHeader title={title} />

      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="requests"
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
        fields={[...requestsView.fields, ...sourceField]}
        query={query}
        facets={summary?.facets}
        onQueryChange={(next) => view.setQuery(next)}
        properties={{
          definitions: filterablePropertiesOf(propertyIndex?.definitions, false, ["material_type"]),
          params: query.properties,
          facets: summary?.propertyFacets,
          onChange: (properties) => view.setQuery({ ...query, properties }),
        }}
        searchLabel="Search requests"
        searchPlaceholder="Search — title, catalog ID, volume, who asked, batch"
      />

      <MasterDetail
        master={
          <RequestList
            items={proposals.items}
            groups={proposals.slices?.flatMap((slice) => slice.groups) ?? []}
            total={summary?.total}
            askTotal={summary?.askTotal}
            isLoading={proposals.isLoading}
            failure={failureOf(proposals, "Could not load requests.")}
            paging={proposals.paging}
            grouping={grouping}
            onGroupingChange={view.setGrouping}
            references={{ users, projects, custodies }}
            onBulkApprove={hasPermission(session, "request.decide") ? setBulkGroup : undefined}
            selectedId={selectedId}
            onSelect={select}
          />
        }
        detail={detailPane}
        detailTitle={detail?.row.record.document.title ?? "Request"}
        detailOpen={selectedId !== null}
        onDetailOpenChange={(isOpen) => {
          if (!isOpen) {
            select(null);
          }
        }}
      />

      <BulkApproveDialog group={bulkGroup} onClose={() => setBulkGroup(null)} />
    </>
  );
}
