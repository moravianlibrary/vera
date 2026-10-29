// The /ask entry route forwards an outside portal's link into a Documents perspective.

import { hasPermission } from "@vera/domain/permissions";
import { Navigate, useLocation } from "react-router";
import { canOpenNavigationEntry } from "@/components/layout/navigation";
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
  return <Navigate replace to={`/${entry}?ask=${encodeURIComponent(location.search.slice(1))}`} />;
}
