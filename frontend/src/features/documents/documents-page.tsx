// The Documents view: one row per document within the caller's reach, its full record beside it.
// Its state lives in the URL, so any state is a link: the filter, `?id=` naming the open
// document, `?group=` the grouping and `?watchlist=` the watchlist the filter was opened from.
// A link from elsewhere names a document by searching for it: a search with exactly one match
// opens that match.
// TODO(rrandiak): the rest of docs/demos/notebook/documents.html — the detail cards and the
// propose form; labels move to i18n.

import { BookOpen, Plus } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { DocumentGrouping, DocumentQuery } from "@/api/documents";
import {
  documentGroupingParam,
  parseDocumentGrouping,
  parseDocumentSearchParams,
  toDocumentSearchParams,
} from "@/api/documents";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { visibleNavigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { DocumentRecord } from "@/domain/documents";
import {
  documentIdentifierOf,
  effectivePageCount,
  publicRecordStatusOf,
  recordStatusOf,
} from "@/domain/documents";
import { hasPermission } from "@/domain/permissions";
import { DocumentFilterBar } from "@/features/documents/document-filter-bar";
import { DocumentList } from "@/features/documents/document-list";
import { useDocumentQuery, useDocumentsQuery } from "@/features/documents/use-documents-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { joinDetails } from "@/lib/join-details";

const selectedParam = "id";
const watchlistParam = "watchlist";
// What the page keeps of its URL when the filter changes.
const pageParams = [selectedParam, documentGroupingParam, watchlistParam] as const;

type Filter = Record<string, string>;

const filterOf = (query: DocumentQuery): Filter =>
  Object.fromEntries(toDocumentSearchParams(query));
const queryOf = (filter: Filter): DocumentQuery =>
  parseDocumentSearchParams(new URLSearchParams(filter));

export function DocumentsPage() {
  const [params, setParams] = useSearchParams();
  const query = parseDocumentSearchParams(params);
  const selectedId = params.get(selectedParam);
  const grouping = parseDocumentGrouping(params);
  const [filterReplacements, setFilterReplacements] = useState(0);
  const { data: session } = useSessionQuery();
  const documents = useDocumentsQuery(query, grouping);
  const { data: detail } = useDocumentQuery(selectedId);
  // The first slice carries what describes the whole list: audience, total and counts.
  const summary = documents.data?.pages[0];
  const items = documents.data?.pages.flatMap((page) => page.items);
  const groups = documents.data?.pages.flatMap((page) => page.groups) ?? [];

  const setFilter = (next: DocumentQuery, openedWatchlistId?: string | null) => {
    const nextParams = toDocumentSearchParams(next);
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

  const setGrouping = (next: DocumentGrouping | null) => {
    const nextParams = new URLSearchParams(params);
    if (next === null) {
      nextParams.delete(documentGroupingParam);
    } else {
      nextParams.set(documentGroupingParam, next);
    }

    setParams(nextParams, { replace: true });
  };

  const select = (documentId: string | null) => {
    const nextParams = new URLSearchParams(params);
    if (documentId === null) {
      nextParams.delete(selectedParam);
    } else {
      nextParams.set(selectedParam, documentId);
    }

    setParams(nextParams, { replace: true });
  };

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
  const statusBadgeOf = (record: DocumentRecord) => {
    const status = isPublic ? publicRecordStatusOf(record, userId) : recordStatusOf(record);
    return status === null ? null : <StatusBadge status={status} />;
  };

  const title =
    visibleNavigation(session).find((entry) => entry.id === "documents")?.visibleLabel ?? "";

  const selected = detail?.record;
  const pages = selected === undefined ? null : effectivePageCount(selected.document);
  const detailPane =
    selected === undefined ? (
      <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
        <div>
          <BookOpen className="mx-auto" />
          <p className="mt-3">Select a document</p>
        </div>
      </div>
    ) : (
      <article className="max-w-5xl">
        <div className="mb-5">
          <h2 className="text-xl leading-7 font-semibold">{selected.document.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {joinDetails([
              documentIdentifierOf(selected.document),
              selected.document.type,
              selected.document.signature,
            ])}
          </p>
          <div className="mt-2">{statusBadgeOf(selected)}</div>
        </div>

        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Pages</dt>
            <dd className="mt-1 font-medium">{pages?.value ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Iterations</dt>
            <dd className="mt-1 font-medium">{selected.iterations.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Requests</dt>
            <dd className="mt-1 font-medium">{selected.requests.length}</dd>
          </div>
        </dl>

        <ol className="mt-6 space-y-2 text-sm">
          {detail?.log.map((entry) => (
            <li key={entry.id}>
              <b className="font-medium">{entry.event}</b>{" "}
              <span className="text-muted-foreground">{entry.at}</span>
            </li>
          ))}
        </ol>
      </article>
    );

  // TODO(rrandiak): open the propose form (status-model.md §2.8).
  const canPropose = hasPermission(session, "request.create");

  return (
    <>
      <PageHeader
        title={title}
        actions={
          canPropose && (
            <Button size="sm">
              <Plus />
              Propose
            </Button>
          )
        }
      />

      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="documents"
          filter={filterOf(query)}
          openedId={params.get(watchlistParam)}
          canShare={hasPermission(session, "watchlist.manage_shared")}
          onOpen={(watchlist) => {
            setFilter(watchlist === null ? {} : queryOf(watchlist.filter), watchlist?.id ?? null);
            setFilterReplacements((count) => count + 1);
          }}
          onDetach={() => setFilter(query, null)}
        />
      )}

      <DocumentFilterBar
        // The bar holds its search as typed; a filter replaced from a tab starts it afresh.
        key={filterReplacements}
        query={query}
        summary={summary}
        isPublic={isPublic}
        onQueryChange={(next) => setFilter(next)}
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
            onGroupingChange={setGrouping}
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
        detailTitle={selected?.document.title ?? "Document detail"}
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
