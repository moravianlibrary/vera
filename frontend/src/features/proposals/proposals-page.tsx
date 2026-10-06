// The Proposals view (view-map.md §2, Proposal Review): one row per document awaiting a decision
// within the caller's proposal custody, the proposal beside it. It opens on awaiting a decision;
// its state lives in the URL like Documents': the filter, `?id=` naming the open document,
// `?group=` the grouping and `?watchlist=` the watchlist the filter was opened from.
// TODO(rrandiak): labels move to i18n.

import { Inbox } from "lucide-react";
import { useState } from "react";
import type { ProposalDetail, ProposalGroup } from "@/api/proposal-review";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import type { PaneState } from "@/components/pane-state";
import { Pane, paneStateOf } from "@/components/pane-state";
import { hasPermission } from "@/domain/permissions";
import { BulkApproveDialog } from "@/features/proposals/bulk-approve-dialog";
import type { DecisionOutcome } from "@/features/proposals/proposal-detail";
import { ProposalDetailPane } from "@/features/proposals/proposal-detail";
import { ProposalList } from "@/features/proposals/proposal-list";
import { proposalsView } from "@/features/proposals/proposals-view";
import { useProposalQuery, useProposalsQuery } from "@/features/proposals/use-proposals-query";
import {
  useProjectsQuery,
  useProposalCustodiesQuery,
  useUsersQuery,
} from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";

type BatchGroup = Extract<ProposalGroup, { kind: "batch" }>;

export function ProposalsPage() {
  const view = useViewUrlState(proposalsView);
  const { query, selectedId, grouping, select } = view;
  const [decided, setDecided] = useState<DecisionOutcome | null>(null);
  const [bulkGroup, setBulkGroup] = useState<BatchGroup | null>(null);
  const { data: session } = useSessionQuery();
  const proposals = useProposalsQuery(query, grouping);
  const { data: detail } = useProposalQuery(selectedId);
  const { data: users = [] } = useUsersQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: custodies = [] } = useProposalCustodiesQuery();
  const { summary } = proposals;

  if (session === undefined) {
    return null;
  }

  const title =
    visibleNavigation(session).find((entry) => entry.id === "proposals")?.visibleLabel ?? "";

  const documentsEntry = visibleNavigation(session).find((entry) => entry.id === "documents");
  const paneState: PaneState<ProposalDetail> =
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
      : paneStateOf(selectedId, detail, "This proposal is no longer waiting here");
  const detailPane = (
    <Pane
      state={paneState}
      emptyIcon={Inbox}
      emptyText="Select a proposal"
      render={(ready) => (
        <ProposalDetailPane detail={ready} session={session} onDecided={setDecided} />
      )}
    />
  );

  return (
    <>
      <PageHeader title={title} />

      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="proposals"
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
        fields={proposalsView.fields}
        query={query}
        facets={summary?.facets}
        onQueryChange={(next) => view.setQuery(next)}
        searchLabel="Search proposals"
        searchPlaceholder="Search — title, catalog ID, volume, who asked, batch"
      />

      <MasterDetail
        master={
          <ProposalList
            items={proposals.items}
            groups={proposals.slices?.flatMap((slice) => slice.groups) ?? []}
            total={summary?.total}
            askTotal={summary?.askTotal}
            isLoading={proposals.isLoading}
            paging={proposals.paging}
            grouping={grouping}
            onGroupingChange={view.setGrouping}
            references={{ users, projects, custodies }}
            onBulkApprove={setBulkGroup}
            selectedId={selectedId}
            onSelect={select}
          />
        }
        detail={detailPane}
        detailTitle={detail?.row.record.document.title ?? "Proposal"}
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
