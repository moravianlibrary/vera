// The Proposals view (view-map.md §2, Proposal Review): one row per document awaiting a decision
// within the caller's proposal custody, the proposal beside it. It opens on awaiting a decision;
// its state lives in the URL like Documents': the filter, `?id=` naming the open document,
// `?group=` the grouping and `?watchlist=` the watchlist the filter was opened from.
// TODO(rrandiak): labels move to i18n.

import { ArrowRight, Inbox } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { ProposalGroup, ProposalGrouping, ProposalQuery } from "@/api/proposal-review";
import {
  parseProposalGrouping,
  parseProposalSearchParams,
  proposalGroupingParam,
  toProposalSearchParams,
} from "@/api/proposal-review";
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
import {
  useProposalCustodiesQuery,
  useProposalQuery,
  useProposalsQuery,
} from "@/features/proposals/use-proposals-query";
import { useProjectsQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";

const selectedParam = "id";
const watchlistParam = "watchlist";
// What the page keeps of its URL when the filter changes.
const pageParams = [selectedParam, proposalGroupingParam, watchlistParam] as const;

type Filter = Record<string, string>;
type BatchGroup = Extract<ProposalGroup, { kind: "batch" }>;

// Nothing named but perhaps the grouping, which is presentation.
const isBareView = (params: URLSearchParams) =>
  [...params.keys()].every((name) => name === proposalGroupingParam);

const filterOf = (query: ProposalQuery): Filter =>
  Object.fromEntries(toProposalSearchParams(query));
const queryOf = (filter: Filter): ProposalQuery =>
  parseProposalSearchParams(new URLSearchParams(filter));

export function ProposalsPage() {
  const [params, setParams] = useSearchParams();
  const query = parseProposalSearchParams(params);
  const selectedId = params.get(selectedParam);
  const grouping = parseProposalGrouping(params);
  const [filterReplacements, setFilterReplacements] = useState(0);
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

  const replaceParams = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace: true });
  };

  const setFilter = (next: ProposalQuery, openedWatchlistId?: string | null) => {
    const nextParams = toProposalSearchParams(next);
    for (const name of pageParams) {
      const value = params.get(name);
      if (value !== null) {
        nextParams.set(name, value);
      }
    }

    if (openedWatchlistId === null) {
      nextParams.delete(watchlistParam);
    } else if (openedWatchlistId !== undefined) {
      nextParams.set(watchlistParam, openedWatchlistId);
    }

    setParams(nextParams, { replace: true });
  };

  const setGrouping = (next: ProposalGrouping | null) =>
    replaceParams((nextParams) =>
      next === null
        ? nextParams.delete(proposalGroupingParam)
        : nextParams.set(proposalGroupingParam, next),
    );

  const select = (documentId: string | null) =>
    replaceParams((nextParams) =>
      documentId === null
        ? nextParams.delete(selectedParam)
        : nextParams.set(selectedParam, documentId),
    );

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
          filter={filterOf(query)}
          openedId={params.get(watchlistParam)}
          canShare={hasPermission(session, "watchlist.manage_shared")}
          onOpen={(watchlist) => {
            setFilter(watchlist === null ? {} : queryOf(watchlist.filter), watchlist?.id ?? null);
            setFilterReplacements((count) => count + 1);
          }}
          onDetach={() => setFilter(query, null)}
          isBare={isBareView(params)}
        />
      )}

      <ProposalFilterBar
        // The bar holds its search as typed; a filter replaced from a tab starts it afresh.
        key={filterReplacements}
        query={query}
        summary={summary}
        onQueryChange={(next) => setFilter(next)}
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
            onGroupingChange={setGrouping}
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
