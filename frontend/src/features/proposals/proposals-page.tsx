// The Proposals view (view-map.md §2, Proposal Review): one row per document awaiting a decision
// within the caller's proposal custody, the proposal beside it. It opens on awaiting a decision;
// its state lives in the URL like Documents': the filter, `?id=` naming the open document,
// `?group=` the grouping and `?watchlist=` the watchlist the filter was opened from.
// TODO(rrandiak): labels move to i18n.

import { ArrowRight, Inbox } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { ProposalGroup } from "@/api/proposal-review";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/domain/permissions";
import { BulkApproveDialog } from "@/features/proposals/bulk-approve-dialog";
import type { DecisionOutcome } from "@/features/proposals/proposal-detail";
import { ProposalDetailPane } from "@/features/proposals/proposal-detail";
import { ProposalFilterBar } from "@/features/proposals/proposal-filter-bar";
import { ProposalList } from "@/features/proposals/proposal-list";
import { proposalsView } from "@/features/proposals/proposals-view";
import {
  useProposalCustodiesQuery,
  useProposalQuery,
  useProposalsQuery,
} from "@/features/proposals/use-proposals-query";
import { useProjectsQuery, useUsersQuery } from "@/hooks/use-reference-query";
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
  // The first slice carries what describes the whole list: totals and counts.
  const summary = proposals.data?.pages[0];
  const items = proposals.data?.pages.flatMap((page) => page.items);
  const groups = proposals.data?.pages.flatMap((page) => page.groups) ?? [];

  const loadMore = () => {
    if (proposals.hasNextPage && !proposals.isFetchingNextPage) {
      void proposals.fetchNextPage();
    }
  };

  if (session === undefined) {
    return null;
  }

  const title =
    visibleNavigation(session).find((entry) => entry.id === "proposals")?.visibleLabel ?? "";

  const documentsEntry = visibleNavigation(session).find((entry) => entry.id === "documents");
  const outcome = detail === null && decided?.documentId === selectedId ? decided : null;
  const detailPane =
    outcome !== null ? (
      <article className="max-w-5xl">
        <h2 className="mb-4 text-xl leading-7 font-semibold">{outcome.title}</h2>
        <StatusNote tone="green" title="Decided">
          {outcome.summary}.
        </StatusNote>
        {documentsEntry !== undefined && (
          <Button asChild size="sm" variant="outline" className="mt-4">
            <Link to={`${documentsEntry.path}?id=${encodeURIComponent(outcome.documentId)}`}>
              Open in {documentsEntry.visibleLabel}
              <ArrowRight />
            </Link>
          </Button>
        )}
      </article>
    ) : detail === undefined || detail === null ? (
      <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
        <div>
          <Inbox className="mx-auto" />
          <p className="mt-3">
            {detail === null ? "This proposal is no longer waiting here" : "Select a proposal"}
          </p>
        </div>
      </div>
    ) : (
      <ProposalDetailPane detail={detail} session={session} onDecided={setDecided} />
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

      <ProposalFilterBar
        // The bar holds its search as typed; a filter replaced from a tab starts it afresh.
        key={view.filterReplacements}
        query={query}
        summary={summary}
        onQueryChange={(next) => view.setQuery(next)}
      />

      <MasterDetail
        master={
          <ProposalList
            items={items}
            groups={groups}
            total={summary?.total}
            askTotal={summary?.askTotal}
            isLoading={proposals.isLoading}
            isLoadingMore={proposals.isFetchingNextPage}
            hasMore={proposals.hasNextPage}
            onLoadMore={loadMore}
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
