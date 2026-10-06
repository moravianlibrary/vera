// The Documents view: one row per document within the caller's reach, its full record beside it.
// Its state lives in the URL, so any state is a link: the filter, `?id=` naming the open
// document, `?group=` the grouping and `?watchlist=` the watchlist the filter was opened from.
// A link from elsewhere names a document by searching for it: a search with exactly one match
// opens that match.
// TODO(rrandiak): labels move to i18n.

import { BookOpen, Plus } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/domain/permissions";
import { DocumentDetailPane } from "@/features/documents/document-detail";
import { DocumentFilterBar } from "@/features/documents/document-filter-bar";
import { DocumentList } from "@/features/documents/document-list";
import { documentsView } from "@/features/documents/documents-view";
import { ProposeDialog } from "@/features/documents/propose-dialog";
import { useDocumentQuery, useDocumentsQuery } from "@/features/documents/use-documents-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";

export function DocumentsPage() {
  const view = useViewUrlState(documentsView);
  const { query, selectedId, grouping, select } = view;
  const [isProposing, setIsProposing] = useState(false);
  const { data: session } = useSessionQuery();
  const documents = useDocumentsQuery(query, grouping);
  const { data: detail } = useDocumentQuery(selectedId);
  // The first slice carries what describes the whole list: audience, total and counts.
  const summary = documents.data?.pages[0];
  const items = documents.data?.pages.flatMap((page) => page.items);
  const groups = documents.data?.pages.flatMap((page) => page.groups) ?? [];

  // Once per search, so a closed record stays closed.
  const autoOpenedSearchRef = useRef<string | null>(null);
  const onlyMatchId =
    summary?.total === 1 && !documents.isPlaceholderData
      ? (summary.items[0]?.document.id ?? null)
      : null;
  const openOnlyMatch = useEffectEvent((documentId: string) => select(documentId));
  const { search } = query;
  useEffect(() => {
    if (search === undefined || onlyMatchId === null || autoOpenedSearchRef.current === search) {
      return;
    }

    autoOpenedSearchRef.current = search;
    if (selectedId === null) {
      openOnlyMatch(onlyMatchId);
    }
  }, [search, onlyMatchId, selectedId]);

  const loadMore = () => {
    if (documents.hasNextPage && !documents.isFetchingNextPage) {
      void documents.fetchNextPage();
    }
  };

  if (session === undefined) {
    return null;
  }

  const userId = session.user.id;
  const isPublic = summary?.audience === "public";
  const groupings = isPublic
    ? []
    : hasPermission(session, "addition.read")
      ? (["batch", "project"] as const)
      : (["project"] as const);
  const title =
    visibleNavigation(session).find((entry) => entry.id === "documents")?.visibleLabel ?? "";

  const detailPane =
    detail === undefined || detail === null ? (
      <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
        <div>
          <BookOpen className="mx-auto" />
          <p className="mt-3">Select a document</p>
        </div>
      </div>
    ) : (
      <DocumentDetailPane detail={detail} session={session} />
    );

  const canPropose = hasPermission(session, "request.create");

  return (
    <>
      <PageHeader
        title={title}
        actions={
          canPropose && (
            <Button size="sm" onClick={() => setIsProposing(true)}>
              <Plus />
              Propose
            </Button>
          )
        }
      />

      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="documents"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={hasPermission(session, "watchlist.manage_shared")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}

      <DocumentFilterBar
        // The bar holds its search as typed; a filter replaced from a tab starts it afresh.
        key={view.filterReplacements}
        query={query}
        summary={summary}
        isPublic={isPublic}
        onQueryChange={(next) => view.setQuery(next)}
      />

      <MasterDetail
        master={
          <DocumentList
            audience={summary?.audience}
            items={items}
            groups={groups}
            total={summary?.total}
            isLoading={documents.isLoading}
            isLoadingMore={documents.isFetchingNextPage}
            hasMore={documents.hasNextPage}
            onLoadMore={loadMore}
            groupings={groupings}
            grouping={grouping}
            onGroupingChange={view.setGrouping}
            canRetryAdditions={hasPermission(session, "addition.retry")}
            canOpenProjects={
              hasPermission(session, "project.read") || hasPermission(session, "project.decide")
            }
            userId={userId}
            selectedId={selectedId}
            onSelect={select}
          />
        }
        detail={detailPane}
        detailTitle={detail?.record.document.title ?? "Document detail"}
        detailOpen={selectedId !== null}
        onDetailOpenChange={(isOpen) => {
          if (!isOpen) {
            select(null);
          }
        }}
      />

      {canPropose && (
        <ProposeDialog
          isOpen={isProposing}
          onOpenChange={setIsProposing}
          session={session}
          viewTitle={title}
        />
      )}
    </>
  );
}
