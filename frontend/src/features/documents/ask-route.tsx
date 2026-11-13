// The /ask entry route forwards an outside portal's link into a Documents perspective.

import { useQuery } from "@tanstack/react-query";
import { hasPermission } from "@vera/domain/permissions";
import { Navigate, useLocation } from "react-router";
import { readProposalEntry } from "@/api/proposals";
import { canOpenNavigationEntry } from "@/components/layout/navigation";
import { entryAskOf } from "@/features/documents/entry-link";
import { NoAccessPage } from "@/features/system/no-access-page";
import { useSessionQuery } from "@/hooks/use-session-query";

export function AskRoute() {
  const { data: session } = useSessionQuery();
  const location = useLocation();
  if (session === undefined) return null;
  if (!hasPermission(session, "request.create")) return <NoAccessPage />;

  const entry = canOpenNavigationEntry(session, "my-documents")
    ? "my-documents"
    : canOpenNavigationEntry(session, "documents")
      ? "documents"
      : null;
  if (entry === null) return <NoAccessPage />;
  const params = new URLSearchParams(location.search);
  const initial = entryAskOf(params);
  return <AskDestination entry={entry} search={location.search} sourceId={initial.sourceId} />;
}

function AskDestination({
  entry,
  search,
  sourceId,
}: {
  entry: string;
  search: string;
  sourceId: string | null;
}) {
  const query = useQuery({
    queryKey: ["proposal-entry", search],
    queryFn: () => readProposalEntry(new URLSearchParams(search), document.referrer || null),
    enabled: sourceId !== null,
    retry: false,
  });
  // ACT-entry-link: without a source, or when its instance cannot be asked, VERA reads the link.
  if (sourceId === null || query.isError)
    return <Navigate replace to={`/${entry}?ask=${encodeURIComponent(search.slice(1))}`} />;
  if (!query.data) return null;
  const params = new URLSearchParams();
  const { ask, returnTo } = query.data;
  if (ask.record) params.set("record", ask.record);
  if (ask.identifier) {
    params.set("identifier", ask.identifier.value);
    params.set("type", ask.identifier.type);
  }
  if (ask.unit) params.set("unit", ask.unit);
  if (ask.reason) params.set("reason", ask.reason);
  if (ask.sourceId) params.set("source", ask.sourceId);
  if (returnTo) params.set("return", returnTo);
  return <Navigate replace to={`/${entry}?ask=${encodeURIComponent(params.toString())}`} />;
}
