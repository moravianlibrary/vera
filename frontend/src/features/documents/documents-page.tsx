// The Documents view: one row per document within the caller's reach, its full record beside it.
// Its state lives in the URL, so any state is a link: the filter, `?id=` naming the open
// document, `?group=` the grouping and `?watchlist=` the watchlist the filter was opened from.
// A link from elsewhere names a document by searching for it: a search with exactly one match
// opens that match.
// TODO(rrandiak): labels move to i18n.

import { hasPermission, proposeActOf } from "@vera/domain/permissions";
import { BookOpen, Plus } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
import { Pane, paneStateOf } from "@/components/pane-state";
import { failureOf } from "@/components/query-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DocumentDetailPane } from "@/features/documents/document-detail";
import { DocumentList } from "@/features/documents/document-list";
import { documentsView, myDocumentsView } from "@/features/documents/documents-view";
import { ProposeDialog } from "@/features/documents/propose-dialog";
import { useDocumentQuery, useDocumentsQuery } from "@/features/documents/use-documents-query";
import { useBulkPropertyEntry } from "@/features/properties/bulk-property-entry";
import {
  filterablePropertiesOf,
  usePropertiesQuery,
} from "@/features/properties/use-properties-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";

export function DocumentsPage({ perspective }: { perspective: "staff" | "my" }) {
  const isMy = perspective === "my";
  const view = useViewUrlState(isMy ? myDocumentsView : documentsView);
  const { query, selectedId, grouping, select } = view;
  const [isProposing, setIsProposing] = useState(false);
  const { data: session } = useSessionQuery();
  const documents = useDocumentsQuery(query, grouping, isMy ? "my" : undefined);
  const documentQuery = useDocumentQuery(selectedId, isMy ? "my" : undefined);
  const { data: detail } = documentQuery;
  const { summary } = documents;
  // DOC-property-hand: a value entered on the picked documents at once.
  const bulk = useBulkPropertyEntry(session, !isMy);
  const { data: propertyIndex } = usePropertiesQuery();

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

  if (session === undefined) {
    return null;
  }

  const userId = session.user.id;
  const isPublic = isMy;
  // Batches need `request.read_ingest`; a requester's list is never grouped.
  const groupings = isPublic
    ? []
    : documentsView.groupings.filter(
        (option) => option.value !== "batch" || hasPermission(session, "request.read_ingest"),
      );
  const title = isMy ? "My Documents" : "Documents";

  const detailPane = (
    <Pane
      state={paneStateOf(
        selectedId,
        detail,
        "This document is not within your reach",
        failureOf(documentQuery, "Could not load this document."),
      )}
      emptyIcon={BookOpen}
      emptyText="Select a document"
      render={(ready) => <DocumentDetailPane detail={ready} session={session} />}
    />
  );

  const canPropose = hasPermission(session, "request.create");

  return (
    <>
      <PageHeader
        title={title}
        actions={
          canPropose
            ? [
                {
                  id: "propose",
                  label: proposeActOf(session),
                  icon: Plus,
                  isPrimary: true,
                  onSelect: () => setIsProposing(true),
                },
              ]
            : []
        }
      />

      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view={isMy ? "my-documents" : "documents"}
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={hasPermission(session, "watchlist.manage_system")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}

      {bulk.notice}

      <FilterBar
        // The bar holds its search as typed; a filter replaced from a tab starts it afresh.
        key={view.filterReplacements}
        fields={documentsView.fields.filter(
          (field) =>
            field.audience === undefined || field.audience === (isPublic ? "public" : "staff"),
        )}
        query={query}
        facets={summary?.facets}
        onQueryChange={(next) => view.setQuery(next)}
        searchLabel="Search documents"
        searchPlaceholder={
          isPublic ? "Search my documents…" : "Search — title, catalog ID, volume, shelf mark, NBN…"
        }
        properties={{
          definitions: filterablePropertiesOf(propertyIndex?.definitions, isPublic),
          params: query.properties,
          facets: summary?.propertyFacets,
          onChange: (properties) => view.setQuery({ ...query, properties }),
        }}
        activeExtraCount={query.isMine === true ? 1 : 0}
        extras={
          !isPublic && (
            <MineToggle
              isChecked={query.isMine === true}
              onChange={(isMine) => view.setQuery({ ...query, isMine: isMine || undefined })}
            />
          )
        }
      />

      <MasterDetail
        master={
          <DocumentList
            audience={summary?.audience}
            items={documents.items}
            groups={documents.slices?.flatMap((slice) => slice.groups) ?? []}
            total={summary?.total}
            isLoading={documents.isLoading}
            failure={failureOf(documents, "Could not load documents.")}
            paging={documents.paging}
            groupings={groupings}
            grouping={grouping}
            onGroupingChange={view.setGrouping}
            canRetryAdditions={hasPermission(session, "request.retry")}
            canOpenProjects={hasPermission(session, "project.read")}
            userId={userId}
            selectedId={selectedId}
            onSelect={select}
            picking={bulk.picking}
            toolbarActions={bulk.toolbarActions}
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

      {bulk.dialog}

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

interface MineToggleProps {
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}

// Narrows a staff reach to documents the caller asked for.
function MineToggle({ isChecked, onChange }: MineToggleProps) {
  const id = useId();
  return (
    <div className="flex h-7 items-center gap-1.5 px-1">
      <Checkbox id={id} checked={isChecked} onCheckedChange={(state) => onChange(state === true)} />
      <Label htmlFor={id} className="text-xs font-normal">
        Mine
      </Label>
    </div>
  );
}
